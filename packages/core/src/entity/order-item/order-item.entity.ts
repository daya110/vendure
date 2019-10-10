import { Adjustment, AdjustmentType } from '@vendure/common/lib/generated-types';
import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Column, Entity, ManyToOne, OneToOne, RelationId } from 'typeorm';

import { Calculated } from '../../common/calculated-decorator';
import { VendureEntity } from '../base/base.entity';
import { EntityId } from '../entity-id.decorator';
import { Fulfillment } from '../fulfillment/fulfillment.entity';
import { OrderLine } from '../order-line/order-line.entity';
import { Refund } from '../refund/refund.entity';
import { Cancellation } from '../stock-movement/cancellation.entity';

/**
 * @description
 * An individual item of an {@link OrderLine}.
 *
 * @docsCategory entities
 */
@Entity()
export class OrderItem extends VendureEntity {
    constructor(input?: DeepPartial<OrderItem>) {
        super(input);
    }

    @ManyToOne(type => OrderLine, line => line.items, { onDelete: 'CASCADE' })
    line: OrderLine;

    @Column() readonly unitPrice: number;

    @Column() unitPriceIncludesTax: boolean;

    @Column() taxRate: number;

    @Column('simple-json') pendingAdjustments: Adjustment[];

    @ManyToOne(type => Fulfillment)
    fulfillment: Fulfillment;

    @EntityId({ nullable: true })
    fulfillmentId: ID | null;

    @ManyToOne(type => Refund)
    refund: Refund;

    @EntityId({ nullable: true })
    refundId: ID | null;

    @OneToOne(type => Cancellation, cancellation => cancellation.orderItem)
    cancellation: Cancellation;

    @RelationId('cancellation')
    cancellationId: ID | null;

    @Calculated()
    get cancelled(): boolean {
        return !!this.cancellationId;
    }

    @Calculated()
    get unitPriceWithTax(): number {
        if (this.unitPriceIncludesTax) {
            return this.unitPrice;
        } else {
            return Math.round(this.unitPrice * ((100 + this.taxRate) / 100));
        }
    }

    /**
     * Adjustments with promotion values adjusted to include tax.
     */
    @Calculated()
    get adjustments(): Adjustment[] {
        if (this.unitPriceIncludesTax) {
            return this.pendingAdjustments;
        } else {
            return this.pendingAdjustments.map(a => {
                if (a.type === AdjustmentType.PROMOTION) {
                    // Add the tax that would have been payable on the discount so that the numbers add up
                    // for the end-user.
                    const adjustmentWithTax = Math.round(a.amount * ((100 + this.taxRate) / 100));
                    return {
                        ...a,
                        amount: adjustmentWithTax,
                    };
                }
                return a;
            });
        }
    }

    /**
     * This is the actual, final price of the OrderItem payable by the customer.
     */
    get unitPriceWithPromotionsAndTax(): number {
        if (this.unitPriceIncludesTax) {
            return this.unitPriceWithPromotions;
        } else {
            return this.unitPriceWithPromotions + this.unitTax;
        }
    }

    get unitTax(): number {
        if (this.unitPriceIncludesTax) {
            return Math.round(
                this.unitPriceWithPromotions - this.unitPriceWithPromotions / ((100 + this.taxRate) / 100),
            );
        } else {
            const taxAdjustment = this.adjustments.find(a => a.type === AdjustmentType.TAX);
            return taxAdjustment ? taxAdjustment.amount : 0;
        }
    }

    get promotionAdjustmentsTotal(): number {
        return this.pendingAdjustments
            .filter(a => a.type === AdjustmentType.PROMOTION)
            .reduce((total, a) => total + a.amount, 0);
    }

    get unitPriceWithPromotions(): number {
        return this.unitPrice + this.promotionAdjustmentsTotal;
    }

    clearAdjustments(type?: AdjustmentType) {
        if (!type) {
            this.pendingAdjustments = [];
        } else {
            this.pendingAdjustments = this.pendingAdjustments
                ? this.pendingAdjustments.filter(a => a.type !== type)
                : [];
        }
    }
}
