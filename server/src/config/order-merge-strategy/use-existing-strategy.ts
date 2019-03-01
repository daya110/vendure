import { OrderLine } from '../../entity/order-line/order-line.entity';
import { Order } from '../../entity/order/order.entity';

import { OrderMergeStrategy } from './order-merge-strategy';

/**
 * @description
 * The guest order is discarded and the existing order is used as the active order.
 *
 * @docsCategory orders
 */
export class UseExistingStrategy implements OrderMergeStrategy {
    merge(guestOrder: Order, existingOrder: Order): OrderLine[] {
        return existingOrder.lines.slice();
    }
}
