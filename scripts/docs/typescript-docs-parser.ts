import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import { notNullOrUndefined } from '../../packages/common/src/shared-utils';

import {
    ClassInfo,
    InterfaceInfo,
    MemberInfo,
    MethodInfo,
    MethodParameterInfo,
    ParsedDeclaration,
    PropertyInfo,
    TypeAliasInfo,
    ValidDeclaration,
} from './typescript-docgen-types';

/**
 * Parses TypeScript source files into data structures which can then be rendered into
 * markdown for documentation.
 */
export class TypescriptDocsParser {

    private readonly atTokenPlaceholder = '__EscapedAtToken__';

    /**
     * Parses the TypeScript files given by the filePaths array and returns the
     * parsed data structures ready for rendering.
     */
    parse(filePaths: string[]): ParsedDeclaration[] {
        const sourceFiles = filePaths.map(filePath => {
            return ts.createSourceFile(
                filePath,
                this.replaceEscapedAtTokens(fs.readFileSync(filePath).toString()),
                ts.ScriptTarget.ES2015,
                true,
            );
        });

        const statements = this.getStatementsWithSourceLocation(sourceFiles);

        return statements
            .map(statement => {
                const info = this.parseDeclaration(statement.statement, statement.sourceFile, statement.sourceLine);
                return info;
            })
            .filter(notNullOrUndefined);
    }

    /**
     * Maps an array of parsed SourceFiles into statements, including a reference to the original file each statement
     * came from.
     */
    private getStatementsWithSourceLocation(
        sourceFiles: ts.SourceFile[],
    ): Array<{ statement: ts.Statement; sourceFile: string; sourceLine: number }> {
        return sourceFiles.reduce(
            (st, sf) => {
                const statementsWithSources = sf.statements.map(statement => {
                    const sourceFile = path.relative(path.join(__dirname, '..'), sf.fileName).replace(/\\/g, '/');
                    const sourceLine = sf.getLineAndCharacterOfPosition(statement.getStart()).line + 1;
                    return {statement, sourceFile, sourceLine};
                });
                return [...st, ...statementsWithSources];
            },
            [] as Array<{ statement: ts.Statement; sourceFile: string; sourceLine: number }>,
        );
    }

    /**
     * Parses an InterfaceDeclaration into a simple object which can be rendered into markdown.
     */
    private parseDeclaration(
        statement: ts.Statement,
        sourceFile: string,
        sourceLine: number,
    ): ParsedDeclaration | undefined {
        if (!this.isValidDeclaration(statement)) {
            return;
        }
        const category = this.getDocsCategory(statement);
        if (category === undefined) {
            return;
        }
        const title = statement.name ? statement.name.getText() : 'anonymous';
        const fullText = this.getDeclarationFullText(statement);
        const weight = this.getDeclarationWeight(statement);
        const description = this.getDeclarationDescription(statement);
        const normalizedTitle = this.kebabCase(title);
        const fileName = normalizedTitle === category ? '_index' : normalizedTitle;
        const packageName = this.getPackageName(sourceFile);

        const info = {
            packageName,
            sourceFile,
            sourceLine,
            fullText,
            title,
            weight,
            category,
            description,
            fileName,
        };

        if (ts.isInterfaceDeclaration(statement)) {
            return {
                ...info,
                kind: 'interface',
                extends: this.getHeritageClauseText(statement, ts.SyntaxKind.ExtendsKeyword),
                members: this.parseMembers(statement.members),
            };
        } else if (ts.isTypeAliasDeclaration(statement)) {
            return {
                ...info,
                type: statement.type,
                kind: 'typeAlias',
                members: ts.isTypeLiteralNode(statement.type) ? this.parseMembers(statement.type.members) : undefined,
            };
        } else if (ts.isClassDeclaration(statement)) {
            return {
                ...info,
                kind: 'class',
                members: this.parseMembers(statement.members),
                extends: this.getHeritageClauseText(statement, ts.SyntaxKind.ExtendsKeyword),
                implements: this.getHeritageClauseText(statement, ts.SyntaxKind.ImplementsKeyword),
            };
        } else if (ts.isEnumDeclaration(statement)) {
            return {
                ...info,
                kind: 'enum' as 'enum',
                members: this.parseMembers(statement.members) as PropertyInfo[],
            };
        } else if (ts.isFunctionDeclaration(statement)) {
            const parameters = statement.parameters.map(p => ({
                name: p.name.getText(),
                type: p.type ? p.type.getText() : '',
                optional: !!p.questionToken,
                initializer: p.initializer && p.initializer.getText(),
            }));
            return {
                ...info,
                kind: 'function',
                parameters,
                type: statement.type,
            };
        }
    }

    /**
     * Returns the text of any "extends" or "implements" clause of a class or interface.
     */
    private getHeritageClauseText(
        statement: ts.ClassDeclaration | ts.InterfaceDeclaration,
        kind: ts.SyntaxKind.ExtendsKeyword | ts.SyntaxKind.ImplementsKeyword,
    ): string | undefined {
        const {heritageClauses} = statement;
        if (!heritageClauses) {
            return;
        }
        const clause = heritageClauses.find(cl => cl.token === kind);
        if (!clause) {
            return;
        }
        return clause.getText();
    }

    /**
     * Returns the declaration name plus any type parameters.
     */
    private getDeclarationFullText(declaration: ValidDeclaration): string {
        const name = declaration.name ? declaration.name.getText() : 'anonymous';
        let typeParams = '';
        if (!ts.isEnumDeclaration(declaration) && declaration.typeParameters) {
            typeParams = '<' + declaration.typeParameters.map(tp => tp.getText()).join(', ') + '>';
        }
        return name + typeParams;
    }

    private getPackageName(sourceFile: string): string {
        const matches = sourceFile.match(/\/packages\/([^/]+)\//);
        if (matches) {
            return `@vendure/${matches[1]}`;
        } else {
            return '';
        }
    }

    /**
     * Parses an array of inteface members into a simple object which can be rendered into markdown.
     */
    private parseMembers(
        members: ts.NodeArray<ts.TypeElement | ts.ClassElement | ts.EnumMember>,
    ): Array<PropertyInfo | MethodInfo> {
        const result: Array<PropertyInfo | MethodInfo> = [];

        for (const member of members) {
            const modifiers = member.modifiers ? member.modifiers.map(m => m.getText()) : [];
            const isPrivate = modifiers.includes('private');
            if (
                !isPrivate &&
                (ts.isPropertySignature(member) ||
                    ts.isMethodSignature(member) ||
                    ts.isPropertyDeclaration(member) ||
                    ts.isMethodDeclaration(member) ||
                    ts.isConstructorDeclaration(member) ||
                    ts.isEnumMember(member) ||
                    ts.isGetAccessorDeclaration(member)
                )
            ) {
                const name = member.name ? member.name.getText() : 'constructor';
                let description = '';
                let type = '';
                let defaultValue = '';
                let parameters: MethodParameterInfo[] = [];
                let fullText = '';
                let isInternal = false;
                if (ts.isConstructorDeclaration(member)) {
                    fullText = 'constructor';
                } else if (ts.isMethodDeclaration(member)) {
                    fullText = member.name.getText();
                } else if (ts.isGetAccessorDeclaration(member)) {
                    fullText = `${member.name.getText()}: ${member.type ? member.type.getText() : 'void'}`;
                } else {
                    fullText = member.getText();
                }
                this.parseTags(member, {
                    description: tag => (description += tag.comment || ''),
                    example: tag => (description += this.formatExampleCode(tag.comment)),
                    default: tag => (defaultValue = tag.comment || ''),
                    internal: tag => isInternal = true,
                });
                if (isInternal) {
                    continue;
                }
                if (!ts.isEnumMember(member) && member.type) {
                    type = member.type.getText();
                }
                const memberInfo: MemberInfo = {
                    fullText,
                    name,
                    description: this.restoreAtTokens(description),
                    type,
                    modifiers,
                };
                if (
                    ts.isMethodSignature(member) ||
                    ts.isMethodDeclaration(member) ||
                    ts.isConstructorDeclaration(member)
                ) {
                    parameters = member.parameters.map(p => ({
                        name: p.name.getText(),
                        type: p.type ? p.type.getText() : '',
                        optional: !!p.questionToken,
                        initializer: p.initializer && p.initializer.getText(),
                    }));
                    result.push({
                        ...memberInfo,
                        kind: 'method',
                        parameters,
                    });
                } else {
                    result.push({
                        ...memberInfo,
                        kind: 'property',
                        defaultValue,
                    });
                }
            }
        }

        return result;
    }

    /**
     * Reads the @docsWeight JSDoc tag from the interface.
     */
    private getDeclarationWeight(statement: ValidDeclaration): number {
        let weight = 10;
        this.parseTags(statement, {
            docsWeight: tag => (weight = Number.parseInt(tag.comment || '10', 10)),
        });
        return weight;
    }

    /**
     * Reads the @description JSDoc tag from the interface.
     */
    private getDeclarationDescription(statement: ValidDeclaration): string {
        let description = '';
        this.parseTags(statement, {
            description: tag => (description += tag.comment),
            example: tag => (description += this.formatExampleCode(tag.comment)),
        });
        return this.restoreAtTokens(description);
    }

    /**
     * Extracts the "@docsCategory" value from the JSDoc comments if present.
     */
    private getDocsCategory(statement: ValidDeclaration): string | undefined {
        let category: string | undefined;
        this.parseTags(statement, {
            docsCategory: tag => (category = tag.comment || ''),
        });
        return this.kebabCase(category);
    }

    /**
     * Type guard for the types of statement which can ge processed by the doc generator.
     */
    private isValidDeclaration(statement: ts.Statement): statement is ValidDeclaration {
        return (
            ts.isInterfaceDeclaration(statement) ||
            ts.isTypeAliasDeclaration(statement) ||
            ts.isClassDeclaration(statement) ||
            ts.isEnumDeclaration(statement) ||
            ts.isFunctionDeclaration(statement)
        );
    }

    /**
     * Parses the Node's JSDoc tags and invokes the supplied functions against any matching tag names.
     */
    private parseTags<T extends ts.Node>(
        node: T,
        tagMatcher: { [tagName: string]: (tag: ts.JSDocTag) => void },
    ): void {
        const jsDocTags = ts.getJSDocTags(node);
        for (const tag of jsDocTags) {
            const tagName = tag.tagName.text;
            if (tagMatcher[tagName]) {
                tagMatcher[tagName](tag);
            }
        }
    }

    /**
     * Cleans up a JSDoc "@example" block by removing leading whitespace and asterisk (TypeScript has an open issue
     * wherein the asterisks are not stripped as they should be, see https://github.com/Microsoft/TypeScript/issues/23517)
     */
    private formatExampleCode(example: string = ''): string {
        return '\n\n*Example*\n\n' + example.replace(/\n\s+\*\s/g, '\n');
    }

    private kebabCase<T extends string | undefined>(input: T): T {
        if (input == null) {
            return input;
        }
        return input.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/\s+/g, '-').toLowerCase() as T;
    }

    /**
     * TypeScript from v3.5.1 interprets all '@' tokens in a tag comment as a new tag. This is a problem e.g.
     * when a plugin includes in it's description some text like "install the @vendure/some-plugin package". Here,
     * TypeScript will interpret "@vendure" as a JSDoc tag and remove it and all remaining text from the comment.
     *
     * The solution is to replace all escaped @ tokens ("\@") with a replacer string so that TypeScript treats them
     * as regular comment text, and then once it has parsed the statement, we replace them with the "@" character.
     */
    private replaceEscapedAtTokens(content: string): string {
        return content.replace(/\\@/g, this.atTokenPlaceholder);
    }

    /**
     * Restores "@" tokens which were replaced by the replaceEscapedAtTokens() method.
     */
    private restoreAtTokens(content: string): string {
        return content.replace(new RegExp(this.atTokenPlaceholder, 'g'), '@');
    }
}
