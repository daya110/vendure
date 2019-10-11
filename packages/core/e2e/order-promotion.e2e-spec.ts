/* tslint:disable:no-non-null-assertion */
import gql from 'graphql-tag';
import path from 'path';

import { pick } from '../../common/src/pick';
import {
    discountOnItemWithFacets,
    orderPercentageDiscount,
} from '../src/config/promotion/default-promotion-actions';
import { atLeastNWithFacets, minimumOrderAmount } from '../src/config/promotion/default-promotion-conditions';

import { TEST_SETUP_TIMEOUT_MS } from './config/test-config';
import {
    CreatePromotion,
    CreatePromotionInput,
    GetFacetList,
    GetPromoProducts,
    HistoryEntryType,
} from './graphql/generated-e2e-admin-types';
import {
    AddItemToOrder,
    AdjustItemQuantity,
    ApplyCouponCode,
    GetActiveOrder,
    GetOrderPromotionsByCode,
    RemoveCouponCode,
    SetCustomerForOrder,
} from './graphql/generated-e2e-shop-types';
import { CREATE_PROMOTION, GET_FACET_LIST } from './graphql/shared-definitions';
import {
    ADD_ITEM_TO_ORDER,
    ADJUST_ITEM_QUANTITY,
    APPLY_COUPON_CODE,
    GET_ACTIVE_ORDER,
    GET_ORDER_PROMOTIONS_BY_CODE,
    REMOVE_COUPON_CODE,
    SET_CUSTOMER,
} from './graphql/shop-definitions';
import { TestAdminClient, TestShopClient } from './test-client';
import { TestServer } from './test-server';
import { assertThrowsWithMessage } from './utils/assert-throws-with-message';
import {
    addPaymentToOrder,
    proceedToArrangingPayment,
    testSuccessfulPaymentMethod,
} from './utils/test-order-utils';

describe('Promotions applied to Orders', () => {
    const adminClient = new TestAdminClient();
    const shopClient = new TestShopClient();
    const server = new TestServer();

    const freeOrderAction = {
        code: orderPercentageDiscount.code,
        arguments: [{ name: 'discount', type: 'int', value: '100' }],
    };
    const minOrderAmountCondition = (min: number) => ({
        code: minimumOrderAmount.code,
        arguments: [
            { name: 'amount', type: 'int', value: min.toString() },
            { name: 'taxInclusive', type: 'boolean', value: 'true' },
        ],
    });

    let products: GetPromoProducts.Items[];

    beforeAll(async () => {
        const token = await server.init(
            {
                productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-promotions.csv'),
                customerCount: 2,
            },
            {
                paymentOptions: {
                    paymentMethodHandlers: [testSuccessfulPaymentMethod],
                },
            },
        );
        await shopClient.init();
        await adminClient.init();

        await getProducts();
        await createGlobalPromotions();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    describe('coupon codes', () => {
        const TEST_COUPON_CODE = 'TESTCOUPON';
        const EXPIRED_COUPON_CODE = 'EXPIRED';
        let promoFreeWithCoupon: CreatePromotion.CreatePromotion;
        let promoFreeWithExpiredCoupon: CreatePromotion.CreatePromotion;

        beforeAll(async () => {
            promoFreeWithCoupon = await createPromotion({
                enabled: true,
                name: 'Free with test coupon',
                couponCode: TEST_COUPON_CODE,
                conditions: [],
                actions: [freeOrderAction],
            });
            promoFreeWithExpiredCoupon = await createPromotion({
                enabled: true,
                name: 'Expired coupon',
                endsAt: new Date(2010, 0, 0),
                couponCode: EXPIRED_COUPON_CODE,
                conditions: [],
                actions: [freeOrderAction],
            });

            await shopClient.asAnonymousUser();
            const item60 = getVariantBySlug('item-60');
            const { addItemToOrder } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: item60.id,
                quantity: 1,
            });
        });

        afterAll(async () => {
            await deletePromotion(promoFreeWithCoupon.id);
            await deletePromotion(promoFreeWithExpiredCoupon.id);
        });

        it(
            'applyCouponCode throws with nonexistant code',
            assertThrowsWithMessage(async () => {
                await shopClient.query<ApplyCouponCode.Mutation, ApplyCouponCode.Variables>(
                    APPLY_COUPON_CODE,
                    {
                        couponCode: 'bad code',
                    },
                );
            }, 'Coupon code "bad code" is not valid'),
        );

        it(
            'applyCouponCode throws with expired code',
            assertThrowsWithMessage(async () => {
                await shopClient.query<ApplyCouponCode.Mutation, ApplyCouponCode.Variables>(
                    APPLY_COUPON_CODE,
                    {
                        couponCode: EXPIRED_COUPON_CODE,
                    },
                );
            }, `Coupon code "${EXPIRED_COUPON_CODE}" has expired`),
        );

        it('applies a valid coupon code', async () => {
            const { applyCouponCode } = await shopClient.query<
                ApplyCouponCode.Mutation,
                ApplyCouponCode.Variables
            >(APPLY_COUPON_CODE, {
                couponCode: TEST_COUPON_CODE,
            });

            expect(applyCouponCode!.couponCodes).toEqual([TEST_COUPON_CODE]);
            expect(applyCouponCode!.adjustments.length).toBe(1);
            expect(applyCouponCode!.adjustments[0].description).toBe('Free with test coupon');
            expect(applyCouponCode!.total).toBe(0);
        });

        it('order history records application', async () => {
            const { activeOrder } = await shopClient.query<GetActiveOrder.Query>(GET_ACTIVE_ORDER);

            expect(activeOrder!.history.items).toEqual([
                {
                    id: 'T_1',
                    type: HistoryEntryType.ORDER_COUPON_APPLIED,
                    data: {
                        couponCode: TEST_COUPON_CODE,
                        promotionId: 'T_3',
                    },
                },
            ]);
        });

        it('de-duplicates existing codes', async () => {
            const { applyCouponCode } = await shopClient.query<
                ApplyCouponCode.Mutation,
                ApplyCouponCode.Variables
            >(APPLY_COUPON_CODE, {
                couponCode: TEST_COUPON_CODE,
            });

            expect(applyCouponCode!.couponCodes).toEqual([TEST_COUPON_CODE]);
        });

        it('removes a coupon code', async () => {
            const { removeCouponCode } = await shopClient.query<
                RemoveCouponCode.Mutation,
                RemoveCouponCode.Variables
            >(REMOVE_COUPON_CODE, {
                couponCode: TEST_COUPON_CODE,
            });

            expect(removeCouponCode!.adjustments.length).toBe(0);
            expect(removeCouponCode!.total).toBe(6000);
        });

        it('order history records removal', async () => {
            const { activeOrder } = await shopClient.query<GetActiveOrder.Query>(GET_ACTIVE_ORDER);

            expect(activeOrder!.history.items).toEqual([
                {
                    id: 'T_1',
                    type: HistoryEntryType.ORDER_COUPON_APPLIED,
                    data: {
                        couponCode: TEST_COUPON_CODE,
                        promotionId: 'T_3',
                    },
                },
                {
                    id: 'T_2',
                    type: HistoryEntryType.ORDER_COUPON_REMOVED,
                    data: {
                        couponCode: TEST_COUPON_CODE,
                    },
                },
            ]);
        });

        it('does not record removal of coupon code that was not added', async () => {
            const { removeCouponCode } = await shopClient.query<
                RemoveCouponCode.Mutation,
                RemoveCouponCode.Variables
            >(REMOVE_COUPON_CODE, {
                couponCode: 'NOT_THERE',
            });

            expect(removeCouponCode!.history.items).toEqual([
                {
                    id: 'T_1',
                    type: HistoryEntryType.ORDER_COUPON_APPLIED,
                    data: {
                        couponCode: TEST_COUPON_CODE,
                        promotionId: 'T_3',
                    },
                },
                {
                    id: 'T_2',
                    type: HistoryEntryType.ORDER_COUPON_REMOVED,
                    data: {
                        couponCode: TEST_COUPON_CODE,
                    },
                },
            ]);
        });
    });

    describe('default PromotionConditions', () => {
        beforeEach(async () => {
            await shopClient.asAnonymousUser();
        });

        it('minimumOrderAmount', async () => {
            const promotion = await createPromotion({
                enabled: true,
                name: 'Free if order total greater than 100',
                conditions: [minOrderAmountCondition(10000)],
                actions: [freeOrderAction],
            });
            const item60 = getVariantBySlug('item-60');
            const { addItemToOrder } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: item60.id,
                quantity: 1,
            });
            expect(addItemToOrder!.total).toBe(6000);
            expect(addItemToOrder!.adjustments.length).toBe(0);

            const { adjustOrderLine } = await shopClient.query<
                AdjustItemQuantity.Mutation,
                AdjustItemQuantity.Variables
            >(ADJUST_ITEM_QUANTITY, {
                orderLineId: addItemToOrder!.lines[0].id,
                quantity: 2,
            });
            expect(adjustOrderLine!.total).toBe(0);
            expect(adjustOrderLine!.adjustments[0].description).toBe('Free if order total greater than 100');
            expect(adjustOrderLine!.adjustments[0].amount).toBe(-12000);

            await deletePromotion(promotion.id);
        });

        it('atLeastNWithFacets', async () => {
            const { facets } = await adminClient.query<GetFacetList.Query>(GET_FACET_LIST);
            const saleFacetValue = facets.items[0].values[0];
            const promotion = await createPromotion({
                enabled: true,
                name: 'Free if order contains 2 items with Sale facet value',
                conditions: [
                    {
                        code: atLeastNWithFacets.code,
                        arguments: [
                            { name: 'minimum', type: 'int', value: '2' },
                            { name: 'facets', type: 'facetValueIds', value: `["${saleFacetValue.id}"]` },
                        ],
                    },
                ],
                actions: [freeOrderAction],
            });

            const itemSale1 = getVariantBySlug('item-sale-1');
            const itemSale12 = getVariantBySlug('item-sale-12');
            const { addItemToOrder: res1 } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: itemSale1.id,
                quantity: 1,
            });
            expect(res1!.total).toBe(120);
            expect(res1!.adjustments.length).toBe(0);

            const { addItemToOrder: res2 } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: itemSale12.id,
                quantity: 1,
            });
            expect(res2!.total).toBe(0);
            expect(res2!.adjustments.length).toBe(1);
            expect(res2!.total).toBe(0);
            expect(res2!.adjustments[0].description).toBe(
                'Free if order contains 2 items with Sale facet value',
            );
            expect(res2!.adjustments[0].amount).toBe(-1320);

            await deletePromotion(promotion.id);
        });
    });

    describe('default PromotionActions', () => {
        beforeEach(async () => {
            await shopClient.asAnonymousUser();
        });

        it('orderPercentageDiscount', async () => {
            const couponCode = '50%_off_order';
            const promotion = await createPromotion({
                enabled: true,
                name: '50% discount on order',
                couponCode,
                conditions: [],
                actions: [
                    {
                        code: orderPercentageDiscount.code,
                        arguments: [{ name: 'discount', type: 'int', value: '50' }],
                    },
                ],
            });
            const item60 = getVariantBySlug('item-60');
            const { addItemToOrder } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: item60.id,
                quantity: 1,
            });
            expect(addItemToOrder!.total).toBe(6000);
            expect(addItemToOrder!.adjustments.length).toBe(0);

            const { applyCouponCode } = await shopClient.query<
                ApplyCouponCode.Mutation,
                ApplyCouponCode.Variables
            >(APPLY_COUPON_CODE, {
                couponCode,
            });

            expect(applyCouponCode!.adjustments.length).toBe(1);
            expect(applyCouponCode!.adjustments[0].description).toBe('50% discount on order');
            expect(applyCouponCode!.total).toBe(3000);

            await deletePromotion(promotion.id);
        });

        it('discountOnItemWithFacets', async () => {
            const { facets } = await adminClient.query<GetFacetList.Query>(GET_FACET_LIST);
            const saleFacetValue = facets.items[0].values[0];
            const couponCode = '50%_off_sale_items';
            const promotion = await createPromotion({
                enabled: true,
                name: '50% off sale items',
                couponCode,
                conditions: [],
                actions: [
                    {
                        code: discountOnItemWithFacets.code,
                        arguments: [
                            { name: 'discount', type: 'int', value: '50' },
                            { name: 'facets', type: 'facetValueIds', value: `["${saleFacetValue.id}"]` },
                        ],
                    },
                ],
            });
            await shopClient.query<AddItemToOrder.Mutation, AddItemToOrder.Variables>(ADD_ITEM_TO_ORDER, {
                productVariantId: getVariantBySlug('item-12').id,
                quantity: 1,
            });
            await shopClient.query<AddItemToOrder.Mutation, AddItemToOrder.Variables>(ADD_ITEM_TO_ORDER, {
                productVariantId: getVariantBySlug('item-sale-12').id,
                quantity: 1,
            });
            const { addItemToOrder } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: getVariantBySlug('item-sale-1').id,
                quantity: 2,
            });
            expect(addItemToOrder!.adjustments.length).toBe(0);
            expect(addItemToOrder!.total).toBe(2640);

            const { applyCouponCode } = await shopClient.query<
                ApplyCouponCode.Mutation,
                ApplyCouponCode.Variables
            >(APPLY_COUPON_CODE, {
                couponCode,
            });

            expect(applyCouponCode!.total).toBe(1920);

            await deletePromotion(promotion.id);
        });
    });

    describe('per-customer usage limit', () => {
        const TEST_COUPON_CODE = 'TESTCOUPON';
        let promoWithUsageLimit: CreatePromotion.CreatePromotion;

        beforeAll(async () => {
            promoWithUsageLimit = await createPromotion({
                enabled: true,
                name: 'Free with test coupon',
                couponCode: TEST_COUPON_CODE,
                perCustomerUsageLimit: 1,
                conditions: [],
                actions: [freeOrderAction],
            });
        });

        afterAll(async () => {
            await deletePromotion(promoWithUsageLimit.id);
        });

        async function createNewActiveOrder() {
            const item60 = getVariantBySlug('item-60');
            const { addItemToOrder } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: item60.id,
                quantity: 1,
            });
            return addItemToOrder;
        }

        describe('guest customer', () => {
            const GUEST_EMAIL_ADDRESS = 'guest@test.com';
            let orderCode: string;

            function addGuestCustomerToOrder() {
                return shopClient.query<SetCustomerForOrder.Mutation, SetCustomerForOrder.Variables>(
                    SET_CUSTOMER,
                    {
                        input: {
                            emailAddress: GUEST_EMAIL_ADDRESS,
                            firstName: 'Guest',
                            lastName: 'Customer',
                        },
                    },
                );
            }

            it('allows initial usage', async () => {
                await shopClient.asAnonymousUser();
                await createNewActiveOrder();
                await addGuestCustomerToOrder();

                const { applyCouponCode } = await shopClient.query<
                    ApplyCouponCode.Mutation,
                    ApplyCouponCode.Variables
                >(APPLY_COUPON_CODE, { couponCode: TEST_COUPON_CODE });

                expect(applyCouponCode!.total).toBe(0);
                expect(applyCouponCode!.couponCodes).toEqual([TEST_COUPON_CODE]);

                await proceedToArrangingPayment(shopClient);
                const order = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
                expect(order.state).toBe('PaymentSettled');
                expect(order.active).toBe(false);
                orderCode = order.code;
            });

            it('adds Promotions to Order once payment arranged', async () => {
                const { orderByCode } = await shopClient.query<
                    GetOrderPromotionsByCode.Query,
                    GetOrderPromotionsByCode.Variables
                >(GET_ORDER_PROMOTIONS_BY_CODE, {
                    code: orderCode,
                });
                expect(orderByCode!.promotions.map(pick(['id', 'name']))).toEqual([
                    { id: 'T_9', name: 'Free with test coupon' },
                ]);
            });

            it('throws when usage exceeds limit', async () => {
                await shopClient.asAnonymousUser();
                await createNewActiveOrder();
                await addGuestCustomerToOrder();

                try {
                    await shopClient.query<ApplyCouponCode.Mutation, ApplyCouponCode.Variables>(
                        APPLY_COUPON_CODE,
                        { couponCode: TEST_COUPON_CODE },
                    );
                    fail('should have thrown');
                } catch (err) {
                    expect(err.message).toEqual(
                        expect.stringContaining('Coupon code cannot be used more than once per customer'),
                    );
                }
            });

            it('removes couponCode from order when adding customer after code applied', async () => {
                await shopClient.asAnonymousUser();
                await createNewActiveOrder();

                const { applyCouponCode } = await shopClient.query<
                    ApplyCouponCode.Mutation,
                    ApplyCouponCode.Variables
                >(APPLY_COUPON_CODE, { couponCode: TEST_COUPON_CODE });

                expect(applyCouponCode!.total).toBe(0);
                expect(applyCouponCode!.couponCodes).toEqual([TEST_COUPON_CODE]);

                await addGuestCustomerToOrder();

                const { activeOrder } = await shopClient.query<GetActiveOrder.Query>(GET_ACTIVE_ORDER);
                expect(activeOrder!.couponCodes).toEqual([]);
                expect(activeOrder!.total).toBe(6000);
            });
        });

        describe('signed-in customer', () => {
            function logInAsRegisteredCustomer() {
                return shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
            }

            it('allows initial usage', async () => {
                await logInAsRegisteredCustomer();
                await createNewActiveOrder();
                const { applyCouponCode } = await shopClient.query<
                    ApplyCouponCode.Mutation,
                    ApplyCouponCode.Variables
                >(APPLY_COUPON_CODE, { couponCode: TEST_COUPON_CODE });

                expect(applyCouponCode!.total).toBe(0);
                expect(applyCouponCode!.couponCodes).toEqual([TEST_COUPON_CODE]);

                await proceedToArrangingPayment(shopClient);
                const order = await addPaymentToOrder(shopClient, testSuccessfulPaymentMethod);
                expect(order.state).toBe('PaymentSettled');
                expect(order.active).toBe(false);
            });

            it('throws when usage exceeds limit', async () => {
                await logInAsRegisteredCustomer();
                await createNewActiveOrder();
                try {
                    await shopClient.query<ApplyCouponCode.Mutation, ApplyCouponCode.Variables>(
                        APPLY_COUPON_CODE,
                        { couponCode: TEST_COUPON_CODE },
                    );
                    fail('should have thrown');
                } catch (err) {
                    expect(err.message).toEqual(
                        expect.stringContaining('Coupon code cannot be used more than once per customer'),
                    );
                }
            });

            it('removes couponCode from order when logging in after code applied', async () => {
                await shopClient.asAnonymousUser();
                await createNewActiveOrder();
                const { applyCouponCode } = await shopClient.query<
                    ApplyCouponCode.Mutation,
                    ApplyCouponCode.Variables
                >(APPLY_COUPON_CODE, { couponCode: TEST_COUPON_CODE });

                expect(applyCouponCode!.couponCodes).toEqual([TEST_COUPON_CODE]);
                expect(applyCouponCode!.total).toBe(0);

                await logInAsRegisteredCustomer();

                const { activeOrder } = await shopClient.query<GetActiveOrder.Query>(GET_ACTIVE_ORDER);
                expect(activeOrder!.total).toBe(6000);
                expect(activeOrder!.couponCodes).toEqual([]);
            });
        });
    });

    async function getProducts() {
        const result = await adminClient.query<GetPromoProducts.Query>(GET_PROMO_PRODUCTS, {
            options: {
                take: 10,
                skip: 0,
            },
        });
        products = result.products.items;
    }
    async function createGlobalPromotions() {
        const { facets } = await adminClient.query<GetFacetList.Query>(GET_FACET_LIST);
        const saleFacetValue = facets.items[0].values[0];
        await createPromotion({
            enabled: true,
            name: 'Promo not yet started',
            startsAt: new Date(2199, 0, 0),
            conditions: [minOrderAmountCondition(100)],
            actions: [freeOrderAction],
        });

        const deletedPromotion = await createPromotion({
            enabled: true,
            name: 'Deleted promotion',
            conditions: [minOrderAmountCondition(100)],
            actions: [freeOrderAction],
        });
        await deletePromotion(deletedPromotion.id);
    }

    async function createPromotion(input: CreatePromotionInput): Promise<CreatePromotion.CreatePromotion> {
        const result = await adminClient.query<CreatePromotion.Mutation, CreatePromotion.Variables>(
            CREATE_PROMOTION,
            {
                input,
            },
        );
        return result.createPromotion;
    }

    function getVariantBySlug(
        slug: 'item-1' | 'item-12' | 'item-60' | 'item-sale-1' | 'item-sale-12',
    ): GetPromoProducts.Variants {
        return products.find(p => p.slug === slug)!.variants[0];
    }

    async function deletePromotion(promotionId: string) {
        await adminClient.query(gql`
            mutation DeletePromotionAdHoc1 {
                deletePromotion(id: "${promotionId}") {
                    result
                }
            }
        `);
    }
});

export const GET_PROMO_PRODUCTS = gql`
    query GetPromoProducts {
        products {
            items {
                id
                slug
                variants {
                    id
                    price
                    priceWithTax
                    sku
                    facetValues {
                        id
                        code
                    }
                }
            }
        }
    }
`;
