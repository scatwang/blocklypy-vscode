import * as vscode from 'vscode';
import { HUBOS_SPIKE_SLOTS } from '../spike';

export async function pickSlot(message: string) {
    const picked = await vscode.window.showQuickPick(
        Array(HUBOS_SPIKE_SLOTS)
            .fill(0)
            .map((_, i) => i.toString()),
        {
            placeHolder: `${message} (0-${HUBOS_SPIKE_SLOTS - 1})`,
        },
    );
    const retval = parseInt(picked || '');
    if (Number.isNaN(retval)) return undefined;
    return retval;
}
