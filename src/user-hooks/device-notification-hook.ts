import { DeviceNotificationPayload } from '../spike/utils/device-notification-parser';

export async function handleDeviceNotificationAsync(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    payloads: DeviceNotificationPayload[] | undefined,
) {
    // console.debug('DeviceNotificationPayload', payloads);
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
