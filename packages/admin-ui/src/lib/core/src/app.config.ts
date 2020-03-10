import { AdminUiConfig } from '@vendure/common/lib/shared-types';

import { LanguageCode } from './common/generated-types';

export const DEFAULT_LANGUAGE: LanguageCode = LanguageCode.en;
export const DEFAULT_CURRENCY = '£';

let vendureUiConfig: AdminUiConfig | undefined;

export function loadAppConfig(): Promise<void> {
    return fetch('./vendure-ui-config.json')
        .then(res => res.json())
        .then(config => {
            vendureUiConfig = config;
        });
}

export function getAppConfig(): AdminUiConfig {
    if (!vendureUiConfig) {
        throw new Error(`vendure ui config not loaded`);
    }
    return vendureUiConfig;
}
