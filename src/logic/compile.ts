import { compile } from '@pybricks/mpy-cross-v6';
import { parse, walk } from '@pybricks/python-program-analysis';
import path from 'path';
import * as vscode from 'vscode';
import { ConnectionManager } from '../communication/connection-manager';
import { transformCodeForDebugTunnel as transformModuleForDebugTunnel } from '../debug-tunnel/compile-helper';
import { BlocklypyViewerProvider } from '../views/BlocklypyViewerProvider';
import { setState, StateProp } from './state';

export const MAIN_MODULE = '__main__';
export const MAIN_MODULE_PATH = '__main__.py';
export const FILENAME_SAMPLE_RAW = 'program.py';
export const FILENAME_SAMPLE_COMPILED = 'program.mpy'; // app.mpy+program.mpy for HubOS

export const MODE_RAW = 'raw';
export const MODE_COMPILED = 'compiled';

export type CompileModule = {
    name: string;
    path: string;
    filename: string;
    content: string;
};

export async function compileWorkerAsync(
    mode: string = MODE_COMPILED,
    debug: boolean = false,
): Promise<{
    uri: vscode.Uri;
    data: Uint8Array;
    filename: string;
    slot: number | undefined;
    language: string;
}> {
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    const parts: BlobPart[] = [];
    const { uri, content, filename, folder, language } = getActivePythonCode();
    if (!content) throw new Error('No Python code available to compile.');

    const slot = checkMagicHeaderComment(content).slot;

    if (mode === MODE_RAW) {
        const data = encoder.encode(content);
        //!! const { code, breakpoints } = transformCodeForDebugTunnel(module.content); // if debug
        return { uri, data, filename: FILENAME_SAMPLE_RAW, slot, language };
    }

    let mpyCurrent: Uint8Array | undefined;
    const modules: CompileModule[] = [
        {
            name: MAIN_MODULE,
            path: MAIN_MODULE_PATH,
            filename,
            content,
        },
    ];

    setState(StateProp.Compiling, true);
    try {
        const checkedModules = new Set<string>();
        while (modules.length > 0) {
            const module = modules.pop()!;
            if (checkedModules.has(module.name)) continue;
            checkedModules.add(module.name);

            // TODO: add featureflag
            // transform for debug tunnel
            if (debug) transformModuleForDebugTunnel(module);

            // Compiling module may reveal more imports, so check those too
            const importedModules = findImportedModules(module.content);
            for (const importedModule of importedModules) {
                if (checkedModules.has(importedModule) || !folder) {
                    continue;
                }
                const resolvedModule = await resolveModuleAsync(folder, importedModule);
                if (resolvedModule) {
                    modules.push(resolvedModule);
                } else {
                    checkedModules.add(importedModule);
                }
            }

            // Compile one module
            if (
                ConnectionManager.client?.classDescriptor.supportsModularMpy ||
                parts.length === 0
            ) {
                // Either the device supports modular .mpy files, or there is only one
                const [status, mpy] = await compileInternal(
                    module.path,
                    module.name,
                    module.content,
                );
                if (status !== 0 || !mpy)
                    throw new Error(`Failed to compile ${module.name}`);

                mpyCurrent = mpy;

                parts.push(encodeUInt32LE(mpy.length));
                parts.push(cString(module.name) as BlobPart);
                parts.push(mpy as BlobPart);
            } else {
                break;
            }

            checkedModules.add(module.name);
        }
    } finally {
        setState(StateProp.Compiling, false);
    }

    // Check if modular .mpy files are supported or just a single file is needed
    if (ConnectionManager.client?.classDescriptor.supportsModularMpy) {
        const blob = new Blob(parts);
        const buffer = await blob.arrayBuffer();
        return {
            uri,
            data: new Uint8Array(buffer),
            filename: FILENAME_SAMPLE_COMPILED,
            slot,
            language,
        };
    } else {
        if (modules.length > 1 || parts.length > 3 * 1 || !mpyCurrent) {
            throw new Error(
                'Modular .mpy files are not supported by the connected device. Please combine all code into a single file.',
            );
        }
        return {
            uri,
            data: mpyCurrent,
            filename: FILENAME_SAMPLE_COMPILED,
            slot,
            language,
        };
    }
}

export function getActivePythonCode(): {
    uri: vscode.Uri;
    content: string;
    filename: string;
    language: string;
    folder?: string;
} {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const uri = editor.document.uri;
        const content = editor.document.getText();
        const folder = path.dirname(uri.fsPath);
        const filename = path.basename(uri.fsPath);
        return { uri, content, filename, folder, language: editor.document.languageId };
    }

    const customViewer = BlocklypyViewerProvider.activeBlocklypyViewer;
    if (customViewer) {
        const uri = customViewer.uri;
        const content = customViewer?.content?.pycode ?? '';
        const filename = customViewer.filename;
        return { uri, content, filename, language: 'lego' };
    }

    throw new Error('No active Python or Blocklypy editor found.');
}

async function compileInternal(
    path: string,
    name: string,
    content: string,
): Promise<[number, Uint8Array | undefined]> {
    // HACK: This is a workaround for https://github.com/pybricks/support/issues/2185
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const fetch_backup = (global as any).fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (global as any).fetch = undefined;
    const compiled = await compile(path, content, undefined, undefined)
        .catch((e) => {
            console.error(`Failed to compile ${name}: ${e}`);
            return { status: 1, mpy: undefined };
        })
        .finally(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
            (global as any).fetch = fetch_backup;
        });

    return [compiled.status, compiled.mpy];
}

async function resolveModuleAsync(
    folder: string,
    module: string,
): Promise<CompileModule | undefined> {
    const relativePath = module.replace(/\./g, path.sep) + '.py';
    let absolutePath = path.join(folder, relativePath);
    try {
        const uri = vscode.Uri.file(absolutePath);
        const stats = await vscode.workspace.fs.stat(uri);
        if (stats.type === vscode.FileType.File) {
            return {
                name: module,
                path: relativePath,
                filename: path.basename(relativePath),
                content: Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
                    'utf8',
                ),
            };
        }
    } catch {}
}

function findImportedModules(py: string): ReadonlySet<string> {
    const modules = new Set<string>();

    const tree = parse(py);

    walk(tree, {
        onEnterNode(node, _ancestors) {
            if (node.type === 'import') {
                for (const name of node.names) {
                    modules.add(name.path);
                }
            } else if (node.type === 'from') {
                modules.add(node.base);
            }
        },
    });

    return modules;
}

const encoder = new TextEncoder();
function cString(str: string): Uint8Array {
    return encoder.encode(str + '\x00');
}

function encodeUInt32LE(value: number): ArrayBuffer {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint32(0, value, true);
    return buf;
}

export function checkMagicHeaderComment(py: string): {
    autostart?: boolean;
    slot?: number;
} {
    if (py.match(/^\s*#\s*LEGO/i)) {
        const autostart = py.match(/\bautostart\b/i) !== null;
        const slot = py.match(/\bslot:\s*(\d{1,2})/i);
        return {
            autostart: autostart,
            slot: slot ? parseInt(slot[1]) : undefined,
        };
    } else {
        return {};
    }
}
