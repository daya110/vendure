export type DbType = 'mysql' | 'postgres' | 'sqlite' | 'sqljs' | 'mssql' | 'oracle';

export interface UserResponses {
    usingTs: boolean;
    dbType: DbType;
    populateProducts: boolean;
    indexSource: string;
    indexWorkerSource: string;
    configSource: string;
    migrationSource: string;
    readmeSource: string;
}

export type CliLogLevel = 'silent' | 'info' | 'verbose';
