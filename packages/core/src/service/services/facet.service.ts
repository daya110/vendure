import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import {
    CreateFacetInput,
    DeletionResponse,
    DeletionResult,
    LanguageCode,
    UpdateFacetInput,
} from '@vendure/common/lib/generated-types';
import { ID, PaginatedList } from '@vendure/common/lib/shared-types';
import { Connection } from 'typeorm';

import { RequestContext } from '../../api/common/request-context';
import { ListQueryOptions } from '../../common/types/common-types';
import { Translated } from '../../common/types/locale-types';
import { assertFound } from '../../common/utils';
import { ConfigService } from '../../config/config.service';
import { FacetTranslation } from '../../entity/facet/facet-translation.entity';
import { Facet } from '../../entity/facet/facet.entity';
import { ListQueryBuilder } from '../helpers/list-query-builder/list-query-builder';
import { TranslatableSaver } from '../helpers/translatable-saver/translatable-saver';
import { getEntityOrThrow } from '../helpers/utils/get-entity-or-throw';
import { translateDeep } from '../helpers/utils/translate-entity';

import { FacetValueService } from './facet-value.service';

@Injectable()
export class FacetService {
    constructor(
        @InjectConnection() private connection: Connection,
        private facetValueService: FacetValueService,
        private translatableSaver: TranslatableSaver,
        private listQueryBuilder: ListQueryBuilder,
        private configService: ConfigService,
    ) {}

    findAll(
        lang: LanguageCode,
        options?: ListQueryOptions<Facet>,
    ): Promise<PaginatedList<Translated<Facet>>> {
        const relations = ['values', 'values.facet'];

        return this.listQueryBuilder
            .build(Facet, options, { relations })
            .getManyAndCount()
            .then(([facets, totalItems]) => {
                const items = facets.map((facet) =>
                    translateDeep(facet, lang, ['values', ['values', 'facet']]),
                );
                return {
                    items,
                    totalItems,
                };
            });
    }

    findOne(facetId: ID, lang: LanguageCode): Promise<Translated<Facet> | undefined> {
        const relations = ['values', 'values.facet'];

        return this.connection.manager
            .findOne(Facet, facetId, { relations })
            .then((facet) => facet && translateDeep(facet, lang, ['values', ['values', 'facet']]));
    }

    findByCode(facetCode: string, lang: LanguageCode): Promise<Translated<Facet> | undefined> {
        const relations = ['values', 'values.facet'];
        return this.connection
            .getRepository(Facet)
            .findOne({
                where: {
                    code: facetCode,
                },
                relations,
            })
            .then((facet) => facet && translateDeep(facet, lang, ['values', ['values', 'facet']]));
    }

    async create(input: CreateFacetInput): Promise<Translated<Facet>> {
        const facet = await this.translatableSaver.create({
            input,
            entityType: Facet,
            translationType: FacetTranslation,
        });
        return assertFound(this.findOne(facet.id, this.configService.defaultLanguageCode));
    }

    async update(input: UpdateFacetInput): Promise<Translated<Facet>> {
        const facet = await this.translatableSaver.update({
            input,
            entityType: Facet,
            translationType: FacetTranslation,
        });
        return assertFound(this.findOne(facet.id, this.configService.defaultLanguageCode));
    }

    async delete(ctx: RequestContext, id: ID, force: boolean = false): Promise<DeletionResponse> {
        const facet = await getEntityOrThrow(this.connection, Facet, id, { relations: ['values'] });
        let productCount = 0;
        let variantCount = 0;
        if (facet.values.length) {
            const counts = await this.facetValueService.checkFacetValueUsage(facet.values.map((fv) => fv.id));
            productCount = counts.productCount;
            variantCount = counts.variantCount;
        }

        const isInUse = !!(productCount || variantCount);
        const both = !!(productCount && variantCount) ? 'both' : 'single';
        const i18nVars = { products: productCount, variants: variantCount, both };
        let message = '';
        let result: DeletionResult;

        if (!isInUse) {
            await this.connection.getRepository(Facet).remove(facet);
            result = DeletionResult.DELETED;
        } else if (force) {
            await this.connection.getRepository(Facet).remove(facet);
            message = ctx.translate('message.facet-force-deleted', i18nVars);
            result = DeletionResult.DELETED;
        } else {
            message = ctx.translate('message.facet-used', i18nVars);
            result = DeletionResult.NOT_DELETED;
        }

        return {
            result,
            message,
        };
    }
}
