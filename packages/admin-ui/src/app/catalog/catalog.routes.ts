import { Route } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { createResolveData } from '../common/base-entity-resolver';
import { detailBreadcrumb } from '../common/detail-breadcrumb';
import { FacetWithValues, OrderDetail, ProductWithVariants } from '../common/generated-types';
import { BreadcrumbValue } from '../core/components/breadcrumb/breadcrumb.component';
import { _ } from '../core/providers/i18n/mark-for-extraction';
import { CanDeactivateDetailGuard } from '../shared/providers/routing/can-deactivate-detail-guard';

import { AssetListComponent } from './components/asset-list/asset-list.component';
import { CollectionDetailComponent } from './components/collection-detail/collection-detail.component';
import { CollectionListComponent } from './components/collection-list/collection-list.component';
import { FacetDetailComponent } from './components/facet-detail/facet-detail.component';
import { FacetListComponent } from './components/facet-list/facet-list.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductVariantsEditorComponent } from './components/product-variants-editor/product-variants-editor.component';
import { CollectionResolver } from './providers/routing/collection-resolver';
import { FacetResolver } from './providers/routing/facet-resolver';
import { ProductResolver } from './providers/routing/product-resolver';
import { ProductVariantsResolver } from './providers/routing/product-variants-resolver';

export const catalogRoutes: Route[] = [
    {
        path: 'products',
        component: ProductListComponent,
        data: {
            breadcrumb: _('breadcrumb.products'),
        },
    },
    {
        path: 'products/:id',
        component: ProductDetailComponent,
        resolve: createResolveData(ProductResolver),
        canDeactivate: [CanDeactivateDetailGuard],
        data: {
            breadcrumb: productBreadcrumb,
        },
    },
    {
        path: 'products/:id/manage-variants',
        component: ProductVariantsEditorComponent,
        resolve: createResolveData(ProductVariantsResolver),
        canDeactivate: [CanDeactivateDetailGuard],
        data: {
            breadcrumb: productVariantEditorBreadcrumb,
        },
    },
    {
        path: 'facets',
        component: FacetListComponent,
        data: {
            breadcrumb: _('breadcrumb.facets'),
        },
    },
    {
        path: 'facets/:id',
        component: FacetDetailComponent,
        resolve: createResolveData(FacetResolver),
        canDeactivate: [CanDeactivateDetailGuard],
        data: {
            breadcrumb: facetBreadcrumb,
        },
    },
    {
        path: 'collections',
        component: CollectionListComponent,
        data: {
            breadcrumb: _('breadcrumb.collections'),
        },
    },
    {
        path: 'collections/:id',
        component: CollectionDetailComponent,
        resolve: createResolveData(CollectionResolver),
        canDeactivate: [CanDeactivateDetailGuard],
        data: {
            breadcrumb: collectionBreadcrumb,
        },
    },
    {
        path: 'assets',
        component: AssetListComponent,
        data: {
            breadcrumb: _('breadcrumb.assets'),
        },
    },
];

export function productBreadcrumb(data: any, params: any) {
    return detailBreadcrumb<ProductWithVariants.Fragment>({
        entity: data.entity,
        id: params.id,
        breadcrumbKey: 'breadcrumb.products',
        getName: product => product.name,
        route: 'products',
    });
}

export function productVariantEditorBreadcrumb(data: any, params: any) {
    return data.entity.pipe(
        map((entity: any) => {
            return [
                {
                    label: _('breadcrumb.products'),
                    link: ['../', 'products'],
                },
                {
                    label: `#${params.id} (${entity.name})`,
                    link: ['../', 'products', params.id, { tab: 'variants' }],
                },
                {
                    label: _('breadcrumb.manage-variants'),
                    link: ['manage-variants'],
                },
            ];
        }),
    );
}

export function facetBreadcrumb(data: any, params: any) {
    return detailBreadcrumb<FacetWithValues.Fragment>({
        entity: data.entity,
        id: params.id,
        breadcrumbKey: 'breadcrumb.facets',
        getName: facet => facet.name,
        route: 'facets',
    });
}

export function collectionBreadcrumb(data: any, params: any) {
    return detailBreadcrumb<FacetWithValues.Fragment>({
        entity: data.entity,
        id: params.id,
        breadcrumbKey: 'breadcrumb.collections',
        getName: facet => facet.name,
        route: 'collections',
    });
}
