import * as vscode from 'vscode';

import { clearAllSlots } from '../commands/clear-all-slots';
import { compileAndRunAsync } from '../commands/compile-and-run';
import { connectDeviceAsyncAny } from '../commands/connect-device';
import { disconnectDeviceAsync } from '../commands/disconnect-device';
import { startUserProgramAsync } from '../commands/start-user-program';
import { stopUserProgramAsync } from '../commands/stop-user-program';
import { ConnectionManager } from '../communication/connection-manager';
import { EXTENSION_KEY, PACKAGEJSON_COMMAND_PREFIX } from '../const';
import { compileAsync } from '../logic/compile';
import Config, { ConfigKeys } from '../utils/config';
import { BlocklypyViewerProvider, ViewType } from '../views/BlocklypyViewerProvider';
import { PybricksPythonPreviewProvider } from '../views/PybricksPythonPreviewProvider';
import { showInfo } from './diagnostics';
import { TreeDP } from './tree-commands';
import { openOrActivate as openOrActivateAsync, wrapErrorHandling } from './utils';

// Define the BlocklyPyCommand enum for all command strings
export enum Commands {
    ConnectDevice = EXTENSION_KEY + '.connectDevice',
    DisconnectDevice = EXTENSION_KEY + '.disconnectDevice',
    Compile = EXTENSION_KEY + '.compile',
    CompileAndRun = EXTENSION_KEY + '.compileAndRun',
    StartUserProgram = EXTENSION_KEY + '.startUserProgram',
    StopUserProgram = EXTENSION_KEY + '.stopUserProgram',
    StatusPlaceHolder = EXTENSION_KEY + '.statusPlaceholder',
    ToggleSetting = EXTENSION_KEY + '.toggleSetting',
    DisplayNextView = EXTENSION_KEY + '.blocklypyViewer.displayNextView',
    DisplayPreviousView = EXTENSION_KEY + '.blocklypyViewer.displayPreviousView',
    DisplayPreview = EXTENSION_KEY + '.blocklypyViewer.displayPreview',
    DisplayPycode = EXTENSION_KEY + '.blocklypyViewer.displayPycode',
    DisplayPseudo = EXTENSION_KEY + '.blocklypyViewer.displayPseudo',
    DisplayGraph = EXTENSION_KEY + '.blocklypyViewer.displayGraph',
    ShowPythonPreview = EXTENSION_KEY + '.showPythonPreview',
    ShowSource = EXTENSION_KEY + '.pythonPreview.showSource',
    ClearAllSlots = EXTENSION_KEY + '.clearAllSlots',
    StartScanning = EXTENSION_KEY + '.startScanning',
    StopScanning = EXTENSION_KEY + '.stopScanning',
    OpenDataLogCSV = EXTENSION_KEY + '.openDataLogCSV',
}

export const CommandMetaData: CommandMetaDataEntryExtended[] = [
    {
        // will be registered only by Commands.ToggleSetting.<configkeyForHandler>, will work with generic handler
        command: Commands.ToggleSetting,
        title: 'Toggle Auto-Start',
        icon: '$(play)',
        tooltip:
            "Auto-start user program on save with '# LEGO autostart' in first line.",
        configkeyForHandler: ConfigKeys.ProgramAutoStart,
    },
    {
        // will be registered only by Commands.ToggleSetting.<configkeyForHandler>, will work with generic handler
        command: Commands.ToggleSetting,
        title: 'Toggle Auto-Connect',
        icon: '$(clear-all)',
        tooltip: 'Auto-connect to last device connected.',
        configkeyForHandler: ConfigKeys.DeviceAutoConnect,
    },
    {
        // will be registered only by Commands.ToggleSetting.<configkeyForHandler>, will work with generic handler
        command: Commands.ToggleSetting,
        title: 'Toggle Auto-Clear Terminal',
        icon: '$(clear-all)',
        tooltip: 'Auto-clear terminal before running.',
        configkeyForHandler: ConfigKeys.TerminalAutoClear,
    },
    {
        // will be registered only by Commands.ToggleSetting.<configkeyForHandler>, will work with generic handler
        command: Commands.ToggleSetting,
        title: 'Toggle Auto-Save Plot Data',
        icon: '$(file-symlink-file)',
        tooltip: 'Auto-save plots to workspace folder using the "plot:" commands.',
        configkeyForHandler: ConfigKeys.PlotAutosave,
    },
    {
        command: Commands.StatusPlaceHolder,
        title: 'Status',
        icon: '$(debug-stackframe)',
        handler: async () => {},
    },
    {
        command: Commands.DisplayNextView,
        handler: async () => {
            await BlocklypyViewerProvider.Get?.rotateViewsAsync(true);
        },
    },
    {
        command: Commands.DisplayPreviousView,
        handler: async () => {
            await BlocklypyViewerProvider.Get?.rotateViewsAsync(false);
        },
    },
    {
        command: Commands.DisplayPycode,
        handler: async () =>
            BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Pycode),
    },
    {
        command: Commands.DisplayPseudo,
        handler: async () =>
            BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Pseudo),
    },
    {
        command: Commands.DisplayPreview,
        handler: async () =>
            BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Preview),
    },
    {
        command: Commands.DisplayGraph,
        handler: async () => BlocklypyViewerProvider.Get?.showViewAsync(ViewType.Graph),
    },
    {
        command: Commands.ShowPythonPreview,
        handler: async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'python') {
                await vscode.commands.executeCommand(
                    'vscode.openWith',
                    PybricksPythonPreviewProvider.encodeUri(editor.document.uri),
                    PybricksPythonPreviewProvider.TypeKey,
                    {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                    },
                );
            } else {
                showInfo('Open a Python file to preview.');
            }
        },
    },
    {
        command: Commands.ShowSource,
        handler: async () => {
            const uri: vscode.Uri | undefined =
                PybricksPythonPreviewProvider.Get?.ActiveUri;
            if (!uri) return;
            const origialUri = PybricksPythonPreviewProvider.decodeUri(uri);
            await openOrActivateAsync(origialUri);
        },
    },
    {
        command: Commands.ConnectDevice,
        handler: connectDeviceAsyncAny,
    },
    {
        command: Commands.Compile,
        handler: compileAsync,
    },
    {
        command: Commands.CompileAndRun,
        handler: async () => void (await compileAndRunAsync()),
    },
    {
        command: Commands.StartUserProgram,
        handler: async () => void (await startUserProgramAsync()),
    },
    {
        command: Commands.StopUserProgram,
        handler: stopUserProgramAsync,
    },
    {
        command: Commands.DisconnectDevice,
        handler: disconnectDeviceAsync,
    },
    {
        command: Commands.ClearAllSlots,
        handler: clearAllSlots,
    },
    {
        command: Commands.StartScanning,
        title: 'Start Scanning',
        icon: '$(radio-tower)',
        handler: async () => {
            await ConnectionManager.startScanning();
        },
    },
    {
        command: Commands.StopScanning,
        title: 'Stop Scanning',
        icon: '$(radio-tower)',
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async () => {
            ConnectionManager.stopScanning();
            void Promise.resolve();
        },
    },
    {
        command: Commands.OpenDataLogCSV,
        title: 'Open Data Log CSV',
        icon: '$(file-text)',
        handler: async () => {
            // const columns = plotManager?.datalogcolumns;
            // const data = plotManager?.data;
            // if (!columns || !data) {
            //     showInfo('No plot data available.');
            //     return;
            // }
            // const csvRows = [columns.join(','), ...data.map((row) => row.join(','))];
            // const csvContent = csvRows.join('\n');
            // const workspaceFolders = vscode.workspace.workspaceFolders;
            // let fileUri: vscode.Uri;
            // // if (!workspaceFolders || workspaceFolders.length === 0)
            // // {
            // //     // No workspace: create a new unsaved document
            // //     const doc = await vscode.workspace.openTextDocument({
            // //         content: csvContent,
            // //         language: 'csv',
            // //     });
            // //     await vscode.window.showTextDocument(doc, { preview: false });
            // //     return;
            // // }
            // // else
            // if (!!workspaceFolders?.length) {
            //     // Workspace exists: save file and open it
            //     const folderUri = workspaceFolders[0].uri;
            //     const now = new Date();
            //     const pad = (n: number) => n.toString().padStart(2, '0');
            //     const year = now.getFullYear();
            //     const month = pad(now.getMonth() + 1);
            //     const day = pad(now.getDate());
            //     const hour = pad(now.getHours());
            //     const minute = pad(now.getMinutes());
            //     const second = pad(now.getSeconds());
            //     const filename = `datalog-${year}${month}${day}-${hour}${minute}${second}.csv`;
            //     // const folder = getActiveFileFolder();
            //     fileUri = vscode.Uri.joinPath(folderUri, filename);
            //     await vscode.workspace.fs.writeFile(
            //         fileUri,
            //         Buffer.from(csvContent, 'utf8'),
            //     );
            //     //!! plotManager.setDatalogSaveUri(fileUri);
            //     await vscode.window.showTextDocument(fileUri, { preview: false });
            // }
        },
    },
];

export type CommandMetaDataEntry = {
    command: Commands;
    title?: string;
    icon?: string | { light: string; dark: string };
};

type CommandMetaDataEntryExtended = CommandMetaDataEntry & {
    tooltip?: string;
    configkeyForHandler?: ConfigKeys;
    handler?: CommandHandler;
};

type CommandHandler = (...args: unknown[]) => Promise<unknown>;

function getHandler(entry: CommandMetaDataEntryExtended): CommandHandler | undefined {
    if (entry.handler) {
        return wrapErrorHandling((...args: unknown[]) => entry.handler!(...args));
    }
    if (entry.configkeyForHandler) {
        return async () => {
            await Config.toggleConfigValue(entry.configkeyForHandler!);
            TreeDP.refresh();
        };
    }
    return undefined;
}

export function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        ...CommandMetaData.map((cmd) => {
            const command1 = !!cmd.configkeyForHandler
                ? `${cmd.command}.${cmd.configkeyForHandler}`
                : cmd.command;
            cmd.command = command1 as Commands; // modify in place for tree view usage

            return vscode.commands.registerCommand(
                cmd.command,
                getHandler(cmd) ??
                    (() => {
                        showInfo(`Command "${cmd.command}" not implemented yet.`);
                    }),
            );
        }),
    );
}

export const SettingsToggleCommandsMap = CommandMetaData.filter((cmd) =>
    Boolean(cmd.configkeyForHandler),
).map(
    (cmd) =>
        [cmd.configkeyForHandler!, cmd.title, () => cmd.command, cmd.tooltip] as const,
);

let _commandsFromPackageJsonCache: CommandMetaDataEntry[];
export function getCommandsFromPackageJson(
    context: vscode.ExtensionContext,
): CommandMetaDataEntry[] {
    if (_commandsFromPackageJsonCache) return _commandsFromPackageJsonCache;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const packageEntries = context.extension.packageJSON.contributes
        .commands as CommandMetaDataEntry[];
    for (const entry of packageEntries) {
        if (entry.title?.startsWith(PACKAGEJSON_COMMAND_PREFIX)) {
            entry.title = entry.title.replace(PACKAGEJSON_COMMAND_PREFIX, '');
        }
    }
    _commandsFromPackageJsonCache = packageEntries.concat(CommandMetaData);

    return _commandsFromPackageJsonCache;
}
