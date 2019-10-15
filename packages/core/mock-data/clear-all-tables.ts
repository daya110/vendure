import { createConnection } from 'typeorm';

import { isTestEnvironment } from '../e2e/utils/test-environment';
import { preBootstrapConfig } from '../src/bootstrap';
import { defaultConfig } from '../src/config/default-config';
import { VendureConfig } from '../src/config/vendure-config';

// tslint:disable:no-console
// tslint:disable:no-floating-promises
/**
 * Clears all tables in the detabase sepcified by the connectionOptions
 */
export async function clearAllTables(config: VendureConfig, logging = true) {
    config = await preBootstrapConfig(config);
    const entityIdStrategy = config.entityIdStrategy || defaultConfig.entityIdStrategy;
    const name = isTestEnvironment() ? undefined : 'clearAllTables';
    const connection = await createConnection({ ...config.dbConnectionOptions, name });
    if (logging) {
        console.log('Clearing all tables...');
    }
    try {
        await connection.synchronize(true);
    } catch (err) {
        console.error('Error occurred when attempting to clear tables!');
        console.error(err);
    } finally {
        await connection.close();
    }
    if (logging) {
        console.log('Done!');
    }
}
