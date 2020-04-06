import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
    DeletionResponse,
    MutationCreateFacetArgs,
    MutationCreateFacetValuesArgs,
    MutationDeleteFacetArgs,
    MutationDeleteFacetValuesArgs,
    MutationUpdateFacetArgs,
    MutationUpdateFacetValuesArgs,
    Permission,
    QueryFacetArgs,
    QueryFacetsArgs,
} from '@vendure/common/lib/generated-types';
import { PaginatedList } from '@vendure/common/lib/shared-types';

import { EntityNotFoundError } from '../../../common/error/errors';
import { Translated } from '../../../common/types/locale-types';
import { ConfigService } from '../../../config/config.service';
import { FacetValue } from '../../../entity/facet-value/facet-value.entity';
import { Facet } from '../../../entity/facet/facet.entity';
import { FacetValueService } from '../../../service/services/facet-value.service';
import { FacetService } from '../../../service/services/facet.service';
import { RequestContext } from '../../common/request-context';
import { Allow } from '../../decorators/allow.decorator';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver('Facet')
export class FacetResolver {
    constructor(
        private facetService: FacetService,
        private facetValueService: FacetValueService,
        private configService: ConfigService,
    ) {}

    @Query()
    @Allow(Permission.ReadCatalog)
    facets(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryFacetsArgs,
    ): Promise<PaginatedList<Translated<Facet>>> {
        return this.facetService.findAll(ctx.languageCode, args.options || undefined);
    }

    @Query()
    @Allow(Permission.ReadCatalog)
    async facet(
        @Ctx() ctx: RequestContext,
        @Args() args: QueryFacetArgs,
    ): Promise<Translated<Facet> | undefined> {
        return this.facetService.findOne(args.id, ctx.languageCode);
    }

    @Mutation()
    @Allow(Permission.CreateCatalog)
    async createFacet(@Args() args: MutationCreateFacetArgs): Promise<Translated<Facet>> {
        const { input } = args;
        const facet = await this.facetService.create(args.input);

        if (input.values && input.values.length) {
            for (const value of input.values) {
                const newValue = await this.facetValueService.create(facet, value);
                facet.values.push(newValue);
            }
        }
        return facet;
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async updateFacet(@Args() args: MutationUpdateFacetArgs): Promise<Translated<Facet>> {
        const { input } = args;
        return this.facetService.update(args.input);
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog)
    async deleteFacet(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationDeleteFacetArgs,
    ): Promise<DeletionResponse> {
        return this.facetService.delete(ctx, args.id, args.force || false);
    }

    @Mutation()
    @Allow(Permission.CreateCatalog)
    async createFacetValues(
        @Args() args: MutationCreateFacetValuesArgs,
    ): Promise<Array<Translated<FacetValue>>> {
        const { input } = args;
        const facetId = input[0].facetId;
        const facet = await this.facetService.findOne(facetId, this.configService.defaultLanguageCode);
        if (!facet) {
            throw new EntityNotFoundError('Facet', facetId);
        }
        return Promise.all(input.map((facetValue) => this.facetValueService.create(facet, facetValue)));
    }

    @Mutation()
    @Allow(Permission.UpdateCatalog)
    async updateFacetValues(
        @Args() args: MutationUpdateFacetValuesArgs,
    ): Promise<Array<Translated<FacetValue>>> {
        const { input } = args;
        return Promise.all(input.map((facetValue) => this.facetValueService.update(facetValue)));
    }

    @Mutation()
    @Allow(Permission.DeleteCatalog)
    async deleteFacetValues(
        @Ctx() ctx: RequestContext,
        @Args() args: MutationDeleteFacetValuesArgs,
    ): Promise<DeletionResponse[]> {
        return Promise.all(args.ids.map((id) => this.facetValueService.delete(ctx, id, args.force || false)));
    }
}
