import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import {
    AssignProductsToChannelInput,
    CreateProductInput,
    DeletionResponse,
    DeletionResult,
    Permission,
    RemoveProductsFromChannelInput,
    UpdateProductInput,
} from '@vendure/common/lib/generated-types';
import { normalizeString } from '@vendure/common/lib/normalize-string';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { Connection } from 'typeorm';

import { RequestContext } from '../../api/common/request-context';
import { EntityNotFoundError, ForbiddenError, UserInputError } from '../../common/error/errors';
import { ListQueryOptions } from '../../common/types/common-types';
import { Translated } from '../../common/types/locale-types';
import { assertFound, idsAreEqual } from '../../common/utils';
import { Channel } from '../../entity/channel/channel.entity';
import { ProductOptionGroup } from '../../entity/product-option-group/product-option-group.entity';
import { ProductTranslation } from '../../entity/product/product-translation.entity';
import { Product } from '../../entity/product/product.entity';
import { EventBus } from '../../event-bus/event-bus';
import { ProductChannelEvent } from '../../event-bus/events/product-channel-event';
import { ProductEvent } from '../../event-bus/events/product-event';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { TranslatableSaver } from '../helpers/translatable-saver/translatable-saver';
import { findByIdsInChannel, findOneInChannel } from '../helpers/utils/channel-aware-orm-utils';
import { getEntityOrThrow } from '../helpers/utils/get-entity-or-throw';
import { translateDeep } from '../helpers/utils/translate-entity';

import { AssetService } from './asset.service';
import { ChannelService } from './channel.service';
import { CollectionService } from './collection.service';
import { FacetValueService } from './facet-value.service';
import { ProductVariantService } from './product-variant.service';
import { RoleService } from './role.service';
import { TaxRateService } from './tax-rate.service';

@Injectable()
export class ProductService {
    private readonly relations = ['featuredAsset', 'assets', 'channels', 'facetValues', 'facetValues.facet'];

    constructor(
        @InjectConnection() private connection: Connection,
        private channelService: ChannelService,
        private roleService: RoleService,
        private assetService: AssetService,
        private productVariantService: ProductVariantService,
        private facetValueService: FacetValueService,
        private taxRateService: TaxRateService,
        private collectionService: CollectionService,
        private listQueryBuilder: ListQueryBuilder,
        private translatableSaver: TranslatableSaver,
        private eventBus: EventBus,
    ) {}

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<Product>,
    ): Promise<PaginatedList<Translated<Product>>> {
        return this.listQueryBuilder
            .build(Product, options, {
                relations: this.relations,
                channelId: ctx.channelId,
                where: { deletedAt: null },
            })
            .getManyAndCount()
            .then(async ([products, totalItems]) => {
                const items = products.map(product =>
                    translateDeep(product, ctx.languageCode, ['facetValues', ['facetValues', 'facet']]),
                );
                return {
                    items,
                    totalItems,
                };
            });
    }

    async findOne(ctx: RequestContext, productId: ID): Promise<Translated<Product> | undefined> {
        const product = await findOneInChannel(this.connection, Product, productId, ctx.channelId, {
            relations: this.relations,
            where: {
                deletedAt: null,
            },
        });
        if (!product) {
            return;
        }
        return translateDeep(product, ctx.languageCode, ['facetValues', ['facetValues', 'facet']]);
    }

    async findByIds(ctx: RequestContext, productIds: ID[]): Promise<Array<Translated<Product>>> {
        return findByIdsInChannel(this.connection, Product, productIds, ctx.channelId, {
            relations: this.relations,
        }).then(products =>
            products.map(product =>
                translateDeep(product, ctx.languageCode, ['facetValues', ['facetValues', 'facet']]),
            ),
        );
    }

    async getProductChannels(ctx: RequestContext, productId: ID): Promise<Channel[]> {
        const product = await getEntityOrThrow(this.connection, Product, productId, ctx.channelId, {
            relations: ['channels'],
        });
        return product.channels;
    }

    async findOneBySlug(ctx: RequestContext, slug: string): Promise<Translated<Product> | undefined> {
        const translation = await this.connection.getRepository(ProductTranslation).findOne({
            where: {
                languageCode: ctx.languageCode,
                slug,
            },
        });
        if (!translation) {
            return;
        }
        return this.findOne(ctx, translation.baseId);
    }

    async create(ctx: RequestContext, input: CreateProductInput): Promise<Translated<Product>> {
        await this.validateSlugs(input);
        const product = await this.translatableSaver.create({
            input,
            entityType: Product,
            translationType: ProductTranslation,
            beforeSave: async p => {
                this.channelService.assignToCurrentChannel(p, ctx);
                if (input.facetValueIds) {
                    p.facetValues = await this.facetValueService.findByIds(input.facetValueIds);
                }
                await this.assetService.updateFeaturedAsset(p, input);
            },
        });
        await this.assetService.updateEntityAssets(product, input);
        this.eventBus.publish(new ProductEvent(ctx, product, 'created'));
        return assertFound(this.findOne(ctx, product.id));
    }

    async update(ctx: RequestContext, input: UpdateProductInput): Promise<Translated<Product>> {
        await getEntityOrThrow(this.connection, Product, input.id);
        await this.validateSlugs(input);
        const product = await this.translatableSaver.update({
            input,
            entityType: Product,
            translationType: ProductTranslation,
            beforeSave: async p => {
                if (input.facetValueIds) {
                    p.facetValues = await this.facetValueService.findByIds(input.facetValueIds);
                }
                await this.assetService.updateFeaturedAsset(p, input);
                await this.assetService.updateEntityAssets(p, input);
            },
        });
        this.eventBus.publish(new ProductEvent(ctx, product, 'updated'));
        return assertFound(this.findOne(ctx, product.id));
    }

    async softDelete(ctx: RequestContext, productId: ID): Promise<DeletionResponse> {
        const product = await getEntityOrThrow(this.connection, Product, productId, ctx.channelId);
        product.deletedAt = new Date();
        await this.connection.getRepository(Product).save(product, { reload: false });
        this.eventBus.publish(new ProductEvent(ctx, product, 'deleted'));
        return {
            result: DeletionResult.DELETED,
        };
    }

    async assignProductsToChannel(
        ctx: RequestContext,
        input: AssignProductsToChannelInput,
    ): Promise<Array<Translated<Product>>> {
        const hasPermission = await this.roleService.userHasPermissionOnChannel(
            ctx.activeUserId,
            input.channelId,
            Permission.UpdateCatalog,
        );
        if (!hasPermission) {
            throw new ForbiddenError();
        }
        const productsWithVariants = await this.connection
            .getRepository(Product)
            .findByIds(input.productIds, {
                relations: ['variants'],
            });
        const priceFactor = input.priceFactor != null ? input.priceFactor : 1;
        for (const product of productsWithVariants) {
            await this.channelService.assignToChannels(Product, product.id, [input.channelId]);
            for (const variant of product.variants) {
                await this.productVariantService.createProductVariantPrice(
                    variant.id,
                    variant.price * priceFactor,
                    input.channelId,
                );
            }
            this.eventBus.publish(new ProductChannelEvent(ctx, product, input.channelId, 'assigned'));
        }
        return this.findByIds(ctx, productsWithVariants.map(p => p.id));
    }

    async removeProductsFromChannel(
        ctx: RequestContext,
        input: RemoveProductsFromChannelInput,
    ): Promise<Array<Translated<Product>>> {
        const hasPermission = await this.roleService.userHasPermissionOnChannel(
            ctx.activeUserId,
            input.channelId,
            Permission.UpdateCatalog,
        );
        if (!hasPermission) {
            throw new ForbiddenError();
        }
        if (idsAreEqual(input.channelId, this.channelService.getDefaultChannel().id)) {
            throw new UserInputError('error.products-cannot-be-removed-from-default-channel');
        }
        const products = await this.connection.getRepository(Product).findByIds(input.productIds);
        for (const product of products) {
            await this.channelService.removeFromChannels(Product, product.id, [input.channelId]);
            this.eventBus.publish(new ProductChannelEvent(ctx, product, input.channelId, 'removed'));
        }
        return this.findByIds(ctx, products.map(p => p.id));
    }

    async addOptionGroupToProduct(
        ctx: RequestContext,
        productId: ID,
        optionGroupId: ID,
    ): Promise<Translated<Product>> {
        const product = await this.getProductWithOptionGroups(productId);
        const optionGroup = await this.connection.getRepository(ProductOptionGroup).findOne(optionGroupId);
        if (!optionGroup) {
            throw new EntityNotFoundError('ProductOptionGroup', optionGroupId);
        }

        if (Array.isArray(product.optionGroups)) {
            product.optionGroups.push(optionGroup);
        } else {
            product.optionGroups = [optionGroup];
        }

        await this.connection.manager.save(product, { reload: false });
        return assertFound(this.findOne(ctx, productId));
    }

    async removeOptionGroupFromProduct(
        ctx: RequestContext,
        productId: ID,
        optionGroupId: ID,
    ): Promise<Translated<Product>> {
        const product = await this.getProductWithOptionGroups(productId);
        const optionGroup = product.optionGroups.find(g => idsAreEqual(g.id, optionGroupId));
        if (!optionGroup) {
            throw new EntityNotFoundError('ProductOptionGroup', optionGroupId);
        }
        if (product.variants.length) {
            throw new UserInputError('error.cannot-remove-option-group-due-to-variants', {
                code: optionGroup.code,
                count: product.variants.length,
            });
        }
        product.optionGroups = product.optionGroups.filter(g => g.id !== optionGroupId);

        await this.connection.manager.save(product, { reload: false });
        return assertFound(this.findOne(ctx, productId));
    }

    private async getProductWithOptionGroups(productId: ID): Promise<Product> {
        const product = await this.connection.getRepository(Product).findOne(productId, {
            relations: ['optionGroups', 'variants', 'variants.options'],
            where: { deletedAt: null },
        });
        if (!product) {
            throw new EntityNotFoundError('Product', productId);
        }
        return product;
    }

    /**
     * Normalizes the slug to be URL-safe, and ensures it is unique for the given languageCode.
     */
    private async validateSlugs<T extends CreateProductInput | UpdateProductInput>(input: T): Promise<T> {
        if (input.translations) {
            for (const t of input.translations) {
                if (t.slug) {
                    t.slug = normalizeString(t.slug, '-');
                    let match: ProductTranslation | undefined;
                    let suffix = 1;
                    const alreadySuffixed = /-\d+$/;
                    do {
                        const qb = this.connection
                            .getRepository(ProductTranslation)
                            .createQueryBuilder('translation')
                            .where(`translation.slug = :slug`, { slug: t.slug })
                            .andWhere(`translation.languageCode = :languageCode`, {
                                languageCode: t.languageCode,
                            });
                        if ((input as UpdateProductInput).id) {
                            qb.andWhere(`translation.base != :id`, { id: (input as UpdateProductInput).id });
                        }
                        match = await qb.getOne();
                        if (match) {
                            suffix++;
                            if (alreadySuffixed.test(t.slug)) {
                                t.slug = t.slug.replace(alreadySuffixed, `-${suffix}`);
                            } else {
                                t.slug = `${t.slug}-${suffix}`;
                            }
                        }
                    } while (match);
                }
            }
        }
        return input;
    }
}
