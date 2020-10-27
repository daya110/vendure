import { RequestContext } from '../../api/common/request-context';
import { InjectableStrategy } from '../../common/types/injectable-strategy';
import { Channel, Order, Zone } from '../../entity';

/**
 * @description
 * Defines how the active {@link Zone} is determined for the purposes of calculating taxes.
 *
 * @docsCategory tax
 */
export interface TaxZoneStrategy extends InjectableStrategy {
    determineTaxZone(ctx: RequestContext, zones: Zone[], channel: Channel, order?: Order): Zone | undefined;
}
