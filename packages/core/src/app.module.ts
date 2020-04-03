import {
    MiddlewareConsumer,
    Module,
    NestModule,
    OnApplicationBootstrap,
    OnApplicationShutdown,
    OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import cookieSession = require('cookie-session');
import { RequestHandler } from 'express';

import { ApiModule } from './api/api.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { Logger } from './config/logger/vendure-logger';
import { I18nModule } from './i18n/i18n.module';
import { I18nService } from './i18n/i18n.service';
import { PluginModule } from './plugin/plugin.module';
import { ProcessContextModule } from './process-context/process-context.module';

@Module({
    imports: [ConfigModule, I18nModule, ApiModule, PluginModule.forRoot(), ProcessContextModule.forRoot()],
})
export class AppModule implements NestModule, OnApplicationBootstrap, OnApplicationShutdown {
    constructor(
        private configService: ConfigService,
        private i18nService: I18nService,
        private moduleRef: ModuleRef,
    ) {}

    async onApplicationBootstrap() {
        const { jobQueueStrategy } = this.configService.jobQueueOptions;
        if (typeof jobQueueStrategy.init === 'function') {
            await jobQueueStrategy.init(this.moduleRef);
        }
    }

    configure(consumer: MiddlewareConsumer) {
        const { adminApiPath, shopApiPath } = this.configService;
        const i18nextHandler = this.i18nService.handle();
        const defaultMiddleware: Array<{ handler: RequestHandler; route?: string }> = [
            { handler: i18nextHandler, route: adminApiPath },
            { handler: i18nextHandler, route: shopApiPath },
        ];
        if (this.configService.authOptions.tokenMethod === 'cookie') {
            const cookieHandler = cookieSession({
                name: 'session',
                secret: this.configService.authOptions.sessionSecret,
                httpOnly: true,
            });
            defaultMiddleware.push({ handler: cookieHandler, route: adminApiPath });
            defaultMiddleware.push({ handler: cookieHandler, route: shopApiPath });
        }
        const allMiddleware = defaultMiddleware.concat(this.configService.middleware);
        const middlewareByRoute = this.groupMiddlewareByRoute(allMiddleware);
        for (const [route, handlers] of Object.entries(middlewareByRoute)) {
            consumer.apply(...handlers).forRoutes(route);
        }
    }

    async onApplicationShutdown(signal?: string) {
        const { jobQueueStrategy } = this.configService.jobQueueOptions;
        if (typeof jobQueueStrategy.destroy === 'function') {
            await jobQueueStrategy.destroy();
        }
        if (signal) {
            Logger.info('Received shutdown signal:' + signal);
        }
    }

    /**
     * Groups middleware handlers together in an object with the route as the key.
     */
    private groupMiddlewareByRoute(
        middlewareArray: Array<{ handler: RequestHandler; route?: string }>,
    ): { [route: string]: RequestHandler[] } {
        const result = {} as { [route: string]: RequestHandler[] };
        for (const middleware of middlewareArray) {
            const route = middleware.route || this.configService.adminApiPath;
            if (!result[route]) {
                result[route] = [];
            }
            result[route].push(middleware.handler);
        }
        return result;
    }
}
