import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';

import { Adjustment, AdjustmentType } from '../../../../shared/generated-types';
import { DeepPartial } from '../../../../shared/shared-types';
import { Calculated } from '../../common/calculated-decorator';
import { Asset } from '../asset/asset.entity';
import { VendureEntity } from '../base/base.entity';
import { OrderItem } from '../order-item/order-item.entity';
import { Order } from '../order/order.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { TaxCategory } from '../tax-category/tax-category.entity';

@Entity()
export class OrderLine extends VendureEntity {
    constructor(input?: DeepPartial<OrderLine>) {
        super(input);
    }

    @ManyToOne(type => ProductVariant)
    productVariant: ProductVariant;

    @ManyToOne(type => TaxCategory)
    taxCategory: TaxCategory;

    @ManyToOne(type => Asset)
    featuredAsset: Asset;

    @OneToMany(type => OrderItem, item => item.line)
    items: OrderItem[];

    @ManyToOne(type => Order, order => order.lines, { onDelete: 'CASCADE' })
    order: Order;

    @Calculated()
    get unitPrice(): number {
        return this.items ? this.items[0].unitPrice : 0;
    }

    @Calculated()
    get unitPriceWithTax(): number {
        return this.items ? this.items[0].unitPriceWithTax : 0;
    }

    @Calculated()
    get quantity(): number {
        return this.items ? this.items.length : 0;
    }

    @Calculated()
    get totalPrice(): number {
        return this.items
            ? this.items.reduce((total, item) => total + item.unitPriceWithPromotionsAndTax, 0)
            : 0;
    }

    @Calculated()
    get adjustments(): Adjustment[] {
        if (this.items) {
            return this.items.reduce(
                (adjustments, item) => [...adjustments, ...item.adjustments],
                [] as Adjustment[],
            );
        }
        return [];
    }

    get lineTax(): number {
        return this.items.reduce((total, item) => total + item.unitTax, 0);
    }

    /**
     * Sets whether the unitPrice of each OrderItem in the line includes tax.
     */
    setUnitPriceIncludesTax(includesTax: boolean) {
        this.items.forEach(item => {
            item.unitPriceIncludesTax = includesTax;
        });
    }

    /**
     * Sets the tax rate being applied to each Orderitem in this line.
     */
    setTaxRate(taxRate: number) {
        this.items.forEach(item => {
            item.taxRate = taxRate;
        });
    }

    /**
     * Clears Adjustments from all OrderItems of the given type. If no type
     * is specified, then all adjustments are removed.
     */
    clearAdjustments(type?: AdjustmentType) {
        this.items.forEach(item => item.clearAdjustments(type));
    }
}
