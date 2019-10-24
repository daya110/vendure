import {
    CurrencyCode,
    PriceRange,
    SearchInput,
    SearchResponse,
    SearchResult,
} from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';
import { RequestContext, WorkerMessage } from '@vendure/core';

export type ElasticSearchInput = SearchInput & {
    priceRange?: PriceRange;
    priceRangeWithTax?: PriceRange;
};

export type ElasticSearchResponse = SearchResponse & {
    priceRange: SearchPriceData;
};

export type SearchPriceData = {
    range: PriceRange;
    rangeWithTax: PriceRange;
    buckets: PriceRangeBucket[];
    bucketsWithTax: PriceRangeBucket[];
};

export type PriceRangeBucket = {
    to: number;
    count: number;
};

export type VariantIndexItem = Omit<SearchResult, 'score' | 'price' | 'priceWithTax'> & {
    price: number;
    priceWithTax: number;
    [customMapping: string]: any;
};
export type ProductIndexItem = {
    sku: string[];
    slug: string[];
    productId: ID;
    productName: string[];
    productPreview: string;
    productVariantId: ID[];
    productVariantName: string[];
    productVariantPreview: string[];
    currencyCode: CurrencyCode;
    description: string;
    facetIds: ID[];
    facetValueIds: ID[];
    collectionIds: ID[];
    enabled: boolean;
    priceMin: number;
    priceMax: number;
    priceWithTaxMin: number;
    priceWithTaxMax: number;
    [customMapping: string]: any;
};

export type SearchHit<T> = {
    _id: string;
    _index: string;
    _score: number;
    _source: T;
    _type: string;
};

export type SearchRequestBody = {
    query?: any;
    sort?: any[];
    from?: number;
    size?: number;
    aggs?: any;
};

export type SearchResponseBody<T = any> = {
    hits: {
        hits: Array<SearchHit<T>>;
        total: {
            relation: string;
            value: number;
        };
        max_score: number;
    };
    timed_out: boolean;
    took: number;
    _shards: {
        failed: number;
        skipped: number;
        successful: number;
        total: number;
    };
    aggregations?: {
        [key: string]: {
            doc_count_error_upper_bound: 0;
            sum_other_doc_count: 89;
            buckets: Array<{ key: string; doc_count: number }>;
            value: any;
        };
    };
};

export type BulkOperationType = 'index' | 'update' | 'delete';
export type BulkOperation = { [operation in BulkOperationType]?: { _id: string } };
export type BulkOperationDoc<T> = T | { doc: T; doc_as_upsert?: boolean };
export type BulkResponseResult = {
    [operation in BulkOperationType]?: {
        _index: string;
        _type: string;
        _id: string;
        _version?: number;
        result?: string;
        _shards: {
            total: number;
            successful: number;
            failed: number;
        };
        status: number;
        _seq_no?: number;
        _primary_term?: number;
        error?: any;
    }
};
export type BulkResponseBody = {
    took: number;
    errors: boolean;
    items: BulkResponseResult[];
};

export interface ReindexMessageResponse {
    total: number;
    completed: number;
    duration: number;
}

export type UpdateProductOrVariantMessageData = {
    ctx: RequestContext;
    productId?: ID;
    variantId?: ID;
};

export interface UpdateVariantsByIdMessageData {
    ctx: RequestContext;
    ids: ID[];
}

export class ReindexMessage extends WorkerMessage<{ ctx: RequestContext }, ReindexMessageResponse> {
    static readonly pattern = 'Reindex';
}
export class UpdateProductOrVariantMessage extends WorkerMessage<UpdateProductOrVariantMessageData, boolean> {
    static readonly pattern = 'UpdateProductOrVariant';
}
export class UpdateVariantsByIdMessage extends WorkerMessage<
    UpdateVariantsByIdMessageData,
    ReindexMessageResponse
> {
    static readonly pattern = 'UpdateVariantsById';
}

type Maybe<T> = T | null | undefined;
type CustomMappingDefinition<Args extends any[], T extends string, R> = {
    graphQlType: T;
    valueFn: (...args: Args) => R;
};

type CustomStringMapping<Args extends any[]> = CustomMappingDefinition<Args, 'String!', string>;
type CustomStringMappingNullable<Args extends any[]> = CustomMappingDefinition<Args, 'String', Maybe<string>>;
type CustomIntMapping<Args extends any[]> = CustomMappingDefinition<Args, 'Int!', number>;
type CustomIntMappingNullable<Args extends any[]> = CustomMappingDefinition<Args, 'Int', Maybe<number>>;
type CustomFloatMapping<Args extends any[]> = CustomMappingDefinition<Args, 'Float!', number>;
type CustomFloatMappingNullable<Args extends any[]> = CustomMappingDefinition<Args, 'Float', Maybe<number>>;
type CustomBooleanMapping<Args extends any[]> = CustomMappingDefinition<Args, 'Boolean!', boolean>;
type CustomBooleanMappingNullable<Args extends any[]> = CustomMappingDefinition<
    Args,
    'Boolean',
    Maybe<boolean>
>;

export type CustomMapping<Args extends any[]> =
    | CustomStringMapping<Args>
    | CustomStringMappingNullable<Args>
    | CustomIntMapping<Args>
    | CustomIntMappingNullable<Args>
    | CustomFloatMapping<Args>
    | CustomFloatMappingNullable<Args>
    | CustomBooleanMapping<Args>
    | CustomBooleanMappingNullable<Args>;
