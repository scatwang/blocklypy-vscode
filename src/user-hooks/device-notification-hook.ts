import { logDebug } from '../extension/debug-channel';
import { DeviceNotificationPayload } from '../spike/utils/device-notification-parser';
import Config, { FeatureFlags } from '../utils/config';

// eslint-disable-next-line @typescript-eslint/require-await
export async function handleDeviceNotificationAsync(
    payloads: DeviceNotificationPayload[] | undefined,
) {
    if (Config.FeatureFlag.get(FeatureFlags.LogHubOSDeviceNotification)) {
        logDebug(`DeviceNotificationPayload: ${JSON.stringify(payloads)}`);
    }

    // logDebug(`[HubOS] DeviceNotification: ${JSON.stringify(payloads)}`);
    // const data = payloads?.find((p) => p.type === 'imu');
    // // const data = payloads?.find((p) => p.type === 'force');
    // if (data) {
    //     if (!plotManager?.running) plotManager?.start(['yaw', 'roll', 'pitch']);
    //     plotManager?.handleIncomingData([data.yaw, data.roll, data.pitch]);
    //     plotManager?.flushPlotBuffer();
    // }
    // return;
}
