import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { DeleteCustomerAddressMutationArgs } from '../../../../../shared/generated-shop-types';
import {
    CreateCustomerAddressMutationArgs,
    Permission,
    UpdateCustomerAddressMutationArgs,
    UpdateCustomerMutationArgs,
} from '../../../../../shared/generated-types';
import { ForbiddenError, InternalServerError } from '../../../common/error/errors';
import { idsAreEqual } from '../../../common/utils';
import { Address, Customer } from '../../../entity';
import { CustomerService } from '../../../service/services/customer.service';
import { RequestContext } from '../../common/request-context';
import { Allow } from '../../decorators/allow.decorator';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver()
export class ShopCustomerResolver {
    constructor(private customerService: CustomerService) {}

    @Query()
    @Allow(Permission.Owner)
    async activeCustomer(@Ctx() ctx: RequestContext): Promise<Customer | undefined> {
        const user = ctx.activeUser;
        if (user) {
            const customer = await this.customerService.findOneByUserId(user.id);
            if (customer) {
                return customer;
            }
            // the user is not a Customer, so it must
            // be an administrator. In this case we need to return
            // a "dummy" Customer for the admin user.
            return new Customer({
                id: user.id,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                firstName: '[admin]',
                lastName: user.identifier,
                emailAddress: 'admin@vendure.io',
                addresses: [],
            });
        }
    }

    @Mutation()
    @Allow(Permission.Owner)
    async updateCustomer(
        @Ctx() ctx: RequestContext,
        @Args() args: UpdateCustomerMutationArgs,
    ): Promise<Customer> {
        const customer = await this.getCustomerForOwner(ctx);
        return this.customerService.update({
            id: customer.id,
            ...args.input,
        });
    }

    @Mutation()
    @Allow(Permission.Owner)
    async createCustomerAddress(
        @Ctx() ctx: RequestContext,
        @Args() args: CreateCustomerAddressMutationArgs,
    ): Promise<Address> {
        const customer = await this.getCustomerForOwner(ctx);
        return this.customerService.createAddress(ctx, customer.id as string, args.input);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async updateCustomerAddress(
        @Ctx() ctx: RequestContext,
        @Args() args: UpdateCustomerAddressMutationArgs,
    ): Promise<Address> {
        const customer = await this.getCustomerForOwner(ctx);
        const customerAddresses = await this.customerService.findAddressesByCustomerId(ctx, customer.id);
        if (!customerAddresses.find(address => idsAreEqual(address.id, args.input.id))) {
            throw new ForbiddenError();
        }
        return this.customerService.updateAddress(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.Owner)
    async deleteCustomerAddress(
        @Ctx() ctx: RequestContext,
        @Args() args: DeleteCustomerAddressMutationArgs,
    ): Promise<boolean> {
        const customer = await this.getCustomerForOwner(ctx);
        const customerAddresses = await this.customerService.findAddressesByCustomerId(ctx, customer.id);
        if (!customerAddresses.find(address => idsAreEqual(address.id, args.id))) {
            throw new ForbiddenError();
        }
        return this.customerService.deleteAddress(args.id);
    }

    /**
     * Returns the Customer entity associated with the current user.
     */
    private async getCustomerForOwner(ctx: RequestContext): Promise<Customer> {
        const userId = ctx.activeUserId;
        if (!userId) {
            throw new ForbiddenError();
        }
        const customer = await this.customerService.findOneByUserId(userId);
        if (!customer) {
            throw new InternalServerError(`error.no-customer-found-for-current-user`);
        }
        return customer;
    }
}
