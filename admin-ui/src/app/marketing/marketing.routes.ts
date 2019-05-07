import { Route } from '@angular/router';

import { createResolveData } from '../common/base-entity-resolver';
import { detailBreadcrumb } from '../common/detail-breadcrumb';
import { Promotion } from '../common/generated-types';
import { _ } from '../core/providers/i18n/mark-for-extraction';
import { CanDeactivateDetailGuard } from '../shared/providers/routing/can-deactivate-detail-guard';

import { PromotionDetailComponent } from './components/promotion-detail/promotion-detail.component';
import { PromotionListComponent } from './components/promotion-list/promotion-list.component';
import { PromotionResolver } from './providers/routing/promotion-resolver';

export const marketingRoutes: Route[] = [
    {
        path: 'promotions',
        component: PromotionListComponent,
        data: {
            breadcrumb: _('breadcrumb.promotions'),
        },
    },
    {
        path: 'promotions/:id',
        component: PromotionDetailComponent,
        resolve: createResolveData(PromotionResolver),
        canDeactivate: [CanDeactivateDetailGuard],
        data: {
            breadcrumb: promotionBreadcrumb,
        },
    },
];

export function promotionBreadcrumb(data: any, params: any) {
    return detailBreadcrumb<Promotion.Fragment>({
        entity: data.entity,
        id: params.id,
        breadcrumbKey: 'breadcrumb.promotions',
        getName: promotion => promotion.name,
        route: 'promotions',
    });
}
