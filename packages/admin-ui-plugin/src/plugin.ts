import { DEFAULT_AUTH_TOKEN_HEADER_KEY } from '@vendure/common/lib/shared-constants';
import {
    AdminUiAppConfig,
    AdminUiAppDevModeConfig,
    AdminUiConfig,
    Type,
} from '@vendure/common/lib/shared-types';
import {
    ConfigService,
    createProxyHandler,
    LanguageCode,
    Logger,
    OnVendureBootstrap,
    OnVendureClose,
    PluginCommonModule,
    RuntimeVendureConfig,
    VendurePlugin,
} from '@vendure/core';
import express from 'express';
import fs from 'fs-extra';
import { Server } from 'http';
import path from 'path';

import { DEFAULT_APP_PATH, defaultAvailableLanguages, defaultLanguage, loggerCtx } from './constants';

/**
 * @description
 * Configuration options for the {@link AdminUiPlugin}.
 *
 * @docsCategory AdminUiPlugin
 */
export interface AdminUiPluginOptions {
    /**
     * @description
     * The port on which the server will listen. If not
     */
    port: number;
    /**
     * @description
     * The hostname of the server serving the static admin ui files.
     *
     * @default 'localhost'
     */
    hostname?: string;
    /**
     * @description
     * By default, the AdminUiPlugin comes bundles with a pre-built version of the
     * Admin UI. This option can be used to override this default build with a different
     * version, e.g. one pre-compiled with one or more ui extensions.
     */
    app?: AdminUiAppConfig | AdminUiAppDevModeConfig;
    /**
     * @description
     * The hostname of the Vendure server which the admin ui will be making API calls
     * to. If set to "auto", the admin ui app will determine the hostname from the
     * current location (i.e. `window.location.hostname`).
     *
     * @deprecated Use the adminUiConfig property instead
     * @default 'auto'
     */
    apiHost?: string | 'auto';
    /**
     * @description
     * The port of the Vendure server which the admin ui will be making API calls
     * to. If set to "auto", the admin ui app will determine the port from the
     * current location (i.e. `window.location.port`).
     *
     * @deprecated Use the adminUiConfig property instead
     * @default 'auto'
     */
    apiPort?: number | 'auto';
    /**
     * @description
     * Allows the contents of the `vendure-ui-config.json` file to be set, e.g.
     * for specifying the Vendure GraphQL API host, available UI languages, etc.
     */
    adminUiConfig?: Partial<AdminUiConfig>;
}

/**
 * @description
 * This plugin starts a static server for the Admin UI app, and proxies it via the `/admin/` path of the main Vendure server.
 *
 * The Admin UI allows you to administer all aspects of your store, from inventory management to order tracking. It is the tool used by
 * store administrators on a day-to-day basis for the management of the store.
 *
 * ## Installation
 *
 * `yarn add \@vendure/admin-ui-plugin`
 *
 * or
 *
 * `npm install \@vendure/admin-ui-plugin`
 *
 * @example
 * ```ts
 * import { AdminUiPlugin } from '\@vendure/admin-ui-plugin';
 *
 * const config: VendureConfig = {
 *   // Add an instance of the plugin to the plugins array
 *   plugins: [
 *     AdminUiPlugin.init({ port: 3002 }),
 *   ],
 * };
 * ```
 *
 * @docsCategory AdminUiPlugin
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [],
    configuration: config => AdminUiPlugin.configure(config),
})
export class AdminUiPlugin implements OnVendureBootstrap, OnVendureClose {
    private static options: AdminUiPluginOptions;
    private server: Server;

    constructor(private configService: ConfigService) {}

    /**
     * @description
     * Set the plugin options
     */
    static init(options: AdminUiPluginOptions): Type<AdminUiPlugin> {
        this.options = options;
        return AdminUiPlugin;
    }

    /** @internal */
    static async configure(config: RuntimeVendureConfig): Promise<RuntimeVendureConfig> {
        const route = 'admin';
        const { app } = this.options;
        const appWatchMode = this.isDevModeApp(app);
        let port: number;
        if (this.isDevModeApp(app)) {
            port = app.port;
        } else {
            port = this.options.port;
        }
        config.apiOptions.middleware.push({
            handler: createProxyHandler({
                hostname: this.options.hostname,
                port,
                route: 'admin',
                label: 'Admin UI',
                basePath: appWatchMode ? 'admin' : undefined,
            }),
            route,
        });
        if (this.isDevModeApp(app)) {
            config.apiOptions.middleware.push({
                handler: createProxyHandler({
                    hostname: this.options.hostname,
                    port,
                    route: 'sockjs-node',
                    label: 'Admin UI live reload',
                    basePath: 'sockjs-node',
                }),
                route: 'sockjs-node',
            });
        }
        return config;
    }

    /** @internal */
    async onVendureBootstrap() {
        const { apiHost, apiPort, port, app, adminUiConfig } = AdminUiPlugin.options;
        // TODO: Remove in next minor version (0.11.0)
        if (apiHost || apiPort) {
            Logger.warn(
                `The "apiHost" and "apiPort" options are deprecated and will be removed in a future version.`,
                loggerCtx,
            );
            Logger.warn(
                `Use the "adminUiConfig.apiHost", "adminUiConfig.apiPort" properties instead.`,
                loggerCtx,
            );
        }
        const adminUiAppPath = AdminUiPlugin.isDevModeApp(app)
            ? path.join(app.sourcePath, 'src')
            : (app && app.path) || DEFAULT_APP_PATH;
        const adminUiConfigPath = path.join(adminUiAppPath, 'vendure-ui-config.json');

        const overwriteConfig = () => {
            const uiConfig = this.getAdminUiConfig(adminUiConfig);
            return this.overwriteAdminUiConfig(adminUiConfigPath, uiConfig);
        };

        if (!AdminUiPlugin.isDevModeApp(app)) {
            // If not in dev mode, start a static server for the compiled app
            const adminUiServer = express();
            adminUiServer.use(express.static(adminUiAppPath));
            adminUiServer.use((req, res) => {
                res.sendFile(path.join(adminUiAppPath, 'index.html'));
            });
            this.server = adminUiServer.listen(AdminUiPlugin.options.port);
            if (app && typeof app.compile === 'function') {
                Logger.info(`Compiling Admin UI app in production mode...`, loggerCtx);
                app.compile()
                    .then(overwriteConfig)
                    .then(
                        () => {
                            Logger.info(`Admin UI successfully compiled`, loggerCtx);
                        },
                        (err: any) => {
                            Logger.error(`Failed to compile: ${err}`, loggerCtx, err.stack);
                        },
                    );
            } else {
                await overwriteConfig();
            }
        } else {
            Logger.info(`Compiling Admin UI app in development mode`, loggerCtx);
            app.compile().then(
                () => {
                    Logger.info(`Admin UI compiling and watching for changes...`, loggerCtx);
                },
                (err: any) => {
                    Logger.error(`Failed to compile: ${err}`, loggerCtx, err.stack);
                },
            );
            await overwriteConfig();
        }
    }

    /** @internal */
    async onVendureClose(): Promise<void> {
        if (this.server) {
            await new Promise(resolve => this.server.close(() => resolve()));
        }
    }

    /**
     * Takes an optional AdminUiConfig provided in the plugin options, and returns a complete
     * config object for writing to disk.
     */
    private getAdminUiConfig(partialConfig?: Partial<AdminUiConfig>): AdminUiConfig {
        const { authOptions } = this.configService;

        const propOrDefault = <Prop extends keyof AdminUiConfig>(
            prop: Prop,
            defaultVal: AdminUiConfig[Prop],
        ): AdminUiConfig[Prop] => {
            return partialConfig ? (partialConfig as AdminUiConfig)[prop] || defaultVal : defaultVal;
        };
        return {
            adminApiPath: propOrDefault('adminApiPath', this.configService.apiOptions.adminApiPath),
            apiHost: propOrDefault('apiHost', AdminUiPlugin.options.apiHost || 'auto'),
            apiPort: propOrDefault('apiPort', AdminUiPlugin.options.apiPort || 'auto'),
            tokenMethod: propOrDefault('tokenMethod', authOptions.tokenMethod || 'cookie'),
            authTokenHeaderKey: propOrDefault(
                'authTokenHeaderKey',
                authOptions.authTokenHeaderKey || DEFAULT_AUTH_TOKEN_HEADER_KEY,
            ),
            defaultLanguage: propOrDefault('defaultLanguage', defaultLanguage),
            availableLanguages: propOrDefault('availableLanguages', defaultAvailableLanguages),
            loginUrl: AdminUiPlugin.options.adminUiConfig?.loginUrl,
        };
    }

    /**
     * Overwrites the parts of the admin-ui app's `vendure-ui-config.json` file relating to connecting to
     * the server admin API.
     */
    private async overwriteAdminUiConfig(adminUiConfigPath: string, config: AdminUiConfig) {
        try {
            const content = await this.pollForConfigFile(adminUiConfigPath);
        } catch (e) {
            Logger.error(e.message, loggerCtx);
            throw e;
        }
        try {
            await fs.writeFile(adminUiConfigPath, JSON.stringify(config, null, 2));
        } catch (e) {
            throw new Error('[AdminUiPlugin] Could not write vendure-ui-config.json file:\n' + e.message);
        }
        Logger.verbose(`Applied configuration to vendure-ui-config.json file`, loggerCtx);
    }

    /**
     * It might be that the ui-devkit compiler has not yet copied the config
     * file to the expected location (particularly when running in watch mode),
     * so polling is used to check multiple times with a delay.
     */
    private async pollForConfigFile(adminUiConfigPath: string) {
        const maxRetries = 10;
        const retryDelay = 200;
        let attempts = 0;

        const pause = () => new Promise(resolve => setTimeout(resolve, retryDelay));

        while (attempts < maxRetries) {
            try {
                Logger.verbose(`Checking for config file: ${adminUiConfigPath}`, loggerCtx);
                const configFileContent = await fs.readFile(adminUiConfigPath, 'utf-8');
                return configFileContent;
            } catch (e) {
                attempts++;
                Logger.verbose(
                    `Unable to locate config file: ${adminUiConfigPath} (attempt ${attempts})`,
                    loggerCtx,
                );
            }
            await pause();
        }
        throw new Error(`Unable to locate config file: ${adminUiConfigPath}`);
    }

    private static isDevModeApp(
        app?: AdminUiAppConfig | AdminUiAppDevModeConfig,
    ): app is AdminUiAppDevModeConfig {
        if (!app) {
            return false;
        }
        return !!(app as AdminUiAppDevModeConfig).sourcePath;
    }
}
