import { pickSlot } from '../commands/utils';
import { PybricksBleClient } from '../communication/clients/pybricks-ble-client';
import { ConnectionManager } from '../communication/connection-manager';
import Config, { ConfigKeys, FeatureFlags } from '../extension/config';
import { clearDebugLog, logDebug } from '../extension/debug-channel';
import { clearPythonErrors, showWarning } from '../extension/diagnostics';
import { compileWorkerAsync } from './compile';
import { hasState, StateProp } from './state';

export type runOptions = {
    noDebug?: boolean;
    compiled?: boolean;
    program?: string;
    slot?: number;
    language?: string;
    filename?: string;
    data?: Uint8Array;
};

export async function runPhase1Async(args: runOptions) {
    clearPythonErrors();
    if (Config.get<boolean>(ConfigKeys.TerminalAutoClear) === true) clearDebugLog();

    // 1. Compile
    // TODO: add later option to select program instead of the active one
    let debug = args.noDebug !== true;
    if (debug && !Config.FeatureFlag.get(FeatureFlags.PybricksDebugFromStdout)) {
        showWarning(
            'Debugging feature flag is disabled. Please enable it in the settings to use debugging.',
        );
        debug = false;
    }
    if (debug && !(ConnectionManager.client instanceof PybricksBleClient)) {
        showWarning(
            'Debug mode is only compatible with LEGO devices connected running Pybricks, falling back to no debug mode.',
        );
        debug = false;
    }

    const {
        uri,
        data,
        filename,
        slot: slot_header,
        language,
    } = await compileWorkerAsync(args.compiled, debug);
    args.program = uri.fsPath;
    args.language = language;
    args.filename = filename;
    args.data = data;
    if (slot_header !== undefined) args.slot = slot_header;

    return { data, filename, slot_header, language };
}

export async function runPhase2Async(args: runOptions): Promise<void> {
    // 2. Upload
    if (!args.data || !args.filename) {
        throw new Error('No compiled program data available to upload.');
    }
    if (!hasState(StateProp.Connected) || !ConnectionManager.client) {
        logDebug(
            `User program compiled (${args.data.byteLength} bytes) but not started.`,
        );
        throw new Error('No device selected. Please connect to a device first.');
    }
    if (
        args.language === 'lego' &&
        !(ConnectionManager.client instanceof PybricksBleClient)
    ) {
        throw new Error(
            'The generated code is only compatible with LEGO devices connected running Pybricks.',
        );
    }

    // ask for slot if not provided and required
    if (ConnectionManager.client.classDescriptor.requiresSlot) {
        if (args.slot === undefined)
            args.slot = await pickSlot('Enter the slot number to upload program to');
        if (args.slot === undefined || Number.isNaN(args.slot))
            throw new Error('No valid slot number selected.');
    } else {
        if (args.slot === undefined) args.slot = 0;
    }
    await ConnectionManager.client.action_stop();
    await ConnectionManager.client.action_upload(args.data, args.slot, args.filename);

    // 3. Start Program on device
    await ConnectionManager.client.action_start(args.slot);
    logDebug(
        `User program compiled (${args.data.byteLength} bytes) and started successfully.`,
    );
}

export async function runAsync(args: runOptions): Promise<void> {
    await runPhase1Async(args);
    await runPhase2Async(args);
}
