import Config, { FeatureFlags } from '../extension/config';
import { logDebug } from '../extension/debug-channel';
import { hasState, StateProp } from '../logic/state';
import { handleDeviceNotificationForPlotAsync } from '../plot/hubos-plot-helper';
import {
    DeviceNotificationMessageType,
    DeviceNotificationPayload,
} from '../spike/utils/device-notification-parser';

// eslint-disable-next-line @typescript-eslint/require-await
export async function handleDeviceNotificationAsync(
    payloads: DeviceNotificationPayload[] | undefined,
) {
    if (Config.FeatureFlag.get(FeatureFlags.HubOSLogDeviceNotification)) {
        const payloadsToLog = payloads?.map((p) => {
            const kind = DeviceNotificationMessageType[p.type];
            return { kind, ...p };
        });
        logDebug(`DeviceNotificationPayload: ${JSON.stringify(payloadsToLog)}`);
    }

    if (Config.FeatureFlag.get(FeatureFlags.HubOSPlotDeviceNotification)) {
        // TODO: later just check if _any_ notifications come from, maybe register sources for plotmanager
        // now, allow this if program is not running
        if (!hasState(StateProp.Running)) {
            handleDeviceNotificationForPlotAsync(payloads ?? []);
        }
    }
}
