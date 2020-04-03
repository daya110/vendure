import { CurrencyCode, LanguageCode } from '@vendure/common/lib/generated-types';

import { Channel } from '../../entity/channel/channel.entity';
import { Order } from '../../entity/order/order.entity';
import { AuthenticatedSession } from '../../entity/session/authenticated-session.entity';
import { Session } from '../../entity/session/session.entity';
import { User } from '../../entity/user/user.entity';
import { Zone } from '../../entity/zone/zone.entity';

import { RequestContext, SerializedRequestContext } from './request-context';

describe('RequestContext', () => {
    describe('fromObject()', () => {
        let original: RequestContext;
        let ctxObject: SerializedRequestContext;
        let session: Session;
        let user: User;
        let channel: Channel;
        let activeOrder: Order;
        let zone: Zone;

        beforeAll(() => {
            activeOrder = new Order({
                id: '55555',
                active: true,
                code: 'ADAWDJAWD',
            });
            user = new User({
                id: '8833774',
                verified: true,
            });
            session = new AuthenticatedSession({
                id: '1234',
                token: '2d37187e9e8fc47807fe4f58ca',
                activeOrder,
                user,
            });
            zone = new Zone({
                id: '62626',
                name: 'Europe',
            });
            channel = new Channel({
                token: 'oiajwodij09au3r',
                id: '995859',
                code: '__default_channel__',
                currencyCode: CurrencyCode.EUR,
                pricesIncludeTax: true,
                defaultLanguageCode: LanguageCode.en,
                defaultShippingZone: zone,
                defaultTaxZone: zone,
            });
            original = new RequestContext({
                apiType: 'admin',
                languageCode: LanguageCode.en,
                channel,
                session,
                isAuthorized: true,
                authorizedAsOwnerOnly: false,
            });

            ctxObject = original.serialize();
        });

        it('apiType', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.apiType).toBe(original.apiType);
        });

        it('channelId', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.channelId).toBe(original.channelId);
        });

        it('languageCode', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.languageCode).toBe(original.languageCode);
        });

        it('activeUserId', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.activeUserId).toBe(original.activeUserId);
        });

        it('isAuthorized', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.isAuthorized).toBe(original.isAuthorized);
        });

        it('authorizedAsOwnerOnly', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.authorizedAsOwnerOnly).toBe(original.authorizedAsOwnerOnly);
        });

        it('channel', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.channel).toEqual(original.channel);
        });

        it('session', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.session).toEqual(original.session);
        });

        it('activeUser', () => {
            const result = RequestContext.deserialize(ctxObject);
            expect(result.activeUser).toEqual(original.activeUser);
        });
    });
});
