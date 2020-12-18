import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { HistoryEntryListOptions, OrderHistoryArgs, SortOrder } from '@vendure/common/lib/generated-types';

import { assertFound } from '../../../common/utils';
import { Order } from '../../../entity/order/order.entity';
import { ProductOptionGroup } from '../../../entity/product-option-group/product-option-group.entity';
import { HistoryService } from '../../../service/services/history.service';
import { OrderService } from '../../../service/services/order.service';
import { ShippingMethodService } from '../../../service/services/shipping-method.service';
import { ApiType } from '../../common/get-api-type';
import { RequestContext } from '../../common/request-context';
import { Api } from '../../decorators/api.decorator';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver('Order')
export class OrderEntityResolver {
    constructor(
        private orderService: OrderService,
        private shippingMethodService: ShippingMethodService,
        private historyService: HistoryService,
    ) {}

    @ResolveField()
    async payments(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        if (order.payments) {
            return order.payments;
        }
        return this.orderService.getOrderPayments(ctx, order.id);
    }

    @ResolveField()
    async fulfillments(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        return this.orderService.getOrderFulfillments(ctx, order);
    }

    @ResolveField()
    async surcharges(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        if (order.surcharges) {
            return order.surcharges;
        }
        return this.orderService.getOrderSurcharges(ctx, order.id);
    }

    @ResolveField()
    async lines(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        if (order.lines) {
            return order.lines;
        }
        const { lines } = await assertFound(this.orderService.findOne(ctx, order.id));
        return lines;
    }

    @ResolveField()
    async history(
        @Ctx() ctx: RequestContext,
        @Api() apiType: ApiType,
        @Parent() order: Order,
        @Args() args: OrderHistoryArgs,
    ) {
        const publicOnly = apiType === 'shop';
        const options: HistoryEntryListOptions = { ...args.options };
        if (!options.sort) {
            options.sort = { createdAt: SortOrder.ASC };
        }
        return this.historyService.getHistoryForOrder(ctx, order.id, publicOnly, options);
    }

    @ResolveField()
    async promotions(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        if (order.promotions) {
            return order.promotions;
        }
        return this.orderService.getOrderPromotions(ctx, order.id);
    }
}

@Resolver('Order')
export class OrderAdminEntityResolver {
    constructor(private orderService: OrderService) {}

    @ResolveField()
    async modifications(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        if (order.modifications) {
            return order.modifications;
        }
        return this.orderService.getOrderModifications(ctx, order.id);
    }

    @ResolveField()
    async nextStates(@Parent() order: Order) {
        return this.orderService.getNextOrderStates(order);
    }
}
