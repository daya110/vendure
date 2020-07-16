import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { ID } from '@vendure/common/lib/shared-types';
import { Connection } from 'typeorm';

import { ApiType } from '../../api/common/get-api-type';
import { RequestContext } from '../../api/common/request-context';
import { InternalServerError, NotVerifiedError, UnauthorizedError } from '../../common/error/errors';
import { AuthenticationStrategy } from '../../config/auth/authentication-strategy';
import {
    NATIVE_AUTH_STRATEGY_NAME,
    NativeAuthenticationData,
    NativeAuthenticationStrategy,
} from '../../config/auth/native-authentication-strategy';
import { ConfigService } from '../../config/config.service';
import { AuthenticatedSession } from '../../entity/session/authenticated-session.entity';
import { User } from '../../entity/user/user.entity';
import { EventBus } from '../../event-bus/event-bus';
import { AttemptedLoginEvent } from '../../event-bus/events/attempted-login-event';
import { LoginEvent } from '../../event-bus/events/login-event';
import { LogoutEvent } from '../../event-bus/events/logout-event';

import { SessionService } from './session.service';

/**
 * The AuthService manages both authenticated and anonymous Sessions.
 */
@Injectable()
export class AuthService {
    constructor(
        @InjectConnection() private connection: Connection,
        private configService: ConfigService,
        private sessionService: SessionService,
        private eventBus: EventBus,
    ) {}

    /**
     * Authenticates a user's credentials and if okay, creates a new session.
     */
    async authenticate(
        ctx: RequestContext,
        apiType: ApiType,
        authenticationMethod: string,
        authenticationData: any,
    ): Promise<AuthenticatedSession> {
        this.eventBus.publish(
            new AttemptedLoginEvent(
                ctx,
                authenticationMethod,
                authenticationMethod === NATIVE_AUTH_STRATEGY_NAME
                    ? (authenticationData as NativeAuthenticationData).username
                    : undefined,
            ),
        );
        const authenticationStrategy = this.getAuthenticationStrategy(apiType, authenticationMethod);
        const user = await authenticationStrategy.authenticate(ctx, authenticationData);
        if (!user) {
            throw new UnauthorizedError();
        }
        return this.createAuthenticatedSessionForUser(ctx, user, authenticationStrategy.name);
    }

    async createAuthenticatedSessionForUser(
        ctx: RequestContext,
        user: User,
        authenticationStrategyName: string,
    ): Promise<AuthenticatedSession> {
        if (!user.roles || !user.roles[0]?.channels) {
            const userWithRoles = await this.connection
                .getRepository(User)
                .createQueryBuilder('user')
                .leftJoinAndSelect('user.roles', 'role')
                .leftJoinAndSelect('role.channels', 'channel')
                .where('user.id = :userId', { userId: user.id })
                .getOne();
            user.roles = userWithRoles?.roles || [];
        }

        if (this.configService.authOptions.requireVerification && !user.verified) {
            throw new NotVerifiedError();
        }
        if (ctx.session && ctx.session.activeOrderId) {
            await this.sessionService.deleteSessionsByActiveOrderId(ctx.session.activeOrderId);
        }
        user.lastLogin = new Date();
        await this.connection.manager.save(user, { reload: false });
        const session = await this.sessionService.createNewAuthenticatedSession(
            ctx,
            user,
            authenticationStrategyName,
        );
        this.eventBus.publish(new LoginEvent(ctx, user));
        return session;
    }

    /**
     * Verify the provided password against the one we have for the given user.
     */
    async verifyUserPassword(userId: ID, password: string): Promise<boolean> {
        const nativeAuthenticationStrategy = this.getAuthenticationStrategy(
            'shop',
            NATIVE_AUTH_STRATEGY_NAME,
        );
        const passwordMatches = await nativeAuthenticationStrategy.verifyUserPassword(userId, password);
        if (!passwordMatches) {
            throw new UnauthorizedError();
        }
        return true;
    }

    /**
     * Deletes all sessions for the user associated with the given session token.
     */
    async destroyAuthenticatedSession(ctx: RequestContext, sessionToken: string): Promise<void> {
        const session = await this.connection.getRepository(AuthenticatedSession).findOne({
            where: { token: sessionToken },
            relations: ['user', 'user.authenticationMethods'],
        });

        if (session) {
            const authenticationStrategy = this.getAuthenticationStrategy(
                ctx.apiType,
                session.authenticationStrategy,
            );
            if (typeof authenticationStrategy.onLogOut === 'function') {
                await authenticationStrategy.onLogOut(session.user);
            }
            this.eventBus.publish(new LogoutEvent(ctx));
            return this.sessionService.deleteSessionsByUser(session.user);
        }
    }

    private getAuthenticationStrategy(
        apiType: ApiType,
        method: typeof NATIVE_AUTH_STRATEGY_NAME,
    ): NativeAuthenticationStrategy;
    private getAuthenticationStrategy(apiType: ApiType, method: string): AuthenticationStrategy;
    private getAuthenticationStrategy(apiType: ApiType, method: string): AuthenticationStrategy {
        const { authOptions } = this.configService;
        const strategies =
            apiType === 'admin'
                ? authOptions.adminAuthenticationStrategy
                : authOptions.shopAuthenticationStrategy;
        const match = strategies.find((s) => s.name === method);
        if (!match) {
            throw new InternalServerError('error.unrecognized-authentication-strategy', { name: method });
        }
        return match;
    }
}
