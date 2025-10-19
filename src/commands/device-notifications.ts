import * as vscode from 'vscode';

import { ConnectionManager } from '../communication/connection-manager';
import Config, { ConfigKeys } from '../extension/config';
import { plotManager } from '../plot/plot';
import { deviceNotificationToFilterString } from '../spike/utils/device-notification-parser';
import {
    getLastDeviceNotificationPayloads,
    updateDeviceNotifications,
} from '../user-hooks/device-notification-hook';

export async function PromptDeviceNotificationPlotFilter() {
    const client = ConnectionManager.client;
    if (!client) throw new Error('Connect a device first.');
    const current = Config.get<string>(ConfigKeys.DeviceNotificationPlotFilter) || '';

    const payloads = getLastDeviceNotificationPayloads();
    if (!payloads?.length)
        throw new Error(
            'No device notifications received yet from the connected device.',
        );
    const items: vscode.QuickPickItem[] = [];
    let lastGroup = '';
    for (const payload of payloads) {
        const keys = Object.keys(payload);
        for (const key of keys) {
            if (key === 'type') continue;
            if (key === 'port') continue;
            if (typeof (payload as Record<string, unknown>)[key] !== 'number') continue;

            // const group0 = payload
            //     ? DeviceNotificationMessageType[payload.type]
            //     : undefined;
            // if (!group0) continue;
            const { label, group } = deviceNotificationToFilterString(payload, key);
            const checked = current.includes(label);

            if (lastGroup !== group) {
                items.push({
                    kind: vscode.QuickPickItemKind.Separator,
                    label: group,
                });
                lastGroup = group;
            }
            items.push({
                label: key,
                picked: checked,
                description: label,
            });
        }
    }
    // const picks = new Set<vscode.QuickPickItem>(items.filter((i) => i.picked));
    const picks = await vscode.window.showQuickPick(items, {
        title: 'Select device notification fields to plot',
        canPickMany: true,
        // ignoreFocusOut: true,
        // onDidSelectItem: async (item: vscode.QuickPickItem) => {
        //     // const newstate = !item.picked; // works as toggle
        //     // if (newstate) picks.add(item);
        //     // else picks.delete(item);
        //     // const result =
        //     //     [...picks].map((p) => p.description).join(', ') || '';
        //     if (result !== undefined && current !== result) {
        //         await Config.set(
        //             ConfigKeys.HubOSDeviceNotificationPlotFilter,
        //             result,
        //         );
        //         await client.updateDeviceNotifications();
        //         await plotManager.resetPlotParser();
        //     }
        // },
    });
    if (!picks) return; // cancelled

    const result = picks.map((r) => r.description).join(', ') || '';
    if (result !== undefined && current !== result) {
        await Config.set(ConfigKeys.DeviceNotificationPlotFilter, result);
        await updateDeviceNotifications();
        await plotManager.resetPlotParser();
    }
}
