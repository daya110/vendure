import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { OrderDetail } from '@vendure/admin-ui/core';

@Component({
    selector: 'vdr-fulfillment-detail',
    templateUrl: './fulfillment-detail.component.html',
    styleUrls: ['./fulfillment-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FulfillmentDetailComponent {
    @Input() fulfillmentId: string;
    @Input() order: OrderDetail.Fragment;

    get fulfillment(): OrderDetail.Fulfillments | undefined | null {
        return this.order.fulfillments && this.order.fulfillments.find(f => f.id === this.fulfillmentId);
    }

    get items(): Array<{ name: string; quantity: number }> {
        const itemMap = new Map<string, number>();
        const fulfillmentItemIds = this.fulfillment?.orderItems.map(i => i.id);
        for (const line of this.order.lines) {
            for (const item of line.items) {
                if (fulfillmentItemIds?.includes(item.id)) {
                    const count = itemMap.get(line.productVariant.name);
                    if (count != null) {
                        itemMap.set(line.productVariant.name, count + 1);
                    } else {
                        itemMap.set(line.productVariant.name, 1);
                    }
                }
            }
        }
        return Array.from(itemMap.entries()).map(([name, quantity]) => ({ name, quantity }));
    }

    getCustomFields(): Array<{ key: string; value: any }> {
        const customFields = (this.fulfillment as any).customFields;
        if (customFields) {
            return Object.entries(customFields)
                .filter(([key]) => key !== '__typename')
                .map(([key, value]) => ({ key, value: (value as any)?.toString() ?? '-' }));
        } else {
            return [];
        }
    }
}
