import { ChangeDetectorRef, Optional, Pipe, PipeTransform } from '@angular/core';

import { DataService } from '../../data/providers/data.service';

import { LocaleBasePipe } from './locale-base.pipe';

/**
 * @description
 * Formats a Vendure monetary value (in cents) into the correct format for the configured currency and display
 * locale.
 *
 * @example
 * ```HTML
 * {{ variant.priceWithTax | localeCurrency }}
 * ```
 *
 * @docsCategory pipes
 */
@Pipe({
    name: 'localeCurrency',
    pure: false,
})
export class LocaleCurrencyPipe extends LocaleBasePipe implements PipeTransform {
    constructor(@Optional() dataService?: DataService, @Optional() changeDetectorRef?: ChangeDetectorRef) {
        super(dataService, changeDetectorRef);
    }

    transform(value: unknown, ...args: unknown[]): string | unknown {
        const [currencyCode, locale] = args;
        if (typeof value === 'number' && typeof currencyCode === 'string') {
            const activeLocale = this.getActiveLocale(locale);
            const majorUnits = value / 100;
            return new Intl.NumberFormat(activeLocale, { style: 'currency', currency: currencyCode }).format(
                majorUnits,
            );
        }
        return value;
    }
}
