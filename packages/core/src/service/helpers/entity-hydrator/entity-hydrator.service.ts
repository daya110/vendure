import { Injectable } from '@nestjs/common';
import { Type } from '@vendure/common/lib/shared-types';
import { unique } from '@vendure/common/lib/unique';

import { RequestContext } from '../../../api/common/request-context';
import { InternalServerError } from '../../../common/error/errors';
import { Translatable } from '../../../common/types/locale-types';
import { TransactionalConnection } from '../../../connection/transactional-connection';
import { VendureEntity } from '../../../entity/base/base.entity';
import { ProductVariant } from '../../../entity/product-variant/product-variant.entity';
import { ProductPriceApplicator } from '../product-price-applicator/product-price-applicator';
import { translateDeep } from '../utils/translate-entity';

import { HydrateOptions } from './entity-hydrator-types';

/**
 * @description
 * This is a helper class which is used to "hydrate" entity instances, which means to populate them
 * with the specified relations. This is useful when writing plugin code which receives an entity
 * and you need to ensure that one or more relations are present.
 *
 * @example
 * ```TypeScript
 * const product = this.productVariantService
 *   .getProductForVariant(ctx, variantId);
 *
 * await this.entityHydrator
 *   .hydrate(ctx, product, { relations: ['facetValues.facet' ]});
 *```
 *
 * In this above example, the `product` instance will now have the `facetValues` relation
 * available, and those FacetValues will have their `facet` relations joined too.
 *
 * This `hydrate` method will _also_ automatically take care or translating any
 * translatable entities (e.g. Product, Collection, Facet), and if the `applyProductVariantPrices`
 * options is used (see {@link HydrateOptions}), any related ProductVariant will have the correct
 * Channel-specific prices applied to them.
 *
 * @docsCategory data-access
 * @since 1.3.0
 */
@Injectable()
export class EntityHydrator {
    constructor(
        private connection: TransactionalConnection,
        private productPriceApplicator: ProductPriceApplicator,
    ) {}

    /**
     * @description
     * Hydrates (joins) the specified relations to the target entity instance. This method
     * mutates the `target` entity.
     *
     * @example
     * ```TypeScript
     * await this.entityHydrator.hydrate(ctx, product, {
     *   relations: [
     *     'variants.stockMovements'
     *     'optionGroups.options',
     *     'featuredAsset',
     *   ],
     *   applyProductVariantPrices: true,
     * });
     * ```
     *
     * @since 1.3.0
     */
    async hydrate<Entity extends VendureEntity>(
        ctx: RequestContext,
        target: Entity,
        options: HydrateOptions<Entity>,
    ): Promise<Entity> {
        if (options.relations) {
            let missingRelations = this.getMissingRelations(target, options);

            if (options.applyProductVariantPrices === true) {
                const productVariantPriceRelations = this.getRequiredProductVariantRelations(
                    target,
                    missingRelations,
                );
                missingRelations = unique([...missingRelations, ...productVariantPriceRelations]);
            }

            if (missingRelations.length) {
                const hydrated = await this.connection
                    .getRepository(ctx, target.constructor)
                    .findOne(target.id, {
                        relations: missingRelations,
                    });
                const propertiesToAdd = unique(missingRelations.map(relation => relation.split('.')[0]));
                for (const prop of propertiesToAdd) {
                    (target as any)[prop] = (hydrated as any)[prop];
                }

                const relationsWithEntities = missingRelations.map(relation => ({
                    entity: this.getRelationEntityAtPath(target, relation.split('.')),
                    relation,
                }));

                if (options.applyProductVariantPrices === true) {
                    for (const relationWithEntities of relationsWithEntities) {
                        const entity = relationWithEntities.entity;
                        if (entity) {
                            if (Array.isArray(entity)) {
                                if (entity[0] instanceof ProductVariant) {
                                    await Promise.all(
                                        entity.map((e: any) =>
                                            this.productPriceApplicator.applyChannelPriceAndTax(e, ctx),
                                        ),
                                    );
                                }
                            } else {
                                if (entity instanceof ProductVariant) {
                                    await this.productPriceApplicator.applyChannelPriceAndTax(entity, ctx);
                                }
                            }
                        }
                    }
                }

                const translateDeepRelations = relationsWithEntities
                    .filter(item => this.isTranslatable(item.entity))
                    .map(item => item.relation.split('.'));

                Object.assign(
                    target,
                    translateDeep(target as any, ctx.languageCode, translateDeepRelations as any),
                );
            }
        }
        return target;
    }

    /**
     * Compares the requested relations against the actual existing relations on the target entity,
     * and returns an array of all missing relation paths that would need to be fetched.
     */
    private getMissingRelations<Entity extends VendureEntity>(
        target: Entity,
        options: HydrateOptions<Entity>,
    ) {
        const missingRelations: string[] = [];
        for (const relation of options.relations.slice().sort()) {
            if (typeof relation === 'string') {
                const parts = relation.split('.');
                let entity: any = target;
                const path = [];
                for (const part of parts) {
                    path.push(part);
                    if (entity[part]) {
                        entity = Array.isArray(entity[part]) ? entity[part][0] : entity[part];
                    } else {
                        const allParts = path.reduce((result, p, i) => {
                            if (i === 0) {
                                return [p];
                            } else {
                                return [...result, [result[result.length - 1], p].join('.')];
                            }
                        }, [] as string[]);
                        missingRelations.push(...allParts);
                    }
                }
            }
        }
        return unique(missingRelations);
    }

    private getRequiredProductVariantRelations<Entity extends VendureEntity>(
        target: Entity,
        missingRelations: string[],
    ): string[] {
        const relationsToAdd: string[] = [];
        for (const relation of missingRelations) {
            const entityType = this.getRelationEntityTypeAtPath(target, relation);
            if (entityType === ProductVariant) {
                relationsToAdd.push([relation, 'taxCategory'].join('.'));
            }
        }
        return relationsToAdd;
    }

    /**
     * Returns an instance of the related entity at the given path. E.g. a path of `['variants', 'featuredAsset']`
     * will return an Asset instance.
     */
    private getRelationEntityAtPath(
        entity: VendureEntity,
        path: string[],
    ): VendureEntity | VendureEntity[] | undefined {
        let relation: any = entity;
        for (let i = 0; i < path.length; i++) {
            const part = path[i];
            const isLast = i === path.length - 1;
            if (relation[part]) {
                relation = Array.isArray(relation[part]) && !isLast ? relation[part][0] : relation[part];
            } else {
                return;
            }
        }
        return relation;
    }

    private getRelationEntityTypeAtPath(entity: VendureEntity, path: string): Type<VendureEntity> {
        const { entityMetadatas } = this.connection.rawConnection;
        const targetMetadata = entityMetadatas.find(m => m.target === entity.constructor);
        if (!targetMetadata) {
            throw new InternalServerError(
                `Cannot find entity metadata for entity "${entity.constructor.name}"`,
            );
        }
        let currentMetadata = targetMetadata;
        for (const pathPart of path.split('.')) {
            const relationMetadata = currentMetadata.findRelationWithPropertyPath(pathPart);
            if (relationMetadata) {
                currentMetadata = relationMetadata.inverseEntityMetadata;
            } else {
                throw new InternalServerError(
                    `Cannot find relation metadata for entity "${currentMetadata.targetName}" at path "${pathPart}"`,
                );
            }
        }
        return currentMetadata.target as Type<VendureEntity>;
    }

    private isTranslatable(input: any | any[]): input is Translatable {
        return Array.isArray(input)
            ? input[0].hasOwnProperty('translations')
            : input.hasOwnProperty('translations');
    }
}
