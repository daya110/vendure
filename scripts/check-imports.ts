/* tslint:disable:no-console */
import fs from 'fs';
import path from 'path';
// tslint:disable-next-line:no-var-requires
const find = require('find');

/**
 * An array of regular expressions defining illegal import patterns to be checked in the
 * source files of the monorepo packages. This prevents bad imports (which work locally
 * and go undetected) from getting into published releases of Vendure.
 */
const illegalImportPatters: RegExp[] = [
    /@vendure\/common\/src/,
];

findInFiles(illegalImportPatters, path.join(__dirname, '../packages'), /\.ts$/);

function findInFiles(patterns: RegExp[], directory: string, fileFilter: RegExp) {
    find.file(fileFilter, directory, async (files: string[]) => {
        const matches = await getMatchedFiles(patterns, files);
        if (matches.length) {
            console.error(`Found illegal imports in the following files:`);
            console.error(matches.join('\n'));
            process.exitCode = 1;
        } else {
            console.log('Imports check ok!');
        }
    });
}

async function getMatchedFiles(patterns: RegExp[], files: string[]) {
    const matchedFiles = [];
    for (let i = files.length - 1; i >= 0; i--) {
        const content = await readFile(files[i]);
        for (const pattern of patterns) {
            if (pattern.test(content)) {
                matchedFiles.push(files[i]);
                continue;
            }
        }
    }
    return matchedFiles;
}

function readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}
