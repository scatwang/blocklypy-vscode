import { ConnectionManager } from '../communication/connection-manager';
import { checkMagicHeaderComment, getActivePythonCode } from '../logic/compile';
import { hasState, StateProp } from '../logic/state';
import { pickSlot } from './utils';

export async function startUserProgramAsync(slot_input?: number): Promise<void> {
    if (!hasState(StateProp.Connected)) {
        throw new Error('No device selected. Please connect to a device first.');
        return;
    }

    // check if we have a magic header and want to process that
    let slot = slot_input;
    if (slot_input === undefined) {
        const { content } = getActivePythonCode();
        slot = checkMagicHeaderComment(content ?? '')?.slot;
    }

    if (ConnectionManager.client?.classDescriptor.requiresSlot) {
        if (slot === undefined || Number.isNaN(slot))
            slot = await pickSlot('Enter the slot number to start');
    }

    await ConnectionManager.client?.action_start(slot);
}
