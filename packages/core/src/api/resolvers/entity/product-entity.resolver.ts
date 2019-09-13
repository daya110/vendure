import { Parent, ResolveProperty, Resolver } from '@nestjs/graphql';

import { Translated } from '../../../common/types/locale-types';
import { Asset } from '../../../entity/asset/asset.entity';
import { Collection } from '../../../entity/collection/collection.entity';
import { ProductOptionGroup } from '../../../entity/product-option-group/product-option-group.entity';
import { ProductVariant } from '../../../entity/product-variant/product-variant.entity';
import { Product } from '../../../entity/product/product.entity';
import { AssetService } from '../../../service/services/asset.service';
import { CollectionService } from '../../../service/services/collection.service';
import { ProductOptionGroupService } from '../../../service/services/product-option-group.service';
import { ProductVariantService } from '../../../service/services/product-variant.service';
import { ApiType } from '../../common/get-api-type';
import { RequestContext } from '../../common/request-context';
import { Api } from '../../decorators/api.decorator';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver('Product')
export class ProductEntityResolver {
    constructor(
        private productVariantService: ProductVariantService,
        private collectionService: CollectionService,
        private productOptionGroupService: ProductOptionGroupService,
        private assetService: AssetService,
    ) {}

    @ResolveProperty()
    async variants(
        @Ctx() ctx: RequestContext,
        @Parent() product: Product,
        @Api() apiType: ApiType,
    ): Promise<Array<Translated<ProductVariant>>> {
        const variants = await this.productVariantService.getVariantsByProductId(ctx, product.id);
        return variants.filter(v => (apiType === 'admin' ? true : v.enabled));
    }

    @ResolveProperty()
    async collections(
        @Ctx() ctx: RequestContext,
        @Parent() product: Product,
        @Api() apiType: ApiType,
    ): Promise<Array<Translated<Collection>>> {
        return this.collectionService.getCollectionsByProductId(ctx, product.id, apiType === 'shop');
    }

    @ResolveProperty()
    async optionGroups(
        @Ctx() ctx: RequestContext,
        @Parent() product: Product,
    ): Promise<Array<Translated<ProductOptionGroup>>> {
        return this.productOptionGroupService.getOptionGroupsByProductId(ctx, product.id);
    }

    @ResolveProperty()
    async featuredAsset(@Ctx() ctx: RequestContext, @Parent() product: Product): Promise<Asset | undefined> {
        if (product.featuredAsset) {
            return product.featuredAsset;
        }
        return this.assetService.getFeaturedAsset(product);
    }

    @ResolveProperty()
    async assets(@Ctx() ctx: RequestContext, @Parent() product: Product): Promise<Asset[] | undefined> {
        return this.assetService.getEntityAssets(product);
    }
}
