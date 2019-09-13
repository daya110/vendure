import { Args, Parent, ResolveProperty, Resolver } from '@nestjs/graphql';
import { StockMovementListOptions } from '@vendure/common/lib/generated-types';
import { PaginatedList } from '@vendure/common/lib/shared-types';

import { Translated } from '../../../common/types/locale-types';
import { Asset, FacetValue, ProductOption } from '../../../entity';
import { ProductVariant } from '../../../entity/product-variant/product-variant.entity';
import { StockMovement } from '../../../entity/stock-movement/stock-movement.entity';
import { AssetService } from '../../../service/services/asset.service';
import { ProductVariantService } from '../../../service/services/product-variant.service';
import { StockMovementService } from '../../../service/services/stock-movement.service';
import { ApiType } from '../../common/get-api-type';
import { RequestContext } from '../../common/request-context';
import { Api } from '../../decorators/api.decorator';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver('ProductVariant')
export class ProductVariantEntityResolver {
    constructor(private productVariantService: ProductVariantService, private assetService: AssetService) {}

    @ResolveProperty()
    async assets(
        @Ctx() ctx: RequestContext,
        @Parent() productVariant: ProductVariant,
    ): Promise<Asset[] | undefined> {
        return this.assetService.getEntityAssets(productVariant);
    }

    @ResolveProperty()
    async featuredAsset(
        @Ctx() ctx: RequestContext,
        @Parent() productVariant: ProductVariant,
    ): Promise<Asset | undefined> {
        if (productVariant.featuredAsset) {
            return productVariant.featuredAsset;
        }
        return this.assetService.getFeaturedAsset(productVariant);
    }

    @ResolveProperty()
    async options(
        @Ctx() ctx: RequestContext,
        @Parent() productVariant: ProductVariant,
    ): Promise<Array<Translated<ProductOption>>> {
        if (productVariant.options) {
            return productVariant.options as Array<Translated<ProductOption>>;
        }
        return this.productVariantService.getOptionsForVariant(ctx, productVariant.id);
    }

    @ResolveProperty()
    async facetValues(
        @Ctx() ctx: RequestContext,
        @Parent() productVariant: ProductVariant,
        @Api() apiType: ApiType,
    ): Promise<Array<Translated<FacetValue>>> {
        let facetValues: Array<Translated<FacetValue>>;
        if (productVariant.facetValues) {
            facetValues = productVariant.facetValues as Array<Translated<FacetValue>>;
        } else {
            facetValues = await this.productVariantService.getFacetValuesForVariant(ctx, productVariant.id);
        }
        if (apiType === 'shop') {
            facetValues = facetValues.filter(fv => !fv.facet.isPrivate);
        }
        return facetValues;
    }
}

@Resolver('ProductVariant')
export class ProductVariantAdminEntityResolver {
    constructor(private stockMovementService: StockMovementService) {}

    @ResolveProperty()
    async stockMovements(
        @Ctx() ctx: RequestContext,
        @Parent() productVariant: ProductVariant,
        @Args() args: { options: StockMovementListOptions },
    ): Promise<PaginatedList<StockMovement>> {
        return this.stockMovementService.getStockMovementsByProductVariantId(
            ctx,
            productVariant.id,
            args.options,
        );
    }
}
