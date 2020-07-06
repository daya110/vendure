import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Permission } from '@vendure/common/lib/generated-types';

import { Translated } from '../../../common/types/locale-types';
import { assertFound } from '../../../common/utils';
import { ProductOptionGroup } from '../../../entity/product-option-group/product-option-group.entity';
import { ProductOption } from '../../../entity/product-option/product-option.entity';
import { ProductOptionGroupService } from '../../../service/services/product-option-group.service';
import { RequestContext } from '../../common/request-context';
import { Allow } from '../../decorators/allow.decorator';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver('ProductOption')
export class ProductOptionEntityResolver {
    constructor(private productOptionGroupService: ProductOptionGroupService) {}

    @ResolveField()
    @Allow(Permission.ReadCatalog, Permission.Public)
    async group(
        @Ctx() ctx: RequestContext,
        @Parent() option: Translated<ProductOption>,
    ): Promise<ProductOptionGroup> {
        if (option.group) {
            return option.group;
        }
        return assertFound(this.productOptionGroupService.findOne(ctx, option.groupId));
    }
}
