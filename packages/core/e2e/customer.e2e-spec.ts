import { OnModuleInit } from '@nestjs/common';
import { omit } from '@vendure/common/lib/omit';
import {
    AccountRegistrationEvent,
    EventBus,
    EventBusModule,
    mergeConfig,
    VendurePlugin,
} from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import path from 'path';

import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';

import { CUSTOMER_FRAGMENT } from './graphql/fragments';
import {
    CreateAddress,
    CreateCustomer,
    DeleteCustomer,
    DeleteCustomerAddress,
    DeletionResult,
    GetCustomer,
    GetCustomerList,
    GetCustomerOrders,
    GetCustomerWithUser,
    UpdateAddress,
    UpdateCustomer,
} from './graphql/generated-e2e-admin-types';
import { AddItemToOrder } from './graphql/generated-e2e-shop-types';
import { GET_CUSTOMER, GET_CUSTOMER_LIST } from './graphql/shared-definitions';
import { ADD_ITEM_TO_ORDER } from './graphql/shop-definitions';
import { assertThrowsWithMessage } from './utils/assert-throws-with-message';

// tslint:disable:no-non-null-assertion
let sendEmailFn: jest.Mock;

/**
 * This mock plugin simulates an EmailPlugin which would send emails
 * on the registration & password reset events.
 */
@VendurePlugin({
    imports: [EventBusModule],
})
class TestEmailPlugin implements OnModuleInit {
    constructor(private eventBus: EventBus) {}
    onModuleInit() {
        this.eventBus.ofType(AccountRegistrationEvent).subscribe(event => {
            sendEmailFn(event);
        });
    }
}

describe('Customer resolver', () => {
    const { server, adminClient, shopClient } = createTestEnvironment(
        mergeConfig(testConfig, { plugins: [TestEmailPlugin] }),
    );

    let firstCustomer: GetCustomerList.Items;
    let secondCustomer: GetCustomerList.Items;
    let thirdCustomer: GetCustomerList.Items;

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, 'fixtures/e2e-products-minimal.csv'),
            customerCount: 5,
        });
        await adminClient.asSuperAdmin();
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('customers list', async () => {
        const result = await adminClient.query<GetCustomerList.Query, GetCustomerList.Variables>(
            GET_CUSTOMER_LIST,
        );

        expect(result.customers.items.length).toBe(5);
        expect(result.customers.totalItems).toBe(5);
        firstCustomer = result.customers.items[0];
        secondCustomer = result.customers.items[1];
        thirdCustomer = result.customers.items[2];
    });

    it('customer resolver resolves User', async () => {
        const { customer } = await adminClient.query<
            GetCustomerWithUser.Query,
            GetCustomerWithUser.Variables
        >(GET_CUSTOMER_WITH_USER, {
            id: firstCustomer.id,
        });

        expect(customer!.user).toEqual({
            id: 'T_2',
            identifier: firstCustomer.emailAddress,
            verified: true,
        });
    });

    describe('addresses', () => {
        let firstCustomerAddressIds: string[] = [];
        let firstCustomerThirdAddressId: string;

        it(
            'createCustomerAddress throws on invalid countryCode',
            assertThrowsWithMessage(
                () =>
                    adminClient.query<CreateAddress.Mutation, CreateAddress.Variables>(CREATE_ADDRESS, {
                        id: firstCustomer.id,
                        input: {
                            streetLine1: 'streetLine1',
                            countryCode: 'INVALID',
                        },
                    }),
                `The countryCode "INVALID" was not recognized`,
            ),
        );

        it('createCustomerAddress creates a new address', async () => {
            const result = await adminClient.query<CreateAddress.Mutation, CreateAddress.Variables>(
                CREATE_ADDRESS,
                {
                    id: firstCustomer.id,
                    input: {
                        fullName: 'fullName',
                        company: 'company',
                        streetLine1: 'streetLine1',
                        streetLine2: 'streetLine2',
                        city: 'city',
                        province: 'province',
                        postalCode: 'postalCode',
                        countryCode: 'GB',
                        phoneNumber: 'phoneNumber',
                        defaultShippingAddress: false,
                        defaultBillingAddress: false,
                    },
                },
            );
            expect(omit(result.createCustomerAddress, ['id'])).toEqual({
                fullName: 'fullName',
                company: 'company',
                streetLine1: 'streetLine1',
                streetLine2: 'streetLine2',
                city: 'city',
                province: 'province',
                postalCode: 'postalCode',
                country: {
                    code: 'GB',
                    name: 'United Kingdom',
                },
                phoneNumber: 'phoneNumber',
                defaultShippingAddress: false,
                defaultBillingAddress: false,
            });
        });

        it('customer query returns addresses', async () => {
            const result = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(GET_CUSTOMER, {
                id: firstCustomer.id,
            });

            expect(result.customer!.addresses!.length).toBe(2);
            firstCustomerAddressIds = result.customer!.addresses!.map(a => a.id).sort();
        });

        it('updateCustomerAddress updates the country', async () => {
            const result = await adminClient.query<UpdateAddress.Mutation, UpdateAddress.Variables>(
                UPDATE_ADDRESS,
                {
                    input: {
                        id: firstCustomerAddressIds[0],
                        countryCode: 'AT',
                    },
                },
            );
            expect(result.updateCustomerAddress.country).toEqual({
                code: 'AT',
                name: 'Austria',
            });
        });

        it('updateCustomerAddress allows only a single default address', async () => {
            // set the first customer's second address to be default
            const result1 = await adminClient.query<UpdateAddress.Mutation, UpdateAddress.Variables>(
                UPDATE_ADDRESS,
                {
                    input: {
                        id: firstCustomerAddressIds[1],
                        defaultShippingAddress: true,
                        defaultBillingAddress: true,
                    },
                },
            );
            expect(result1.updateCustomerAddress.defaultShippingAddress).toBe(true);
            expect(result1.updateCustomerAddress.defaultBillingAddress).toBe(true);

            // assert the first customer's other addresse is not default
            const result2 = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(GET_CUSTOMER, {
                id: firstCustomer.id,
            });
            const otherAddress = result2.customer!.addresses!.filter(
                a => a.id !== firstCustomerAddressIds[1],
            )[0]!;
            expect(otherAddress.defaultShippingAddress).toBe(false);
            expect(otherAddress.defaultBillingAddress).toBe(false);

            // set the first customer's first address to be default
            const result3 = await adminClient.query<UpdateAddress.Mutation, UpdateAddress.Variables>(
                UPDATE_ADDRESS,
                {
                    input: {
                        id: firstCustomerAddressIds[0],
                        defaultShippingAddress: true,
                        defaultBillingAddress: true,
                    },
                },
            );
            expect(result3.updateCustomerAddress.defaultShippingAddress).toBe(true);
            expect(result3.updateCustomerAddress.defaultBillingAddress).toBe(true);

            // assert the first customer's second address is not default
            const result4 = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(GET_CUSTOMER, {
                id: firstCustomer.id,
            });
            const otherAddress2 = result4.customer!.addresses!.filter(
                a => a.id !== firstCustomerAddressIds[0],
            )[0]!;
            expect(otherAddress2.defaultShippingAddress).toBe(false);
            expect(otherAddress2.defaultBillingAddress).toBe(false);

            // get the second customer's address id
            const result5 = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(GET_CUSTOMER, {
                id: secondCustomer.id,
            });
            const secondCustomerAddressId = result5.customer!.addresses![0].id;

            // set the second customer's address to be default
            const result6 = await adminClient.query<UpdateAddress.Mutation, UpdateAddress.Variables>(
                UPDATE_ADDRESS,
                {
                    input: {
                        id: secondCustomerAddressId,
                        defaultShippingAddress: true,
                        defaultBillingAddress: true,
                    },
                },
            );
            expect(result6.updateCustomerAddress.defaultShippingAddress).toBe(true);
            expect(result6.updateCustomerAddress.defaultBillingAddress).toBe(true);

            // assets the first customer's address defaults are unchanged
            const result7 = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(GET_CUSTOMER, {
                id: firstCustomer.id,
            });
            expect(result7.customer!.addresses![0].defaultShippingAddress).toBe(true);
            expect(result7.customer!.addresses![0].defaultBillingAddress).toBe(true);
            expect(result7.customer!.addresses![1].defaultShippingAddress).toBe(false);
            expect(result7.customer!.addresses![1].defaultBillingAddress).toBe(false);
        });

        it('createCustomerAddress with true defaults unsets existing defaults', async () => {
            const { createCustomerAddress } = await adminClient.query<
                CreateAddress.Mutation,
                CreateAddress.Variables
            >(CREATE_ADDRESS, {
                id: firstCustomer.id,
                input: {
                    streetLine1: 'new default streetline',
                    countryCode: 'GB',
                    defaultShippingAddress: true,
                    defaultBillingAddress: true,
                },
            });
            expect(omit(createCustomerAddress, ['id'])).toEqual({
                fullName: '',
                company: '',
                streetLine1: 'new default streetline',
                streetLine2: '',
                city: '',
                province: '',
                postalCode: '',
                country: {
                    code: 'GB',
                    name: 'United Kingdom',
                },
                phoneNumber: '',
                defaultShippingAddress: true,
                defaultBillingAddress: true,
            });

            const { customer } = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(
                GET_CUSTOMER,
                {
                    id: firstCustomer.id,
                },
            );
            for (const address of customer!.addresses!) {
                const shouldBeDefault = address.id === createCustomerAddress.id;
                expect(address.defaultShippingAddress).toEqual(shouldBeDefault);
                expect(address.defaultBillingAddress).toEqual(shouldBeDefault);
            }

            firstCustomerThirdAddressId = createCustomerAddress.id;
        });

        it('deleteCustomerAddress on default address resets defaults', async () => {
            const { deleteCustomerAddress } = await adminClient.query<
                DeleteCustomerAddress.Mutation,
                DeleteCustomerAddress.Variables
            >(
                gql`
                    mutation DeleteCustomerAddress($id: ID!) {
                        deleteCustomerAddress(id: $id)
                    }
                `,
                { id: firstCustomerThirdAddressId },
            );

            expect(deleteCustomerAddress).toBe(true);

            const { customer } = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(
                GET_CUSTOMER,
                {
                    id: firstCustomer.id,
                },
            );
            expect(customer!.addresses!.length).toBe(2);
            const defaultAddress = customer!.addresses!.filter(
                a => a.defaultBillingAddress && a.defaultShippingAddress,
            );
            const otherAddress = customer!.addresses!.filter(
                a => !a.defaultBillingAddress && !a.defaultShippingAddress,
            );
            expect(defaultAddress.length).toBe(1);
            expect(otherAddress.length).toBe(1);
        });
    });

    describe('orders', () => {
        it(`lists that user\'s orders`, async () => {
            // log in as first customer
            await shopClient.asUserWithCredentials(firstCustomer.emailAddress, 'test');
            // add an item to the order to create an order
            const { addItemToOrder } = await shopClient.query<
                AddItemToOrder.Mutation,
                AddItemToOrder.Variables
            >(ADD_ITEM_TO_ORDER, {
                productVariantId: 'T_1',
                quantity: 1,
            });

            const { customer } = await adminClient.query<
                GetCustomerOrders.Query,
                GetCustomerOrders.Variables
            >(GET_CUSTOMER_ORDERS, { id: firstCustomer.id });

            expect(customer!.orders.totalItems).toBe(1);
            expect(customer!.orders.items[0].id).toBe(addItemToOrder!.id);
        });
    });

    describe('creation', () => {
        it('triggers verification event if no password supplied', async () => {
            sendEmailFn = jest.fn();
            const { createCustomer } = await adminClient.query<
                CreateCustomer.Mutation,
                CreateCustomer.Variables
            >(CREATE_CUSTOMER, {
                input: {
                    emailAddress: 'test1@test.com',
                    firstName: 'New',
                    lastName: 'Customer',
                },
            });

            expect(createCustomer.user!.verified).toBe(false);
            expect(sendEmailFn).toHaveBeenCalledTimes(1);
            expect(sendEmailFn.mock.calls[0][0] instanceof AccountRegistrationEvent).toBe(true);
            expect(sendEmailFn.mock.calls[0][0].user.identifier).toBe('test1@test.com');
        });

        it('creates a verified Customer', async () => {
            sendEmailFn = jest.fn();
            const { createCustomer } = await adminClient.query<
                CreateCustomer.Mutation,
                CreateCustomer.Variables
            >(CREATE_CUSTOMER, {
                input: {
                    emailAddress: 'test2@test.com',
                    firstName: 'New',
                    lastName: 'Customer',
                },
                password: 'test',
            });

            expect(createCustomer.user!.verified).toBe(true);
            expect(sendEmailFn).toHaveBeenCalledTimes(0);
        });
    });

    describe('deletion', () => {
        it('deletes a customer', async () => {
            const result = await adminClient.query<DeleteCustomer.Mutation, DeleteCustomer.Variables>(
                DELETE_CUSTOMER,
                { id: thirdCustomer.id },
            );

            expect(result.deleteCustomer).toEqual({ result: DeletionResult.DELETED });
        });

        it('cannot get a deleted customer', async () => {
            const result = await adminClient.query<GetCustomer.Query, GetCustomer.Variables>(GET_CUSTOMER, {
                id: thirdCustomer.id,
            });

            expect(result.customer).toBe(null);
        });

        it('deleted customer omitted from list', async () => {
            const result = await adminClient.query<GetCustomerList.Query, GetCustomerList.Variables>(
                GET_CUSTOMER_LIST,
            );

            expect(result.customers.items.map(c => c.id).includes(thirdCustomer.id)).toBe(false);
        });

        it(
            'updateCustomer throws for deleted customer',
            assertThrowsWithMessage(
                () =>
                    adminClient.query<UpdateCustomer.Mutation, UpdateCustomer.Variables>(UPDATE_CUSTOMER, {
                        input: {
                            id: thirdCustomer.id,
                            firstName: 'updated',
                        },
                    }),
                `No Customer with the id '3' could be found`,
            ),
        );

        it(
            'createCustomerAddress throws for deleted customer',
            assertThrowsWithMessage(
                () =>
                    adminClient.query<CreateAddress.Mutation, CreateAddress.Variables>(CREATE_ADDRESS, {
                        id: thirdCustomer.id,
                        input: {
                            streetLine1: 'test',
                            countryCode: 'GB',
                        },
                    }),
                `No Customer with the id '3' could be found`,
            ),
        );
    });
});

const GET_CUSTOMER_WITH_USER = gql`
    query GetCustomerWithUser($id: ID!) {
        customer(id: $id) {
            id
            user {
                id
                identifier
                verified
            }
        }
    }
`;

const CREATE_ADDRESS = gql`
    mutation CreateAddress($id: ID!, $input: CreateAddressInput!) {
        createCustomerAddress(customerId: $id, input: $input) {
            id
            fullName
            company
            streetLine1
            streetLine2
            city
            province
            postalCode
            country {
                code
                name
            }
            phoneNumber
            defaultShippingAddress
            defaultBillingAddress
        }
    }
`;

const UPDATE_ADDRESS = gql`
    mutation UpdateAddress($input: UpdateAddressInput!) {
        updateCustomerAddress(input: $input) {
            id
            defaultShippingAddress
            defaultBillingAddress
            country {
                code
                name
            }
        }
    }
`;

const GET_CUSTOMER_ORDERS = gql`
    query GetCustomerOrders($id: ID!) {
        customer(id: $id) {
            orders {
                items {
                    id
                }
                totalItems
            }
        }
    }
`;

export const CREATE_CUSTOMER = gql`
    mutation CreateCustomer($input: CreateCustomerInput!, $password: String) {
        createCustomer(input: $input, password: $password) {
            ...Customer
        }
    }
    ${CUSTOMER_FRAGMENT}
`;

export const UPDATE_CUSTOMER = gql`
    mutation UpdateCustomer($input: UpdateCustomerInput!) {
        updateCustomer(input: $input) {
            ...Customer
        }
    }
    ${CUSTOMER_FRAGMENT}
`;

const DELETE_CUSTOMER = gql`
    mutation DeleteCustomer($id: ID!) {
        deleteCustomer(id: $id) {
            result
        }
    }
`;
