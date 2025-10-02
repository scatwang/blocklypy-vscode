import * as vscode from 'vscode';

import { PybricksBleClient } from '../communication/clients/pybricks-ble-client';
import { ConnectionManager } from '../communication/connection-manager';
import { BLOCKLYPY_COMMANDS_VIEW_ID } from '../const';
import { clearDebugLog, logDebug } from '../extension/debug-channel';
import { clearPythonErrors } from '../extension/diagnostics';
import { compileAsyncAny } from '../logic/compile';
import { hasState, StateProp } from '../logic/state';
import Config, { ConfigKeys } from '../utils/config';
import { pickSlot } from './utils';

export async function compileAsync(compileMode?: string) {
    const { data } = await compileAsyncAny(compileMode);
    logDebug(`User program compiled (${data.byteLength} bytes).`);
}

export async function compileAndRunAsync(
    slot_input?: number,
    compileMode?: string,
): Promise<void> {
    clearPythonErrors();
    if (Config.get<boolean>(ConfigKeys.TerminalAutoClear) === true) clearDebugLog();

    await vscode.window.withProgress(
        {
            location: { viewId: BLOCKLYPY_COMMANDS_VIEW_ID },
            cancellable: false,
        },
        async () => {
            try {
                const {
                    data,
                    filename,
                    slot: slot_header,
                    language,
                } = await compileAsyncAny(compileMode);

                if (!hasState(StateProp.Connected) || !ConnectionManager.client) {
                    logDebug(
                        `User program compiled (${data.byteLength} bytes) but not started.`,
                    );
                    throw new Error(
                        'No device selected. Please connect to a device first.',
                    );
                }

                if (
                    language === 'lego' &&
                    !(ConnectionManager.client instanceof PybricksBleClient)
                ) {
                    throw new Error(
                        'The generated code is only compatible with LEGO devices connected running Pybricks.',
                    );
                }

                let slot = slot_header ?? slot_input;
                if (ConnectionManager.client.classDescriptor.requiresSlot) {
                    if (slot === undefined)
                        slot = await pickSlot(
                            'Enter the slot number to upload program to',
                        );
                    if (slot === undefined || Number.isNaN(slot))
                        throw new Error('No valid slot number selected.');
                } else {
                    slot = slot ?? 0;
                }

                await ConnectionManager.client.action_stop();
                await ConnectionManager.client.action_upload(data, slot, filename);
                await ConnectionManager.client.action_start(slot);

                logDebug(
                    `User program compiled (${data.byteLength} bytes) and started successfully.`,
                );
            } catch (e) {
                logDebug(`${String(e)}`);
            }
        },
    );
}


