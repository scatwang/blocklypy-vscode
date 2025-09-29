import * as vscode from 'vscode';
import { ConnectionManager } from '../communication/connection-manager';
import { EXTENSION_KEY } from '../const';
import {
    hasState,
    onStateChange,
    setState,
    StateChangeEvent,
    StateProp,
} from '../logic/state';
import { clearStdOutDataHelpers } from '../logic/stdout-helper';
import {
    BlocklypyViewerContentAvailabilityMap,
    ViewType,
} from '../views/BlocklypyViewerProvider';
import { setStatusBarItem } from './statusbar';
import { TreeDP } from './tree-commands';
import { ToCapialized } from './utils';

const CONTEXT_BASE = EXTENSION_KEY + '.';

// saga like bahaviour for context management
export function registerContextUtils(context: vscode.ExtensionContext) {
    const handleStateChange = (event: StateChangeEvent) => {
        // --- Saga like behavior to handle specific state changes ---
        switch (event.prop) {
            case StateProp.Connected:
                void setContextConnectedDeviceType(
                    ConnectionManager.client?.deviceType,
                );

                setState(StateProp.Running, false);

                if (!event.value) {
                    setStatusBarItem(false);
                } else {
                    setStatusBarItem(
                        true,
                        ConnectionManager.client?.name,
                        ConnectionManager.client?.description,
                    );
                }

                // DevicesTree.refreshCurrentItem();
                TreeDP.refresh();
                break;

            case StateProp.Running:
                // program state notification arrives at a regular pace
                // it might happen that program sends text before program start notification arrives
                // as a workaround on stadout we set running to true
                clearStdOutDataHelpers();
                break;
        }

        // set all states as context
        Object.values(StateProp).forEach((prop) => {
            vscode.commands.executeCommand(
                'setContext',
                CONTEXT_BASE + 'is' + ToCapialized(String(prop)),
                hasState(prop),
            );
        });

        // refresh commands tree on any state change
        TreeDP.refresh();
    };
    context.subscriptions.push(onStateChange(handleStateChange));

    // -- react on text editor anc custom view changes --
    handleActiveEditorChange(vscode.window.activeTextEditor);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) =>
            handleActiveEditorChange(editor),
        ),
    );
}

function handleActiveEditorChange(editor: vscode.TextEditor | undefined) {
    const langId = editor?.document.languageId;
    vscode.commands.executeCommand(
        'setContext',
        CONTEXT_BASE + 'activeEditorLangId',
        langId,
    );
}

export async function setContextCustomViewType(value: ViewType | undefined) {
    await vscode.commands.executeCommand(
        'setContext',
        CONTEXT_BASE + 'customViewType',
        value,
    );
}

export async function setContextContentAvailability(
    content: BlocklypyViewerContentAvailabilityMap | undefined,
) {
    for (const key in content) {
        await vscode.commands.executeCommand(
            'setContext',
            `${CONTEXT_BASE}contentAvailability.has${ToCapialized(key)}`,
            content[key as keyof BlocklypyViewerContentAvailabilityMap] === true,
        );
    }
}

export async function setContextPlotDataAvailability(value: boolean) {
    await vscode.commands.executeCommand(
        'setContext',
        `${CONTEXT_BASE}isPlotDataAvailable`,
        value,
    );
}

export async function setContextConnectedDeviceType(value: string | undefined) {
    await vscode.commands.executeCommand(
        'setContext',
        `${CONTEXT_BASE}ConnectedDeviceType`,
        value,
    );
}
