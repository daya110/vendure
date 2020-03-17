/**
 * @description
 * Defines extensions to the Admin UI application by specifying additional
 * Angular [NgModules](https://angular.io/guide/ngmodules) which are compiled
 * into the application.
 *
 * See [Extending the Admin UI](/docs/developer-guide/plugins/extending-the-admin-ui/) for
 * detailed instructions.
 *
 * @docsCategory UiDevkit
 * @docsPage AdminUiExtension
 */
export interface AdminUiExtension {
    /**
     * @description
     * An optional ID for the extension module. Only used internally for generating
     * import paths to your module. If not specified, a unique hash will be used as the id.
     */
    id?: string;

    /**
     * @description
     * The path to the directory containing the extension module(s). The entire contents of this directory
     * will be copied into the Admin UI app, including all TypeScript source files, html templates,
     * scss style sheets etc.
     */
    extensionPath: string;
    /**
     * @description
     * One or more Angular modules which extend the default Admin UI.
     */
    ngModules: Array<AdminUiExtensionSharedModule | AdminUiExtensionLazyModule>;

    /**
     * @description
     * Optional array of paths to static assets which will be copied over to the Admin UI app's `/static`
     * directory.
     */
    staticAssets?: StaticAssetDefinition[];
}

/**
 * @description
 * A static asset can be provided as a path to the asset, or as an object containing a path and a new
 * name, which will cause the compiler to copy and then rename the asset.
 *
 * @docsCategory UiDevkit
 * @docsPage AdminUiExtension
 */
export type StaticAssetDefinition = string | { path: string; rename: string };

/**
 * @description
 * Configuration defining a single NgModule with which to extend the Admin UI.
 *
 * @docsCategory UiDevkit
 * @docsPage AdminUiExtension
 */
export interface AdminUiExtensionSharedModule {
    /**
     * @description
     * Shared modules are directly imported into the main AppModule of the Admin UI
     * and should be used to declare custom form components and define custom
     * navigation items.
     */
    type: 'shared';
    /**
     * @description
     * The name of the file containing the extension module class.
     */
    ngModuleFileName: string;
    /**
     * @description
     * The name of the extension module class.
     */
    ngModuleName: string;
}

/**
 * @description
 * Configuration defining a single NgModule with which to extend the Admin UI.
 *
 * @docsCategory UiDevkit
 * @docsPage AdminUiExtension
 */
export interface AdminUiExtensionLazyModule {
    /**
     * @description
     * Lazy modules are lazy-loaded at the `/extensions/` route and should be used for
     * modules which define new views for the Admin UI.
     */
    type: 'lazy';
    /**
     * @description
     * The route specifies the route at which the module will be lazy-loaded. E.g. a value
     * of `'foo'` will cause the module to lazy-load when the `/extensions/foo` route
     * is activated.
     */
    route: string;
    /**
     * @description
     * The name of the file containing the extension module class.
     */
    ngModuleFileName: string;
    /**
     * @description
     * The name of the extension module class.
     */
    ngModuleName: string;
}

/**
 * @description
 * Options to configure how the Admin UI should be compiled.
 *
 * @docsCategory UiDevkit
 */
export interface UiExtensionCompilerOptions {
    /**
     * @description
     * The directory into which the sources for the extended Admin UI will be copied.
     */
    outputPath: string;
    /**
     * @description
     * An array of objects which configure extension Angular modules
     * to be compiled into and made available by the AdminUi application.
     */
    extensions: AdminUiExtension[];
    /**
     * @description
     * Set to `true` in order to compile the Admin UI in development mode (using the Angular CLI
     * [ng serve](https://angular.io/cli/serve) command). When in dev mode, any changes to
     * UI extension files will be watched and trigger a rebuild of the Admin UI with live
     * reloading.
     *
     * @default false
     */
    devMode?: boolean;
    /**
     * @description
     * In watch mode, allows the port of the dev server to be specified. Defaults to the Angular CLI default
     * of `4200`.
     *
     * @default 4200 | undefined
     */
    watchPort?: number;
}
