import { logDebug } from '../extension/debug-channel';
import { plotManager } from '../logic/stdout-helper';
import {
    TunnelMessageType,
    TunnelPayload,
} from '../spike/utils/tunnel-notification-parser';

// eslint-disable-next-line @typescript-eslint/require-await
export async function handleTunneleNotificationAsync(
    payloads: TunnelPayload[] | undefined,
) {
    if (!payloads) return;

    for (const msg of payloads ?? []) {
        logDebug(
            `[HubOS:TunnelMessage] ${TunnelMessageType[msg.type]}, ${JSON.stringify(
                msg,
            )}`,
        );

        switch (msg.type) {
            case TunnelMessageType.LineGraphPlot:
                // CHECK: how about not ignoring x for LineGraphPlot
                plotManager?.setCellData(`color_${msg.color}`, msg.y);
                break;

            case TunnelMessageType.BarGraphSetValue:
                plotManager?.setCellData(`color_${msg.color}`, msg.value);
                break;

            case TunnelMessageType.DisplayText: {
                logDebug(msg.text);
                break;
            }

            case TunnelMessageType.DisplayImage: {
                logDebug(`image_${msg.image}`);
                break;
            }

            // TODO: handle these messages
            // ignored: BarGraphChange
            // ignored: DisplayNextImage
            // GraphShow
            // DisplayHide,
            // SoundPlay
            // LineGraphRequestValue
            // BarGraphRequestValue

            // // Send example response back to the hub
            // case TunnelMessageType.WeatherAtOffsetRequest: {
            //     // TODO: improve check if client is actually a HubOSBaseClient or alike
            //     const client = ConnectionManager.client as HubOSBaseClient;
            //     if (client && client.connected && client.sendMessage !== undefined) {
            //         const payload = {
            //             type: TunnelMessageType.WeatherForecast,
            //             correlationId: msg.correlationId,
            //             location: 'Test Location',
            //             temperature: 12.3,
            //             windSpeed: 12.3,
            //             precipitation: 0.1,
            //             condition: 1, // e.g., 1 = sunny
            //             windDirection: 'NE',
            //             pressure: 1013,
            //             offset: 0,
            //         } as TunnelPayload;

            //         const response1 = new TunnelRequestMessage([payload]);
            //         await client.sendMessage(response1);
            //     }
            //     break;
            // }
        }
    }
}
