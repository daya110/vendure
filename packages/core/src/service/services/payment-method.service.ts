import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { ConfigArg, RefundOrderInput, UpdatePaymentMethodInput } from '@vendure/common/lib/generated-types';
import { omit } from '@vendure/common/lib/omit';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { assertNever } from '@vendure/common/lib/shared-utils';
import { Connection } from 'typeorm';

import { RequestContext } from '../../api/common/request-context';
import { UserInputError } from '../../common/error/errors';
import { ListQueryOptions } from '../../common/types/common-types';
import { ConfigService } from '../../config/config.service';
import {
    PaymentMethodArgs,
    PaymentMethodArgType,
    PaymentMethodHandler,
} from '../../config/payment-method/payment-method-handler';
import { OrderItem } from '../../entity/order-item/order-item.entity';
import { Order } from '../../entity/order/order.entity';
import { PaymentMethod } from '../../entity/payment-method/payment-method.entity';
import { Payment, PaymentMetadata } from '../../entity/payment/payment.entity';
import { Refund } from '../../entity/refund/refund.entity';
import { EventBus } from '../../event-bus/event-bus';
import { PaymentStateTransitionEvent } from '../../event-bus/events/payment-state-transition-event';
import { RefundStateTransitionEvent } from '../../event-bus/events/refund-state-transition-event';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { PaymentStateMachine } from '../helpers/payment-state-machine/payment-state-machine';
import { RefundStateMachine } from '../helpers/refund-state-machine/refund-state-machine';
import { getEntityOrThrow } from '../helpers/utils/get-entity-or-throw';
import { patchEntity } from '../helpers/utils/patch-entity';

@Injectable()
export class PaymentMethodService {
    constructor(
        @InjectConnection() private connection: Connection,
        private configService: ConfigService,
        private listQueryBuilder: ListQueryBuilder,
        private paymentStateMachine: PaymentStateMachine,
        private refundStateMachine: RefundStateMachine,
        private eventBus: EventBus,
    ) {}

    async initPaymentMethods() {
        await this.ensurePaymentMethodsExist();
    }

    findAll(options?: ListQueryOptions<PaymentMethod>): Promise<PaginatedList<PaymentMethod>> {
        return this.listQueryBuilder
            .build(PaymentMethod, options)
            .getManyAndCount()
            .then(([items, totalItems]) => ({
                items,
                totalItems,
            }));
    }

    findOne(paymentMethodId: ID): Promise<PaymentMethod | undefined> {
        return this.connection.manager.findOne(PaymentMethod, paymentMethodId);
    }

    async update(input: UpdatePaymentMethodInput): Promise<PaymentMethod> {
        const paymentMethod = await getEntityOrThrow(this.connection, PaymentMethod, input.id);
        const updatedPaymentMethod = patchEntity(paymentMethod, omit(input, ['configArgs']));
        if (input.configArgs) {
            const handler = this.configService.paymentOptions.paymentMethodHandlers.find(
                h => h.code === paymentMethod.code,
            );
            if (handler) {
                updatedPaymentMethod.configArgs = input.configArgs;
            }
        }
        return this.connection.getRepository(PaymentMethod).save(updatedPaymentMethod);
    }

    async createPayment(
        ctx: RequestContext,
        order: Order,
        method: string,
        metadata: PaymentMetadata,
    ): Promise<Payment> {
        const { paymentMethod, handler } = await this.getMethodAndHandler(method);
        const result = await handler.createPayment(order, paymentMethod.configArgs, metadata || {});
        const initialState = 'Created';
        const payment = await this.connection
            .getRepository(Payment)
            .save(new Payment({ ...result, state: initialState }));
        await this.paymentStateMachine.transition(ctx, order, payment, result.state);
        await this.connection.getRepository(Payment).save(payment, { reload: false });
        this.eventBus.publish(
            new PaymentStateTransitionEvent(initialState, result.state, ctx, payment, payment.order),
        );
        return payment;
    }

    async settlePayment(payment: Payment, order: Order) {
        const { paymentMethod, handler } = await this.getMethodAndHandler(payment.method);
        return handler.settlePayment(order, payment, paymentMethod.configArgs);
    }

    async createRefund(
        ctx: RequestContext,
        input: RefundOrderInput,
        order: Order,
        items: OrderItem[],
        payment: Payment,
    ): Promise<Refund> {
        const { paymentMethod, handler } = await this.getMethodAndHandler(payment.method);
        const itemAmount = items.reduce((sum, item) => sum + item.unitPriceWithTax, 0);
        const refundAmount = itemAmount + input.shipping + input.adjustment;
        let refund = new Refund({
            payment,
            orderItems: items,
            items: itemAmount,
            reason: input.reason,
            adjustment: input.adjustment,
            shipping: input.shipping,
            total: refundAmount,
            method: payment.method,
            state: 'Pending',
            metadata: {},
        });
        const createRefundResult = await handler.createRefund(
            input,
            refundAmount,
            order,
            payment,
            paymentMethod.configArgs,
        );
        if (createRefundResult) {
            refund.transactionId = createRefundResult.transactionId || '';
            refund.metadata = createRefundResult.metadata || {};
        }
        refund = await this.connection.getRepository(Refund).save(refund);
        if (createRefundResult) {
            const fromState = refund.state;
            await this.refundStateMachine.transition(ctx, order, refund, createRefundResult.state);
            await this.connection.getRepository(Refund).save(refund, { reload: false });
            this.eventBus.publish(
                new RefundStateTransitionEvent(fromState, createRefundResult.state, ctx, refund, order),
            );
        }
        return refund;
    }

    private async getMethodAndHandler(
        method: string,
    ): Promise<{ paymentMethod: PaymentMethod; handler: PaymentMethodHandler }> {
        const paymentMethod = await this.connection.getRepository(PaymentMethod).findOne({
            where: {
                code: method,
                enabled: true,
            },
        });
        if (!paymentMethod) {
            throw new UserInputError(`error.payment-method-not-found`, { method });
        }
        const handler = this.configService.paymentOptions.paymentMethodHandlers.find(
            h => h.code === paymentMethod.code,
        );
        if (!handler) {
            throw new UserInputError(`error.no-payment-handler-with-code`, { code: paymentMethod.code });
        }
        return { paymentMethod, handler };
    }

    private async ensurePaymentMethodsExist() {
        const paymentMethodHandlers: Array<PaymentMethodHandler<PaymentMethodArgs>> = this.configService
            .paymentOptions.paymentMethodHandlers;
        const existingPaymentMethods = await this.connection.getRepository(PaymentMethod).find();
        const toCreate = paymentMethodHandlers.filter(
            h => !existingPaymentMethods.find(pm => pm.code === h.code),
        );
        const toRemove = existingPaymentMethods.filter(
            h => !paymentMethodHandlers.find(pm => pm.code === h.code),
        );
        const toUpdate = existingPaymentMethods.filter(
            h => !toCreate.find(x => x.code === h.code) && !toRemove.find(x => x.code === h.code),
        );

        for (const paymentMethod of toUpdate) {
            const handler = paymentMethodHandlers.find(h => h.code === paymentMethod.code);
            if (!handler) {
                continue;
            }
            paymentMethod.configArgs = this.buildConfigArgsArray(handler, paymentMethod.configArgs);
            await this.connection.getRepository(PaymentMethod).save(paymentMethod, { reload: false });
        }
        for (const handler of toCreate) {
            let paymentMethod = existingPaymentMethods.find(pm => pm.code === handler.code);

            if (!paymentMethod) {
                paymentMethod = new PaymentMethod({
                    code: handler.code,
                    enabled: true,
                    configArgs: [],
                });
            }
            paymentMethod.configArgs = this.buildConfigArgsArray(handler, paymentMethod.configArgs);
            await this.connection.getRepository(PaymentMethod).save(paymentMethod, { reload: false });
        }
        await this.connection.getRepository(PaymentMethod).remove(toRemove);
    }

    private buildConfigArgsArray(
        handler: PaymentMethodHandler,
        existingConfigArgs: ConfigArg[],
    ): ConfigArg[] {
        let configArgs: ConfigArg[] = [];
        for (const [name, def] of Object.entries(handler.args)) {
            if (!existingConfigArgs.find(ca => ca.name === name)) {
                configArgs.push({
                    name,
                    type: def.type,
                    value: this.getDefaultValue(def.type),
                });
            }
        }
        configArgs = configArgs.filter(ca => handler.args.hasOwnProperty(ca.name));
        return [...existingConfigArgs, ...configArgs];
    }

    private getDefaultValue(type: PaymentMethodArgType): string {
        switch (type) {
            case 'string':
                return '';
            case 'boolean':
                return 'false';
            case 'int':
                return '0';
            default:
                assertNever(type);
                return '';
        }
    }
}
