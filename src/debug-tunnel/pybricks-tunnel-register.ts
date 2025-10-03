'use strict';

import * as vscode from 'vscode';
import {
    CancellationToken,
    DebugConfiguration,
    ProviderResult,
    WorkspaceFolder,
} from 'vscode';
import { PybricksTunnelDebugSession } from './pybricks-tunnel-debug';
import { FileAccessor } from './pybricks-tunnel-runtime';

const PYBRICKS_DEBUG_TYPE = 'pybricks-tunnel';
const PYTHON_LANGUAGE_ID = 'python';

export function registerPybricksTunnelDebug(
    context: vscode.ExtensionContext,
    factory?: vscode.DebugAdapterDescriptorFactory,
) {
    context.subscriptions
        .push
        //!!
        // // use compileAndRunWithDebug for debugging
        // vscode.commands.registerCommand(
        //     'blocklypy-vscode.debugEditorContents',
        //     (resource: vscode.Uri) => {
        //         let targetResource = resource;
        //         if (!targetResource && vscode.window.activeTextEditor) {
        //             targetResource = vscode.window.activeTextEditor.document.uri;
        //         }
        //         if (targetResource) {
        //             vscode.debug.startDebugging(undefined, {
        //                 type: 'pybricks-tunnel',
        //                 name: 'Debug File',
        //                 request: 'launch',
        //                 program: targetResource.fsPath,
        //                 stopOnEntry: true,
        //             });
        //         }
        //     },
        // ),
        //!!
        // vscode.commands.registerCommand(
        //     'blocklypy-vscode.toggleFormatting',
        //     (variable) => {
        //         const ds = vscode.debug.activeDebugSession;
        //         if (ds) {
        //             ds.customRequest('toggleFormatting');
        //         }
        //     },
        // ),
        ();

    // context.subscriptions.push(
    //     vscode.commands.registerCommand('blocklypy-vscode.getProgramName', (config) => {
    //         return vscode.window.showInputBox({
    //             placeHolder:
    //                 'Please enter the name of a python file in the workspace folder',
    //             value: 'readme1.md',
    //         });
    //     }),
    // );

    // register a configuration provider
    const provider = new PybricksTunnelConfigurationProvider();
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(PYBRICKS_DEBUG_TYPE, provider),
    );

    //!! //??
    // register a dynamic configuration provider
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(
            PYBRICKS_DEBUG_TYPE,
            {
                provideDebugConfigurations(
                    folder: WorkspaceFolder | undefined,
                ): ProviderResult<DebugConfiguration[]> {
                    return [
                        {
                            name: 'Pybricks Tunnel Launch',
                            request: 'launch',
                            type: PYBRICKS_DEBUG_TYPE,
                            program: '${file}',
                        },
                    ];
                },
            },
            vscode.DebugConfigurationProviderTriggerKind.Dynamic,
        ),
    );

    if (!factory) {
        factory = new InlineDebugAdapterFactory();
    }
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory(
            PYBRICKS_DEBUG_TYPE,
            factory,
        ),
    );
    // if ('dispose' in factory) {
    //     context.subscriptions.push(factory);
    // }

    // override VS Code's default implementation of the debug hover
    context.subscriptions.push(
        vscode.languages.registerEvaluatableExpressionProvider(PYTHON_LANGUAGE_ID, {
            provideEvaluatableExpression(
                document: vscode.TextDocument,
                position: vscode.Position,
            ): vscode.ProviderResult<vscode.EvaluatableExpression> {
                const VARIABLE_REGEXP = /\$[a-z][a-z0-9]*/gi;
                const line = document.lineAt(position.line).text;

                let m: RegExpExecArray | null;
                while ((m = VARIABLE_REGEXP.exec(line))) {
                    const varRange = new vscode.Range(
                        position.line,
                        m.index,
                        position.line,
                        m.index + m[0].length,
                    );

                    if (varRange.contains(position)) {
                        return new vscode.EvaluatableExpression(varRange);
                    }
                }
                return undefined;
            },
        }),
    );

    // override VS Code's default implementation of the "inline values" feature"
    context.subscriptions.push(
        vscode.languages.registerInlineValuesProvider(PYTHON_LANGUAGE_ID, {
            provideInlineValues(
                document: vscode.TextDocument,
                viewport: vscode.Range,
                context: vscode.InlineValueContext,
            ): vscode.ProviderResult<vscode.InlineValue[]> {
                const allValues: vscode.InlineValue[] = []; //!!

                for (
                    let l = viewport.start.line;
                    l <= context.stoppedLocation.end.line;
                    l++
                ) {
                    const line = document.lineAt(l);
                    var regExp = /\$([a-z][a-z0-9]*)/gi; // variables are words starting with '$'
                    do {
                        var m = regExp.exec(line.text);
                        if (m) {
                            const varName = m[1];
                            const varRange = new vscode.Range(
                                l,
                                m.index,
                                l,
                                m.index + varName.length,
                            );

                            // some literal text
                            //allValues.push(new vscode.InlineValueText(varRange, `${varName}: ${viewport.start.line}`));

                            // value found via variable lookup
                            allValues.push(
                                new vscode.InlineValueVariableLookup(
                                    varRange,
                                    varName,
                                    false,
                                ),
                            );

                            // value determined via expression evaluation
                            //allValues.push(new vscode.InlineValueEvaluatableExpression(varRange, varName));
                        }
                    } while (m);
                }

                return allValues;
            },
        }),
    );
}

class PybricksTunnelConfigurationProvider implements vscode.DebugConfigurationProvider {
    /**
     * Massage a debug configuration just before a debug session is being launched,
     * e.g. add all missing attributes to the debug configuration.
     */
    resolveDebugConfiguration(
        _folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        _token?: CancellationToken,
    ): ProviderResult<DebugConfiguration> {
        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === PYTHON_LANGUAGE_ID) {
                config.type = PYBRICKS_DEBUG_TYPE;
                config.name = 'Launch';
                config.request = 'launch';
                config.program = '${file}';
                config.stopOnEntry = true;
            }
        }

        if (!config.program) {
            return vscode.window
                .showInformationMessage('Cannot find a program to debug')
                .then((_) => {
                    return undefined; // abort launch
                });
        }

        return config;
    }
}

export const workspaceFileAccessor: FileAccessor = {
    isWindows: typeof process !== 'undefined' && process.platform === 'win32',
    async readFile(path: string): Promise<Uint8Array> {
        let uri: vscode.Uri;
        try {
            uri = pathToUri(path);
        } catch (e) {
            return new TextEncoder().encode(`cannot read '${path}'`);
        }

        const file = await vscode.workspace.fs.readFile(uri);
        return file;
    },
    async writeFile(path: string, contents: Uint8Array) {
        await vscode.workspace.fs.writeFile(pathToUri(path), contents);
    },
};

function pathToUri(path: string) {
    try {
        return vscode.Uri.file(path);
    } catch (e) {
        return vscode.Uri.parse(path);
    }
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(
        _session: vscode.DebugSession,
    ): ProviderResult<vscode.DebugAdapterDescriptor> {
        return new vscode.DebugAdapterInlineImplementation(
            new PybricksTunnelDebugSession(workspaceFileAccessor),
        );
    }
}
