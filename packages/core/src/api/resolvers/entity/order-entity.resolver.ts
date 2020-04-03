import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { HistoryEntryListOptions, OrderHistoryArgs, SortOrder } from '@vendure/common/lib/generated-types';

import { Order } from '../../../entity/order/order.entity';
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
    async payments(@Parent() order: Order) {
        if (order.payments) {
            return order.payments;
        }
        return this.orderService.getOrderPayments(order.id);
    }

    @ResolveField()
    async shippingMethod(@Ctx() ctx: RequestContext, @Parent() order: Order) {
        if (order.shippingMethodId) {
            // Does not need to be decoded because it is an internal property
            // which is never exposed to the outside world.
            const shippingMethodId = order.shippingMethodId;
            return this.shippingMethodService.findOne(ctx, shippingMethodId);
        } else {
            return null;
        }
    }

    @ResolveField()
    async fulfillments(@Parent() order: Order) {
        return this.orderService.getOrderFulfillments(order);
    }

    @ResolveField()
    async history(@Api() apiType: ApiType, @Parent() order: Order, @Args() args: OrderHistoryArgs) {
        const publicOnly = apiType === 'shop';
        const options: HistoryEntryListOptions = { ...args.options };
        if (!options.sort) {
            options.sort = { createdAt: SortOrder.ASC };
        }
        return this.historyService.getHistoryForOrder(order.id, publicOnly, options);
    }

    @ResolveField()
    async promotions(@Parent() order: Order) {
        if (order.promotions) {
            return order.promotions;
        }
        return this.orderService.getOrderPromotions(order.id);
    }
}
