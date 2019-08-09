import { LanguageCode } from '@vendure/common/lib/generated-types';

import { ShippingCalculator } from './shipping-calculator';

export const defaultShippingCalculator = new ShippingCalculator({
    code: 'default-shipping-calculator',
    description: [{ languageCode: LanguageCode.en, value: 'Default Flat-Rate Shipping Calculator' }],
    args: {
        rate: {
            type: 'int',
            config: { inputType: 'money' },
            label: [{ languageCode: LanguageCode.en, value: 'Shipping price' }],
        },
        taxRate: {
            type: 'int',
            config: { inputType: 'percentage' },
            label: [{ languageCode: LanguageCode.en, value: 'Tax rate' }],
        },
    },
    calculate: (order, args) => {
        return { price: args.rate, priceWithTax: args.rate * ((100 + args.taxRate) / 100) };
    },
});
