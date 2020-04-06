import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import {
    CreateGroupOptionInput,
    CreateProductOptionInput,
    UpdateProductOptionInput,
} from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';
import { Connection } from 'typeorm';

import { RequestContext } from '../../api/common/request-context';
import { Translated } from '../../common/types/locale-types';
import { assertFound } from '../../common/utils';
import { ProductOptionGroup } from '../../entity/product-option-group/product-option-group.entity';
import { ProductOptionTranslation } from '../../entity/product-option/product-option-translation.entity';
import { ProductOption } from '../../entity/product-option/product-option.entity';
import { TranslatableSaver } from '../helpers/translatable-saver/translatable-saver';
import { getEntityOrThrow } from '../helpers/utils/get-entity-or-throw';
import { translateDeep } from '../helpers/utils/translate-entity';

@Injectable()
export class ProductOptionService {
    constructor(
        @InjectConnection() private connection: Connection,
        private translatableSaver: TranslatableSaver,
    ) {}

    findAll(ctx: RequestContext): Promise<Array<Translated<ProductOption>>> {
        return this.connection.manager
            .find(ProductOption, {
                relations: ['group'],
            })
            .then((options) => options.map((option) => translateDeep(option, ctx.languageCode)));
    }

    findOne(ctx: RequestContext, id: ID): Promise<Translated<ProductOption> | undefined> {
        return this.connection.manager
            .findOne(ProductOption, id, {
                relations: ['group'],
            })
            .then((option) => option && translateDeep(option, ctx.languageCode));
    }

    async create(
        ctx: RequestContext,
        group: ProductOptionGroup | ID,
        input: CreateGroupOptionInput | CreateProductOptionInput,
    ): Promise<Translated<ProductOption>> {
        const productOptionGroup =
            group instanceof ProductOptionGroup
                ? group
                : await getEntityOrThrow(this.connection, ProductOptionGroup, group);
        const option = await this.translatableSaver.create({
            input,
            entityType: ProductOption,
            translationType: ProductOptionTranslation,
            beforeSave: (po) => (po.group = productOptionGroup),
        });
        return assertFound(this.findOne(ctx, option.id));
    }

    async update(ctx: RequestContext, input: UpdateProductOptionInput): Promise<Translated<ProductOption>> {
        const option = await this.translatableSaver.update({
            input,
            entityType: ProductOption,
            translationType: ProductOptionTranslation,
        });
        return assertFound(this.findOne(ctx, option.id));
    }
}
