import Config, { ConfigKeys } from '../extension/config';
import {
    deviceNotificationGetDataByFilter,
    DeviceNotificationPayload,
} from '../spike/utils/device-notification-parser';
import { plotManager } from './plot';

export function handleDeviceNotificationForPlotAsync(
    payloads: DeviceNotificationPayload[],
) {
    const userconfig = Config.get<string>(ConfigKeys.HubOSDeviceNotificationPlotFilter);
    if (!userconfig || userconfig.trim().length === 0) return;
    const columns = userconfig.split(',').map((s) => s.trim());
    const plotdata: { name: string; value: number }[] = [];
    for (const col of columns) {
        const value = deviceNotificationGetDataByFilter(col, payloads);
        if (value !== undefined) {
            plotdata.push({ name: col, value });
        }
    }
    if (plotdata.length > 0) plotManager.setCellRow(plotdata);
}
