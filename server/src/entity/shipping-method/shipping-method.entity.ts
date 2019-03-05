import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';

import { Adjustment, AdjustmentType, ConfigurableOperation } from '../../../../shared/generated-types';
import { DeepPartial } from '../../../../shared/shared-types';
import { AdjustmentSource } from '../../common/types/adjustment-source';
import { ChannelAware } from '../../common/types/common-types';
import { getConfig } from '../../config/config-helpers';
import { ShippingCalculator } from '../../config/shipping-method/shipping-calculator';
import { ShippingEligibilityChecker } from '../../config/shipping-method/shipping-eligibility-checker';
import { Channel } from '../channel/channel.entity';
import { Order } from '../order/order.entity';

/**
 * @description
 * A ShippingMethod is used to apply a shipping price to an {@link Order}. It is composed of a
 * {@link ShippingEligibilityChecker} and a {@link ShippingCalculator}. For a given Order,
 * the `checker` is used to determine whether this ShippingMethod can be used. If yes, then
 * the ShippingMethod can be applied and the `calculator` is used to determine the price of
 * shipping.
 *
 * @docsCategory entities
 */
@Entity()
export class ShippingMethod extends AdjustmentSource implements ChannelAware {
    type = AdjustmentType.SHIPPING;
    private readonly allCheckers: { [code: string]: ShippingEligibilityChecker } = {};
    private readonly allCalculators: { [code: string]: ShippingCalculator } = {};

    constructor(input?: DeepPartial<ShippingMethod>) {
        super(input);
        const checkers = getConfig().shippingOptions.shippingEligibilityCheckers || [];
        const calculators = getConfig().shippingOptions.shippingCalculators || [];
        this.allCheckers = checkers.reduce((hash, o) => ({ ...hash, [o.code]: o }), {});
        this.allCalculators = calculators.reduce((hash, o) => ({ ...hash, [o.code]: o }), {});
    }

    @Column() code: string;

    @Column() description: string;

    @Column('simple-json') checker: ConfigurableOperation;

    @Column('simple-json') calculator: ConfigurableOperation;

    @ManyToMany(type => Channel)
    @JoinTable()
    channels: Channel[];

    async apply(order: Order): Promise<Adjustment | undefined> {
        const calculator = this.allCalculators[this.calculator.code];
        if (calculator) {
            const amount = await calculator.calculate(order, this.calculator.args);
            return {
                amount,
                type: this.type,
                description: this.description,
                adjustmentSource: this.getSourceId(),
            };
        }
    }

    async test(order: Order): Promise<boolean> {
        const checker = this.allCheckers[this.checker.code];
        if (checker) {
            return checker.check(order, this.checker.args);
        } else {
            return false;
        }
    }
}
