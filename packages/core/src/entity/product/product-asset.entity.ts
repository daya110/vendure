import { DeepPartial, ID } from '@vendure/common/lib/shared-types';
import { Column, Entity, ManyToOne } from 'typeorm';

import { OrderableAsset } from '../asset/orderable-asset.entity';

import { Product } from './product.entity';

@Entity()
export class ProductAsset extends OrderableAsset {
    constructor(input?: DeepPartial<ProductAsset>) {
        super(input);
    }
    @Column()
    productId: ID;

    @ManyToOne((type) => Product, (product) => product.assets, { onDelete: 'CASCADE' })
    product: Product;
}
