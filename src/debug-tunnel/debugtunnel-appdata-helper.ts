import { logDebug } from '../extension/debug-channel';
import {
    DebugMessage,
    DebugSubCode,
    Message,
    MessageType,
} from '../pybricks/appdata-instrumentation-protocol';
import { DebugTunnel } from './debug-tunnel';

export async function handleIncomingAIPPDebug(
    message: DebugMessage,
): Promise<Message | undefined> {
    if (message.Id !== MessageType.DebugNotification) return;
    switch (message.subcode) {
        case DebugSubCode.StartNotification: {
            // Start
            logDebug('Hub started debug session');

            // send acknowledge
            await DebugTunnel.sendToHub({
                Id: MessageType.DebugAcknowledge,
                subcode: DebugSubCode.StartAcknowledge,
                success: true,
            });

            // send to debug tunnel
            await DebugTunnel.onHubMessage({ type: 'start' });

            break;
        }
        case DebugSubCode.TrapNotification: {
            // Trap
            const message1 = message as DebugMessage & {
                filename: string;
                line: number;
            };
            const filename = message1.filename;
            const line = message1.line;
            logDebug(`Hub paused at debug breakpont at ${filename}:${line}`);

            // send acknowledge
            await DebugTunnel.sendToHub({
                Id: MessageType.DebugAcknowledge,
                subcode: DebugSubCode.TrapAcknowledge,
                success: true,
            });

            // send to debug tunnel
            await DebugTunnel.onHubMessage({
                type: 'trap',
                payload: { filename, line, variables: new Map() },
            });
            break;
        }
    }
}

// const handleTrapMock = async () => {
//     // resume execution after a short delay
//     const input = await vscode.window.showInputBox({
//         title: 'Answer to Hub: HubTrapRequest',
//         // prompt: `WeatherAtOffsetRequest received. Enter any text to send example response back to the hub.\n\nFormat: "location|temperature|windSpeed|precipitation|condition|windDirection|pressure|offset"\n`,
//         // value: 'Budapest | 12.3 | 21.5 | 0.1 | 1 | NE | 1013 | 0',
//         valueSelection: [0, 0],
//         ignoreFocusOut: true,
//     });
//     if (!input) {
//         console.log('No input, not sending response');
//         return;
//     }
//     await this.sendAppiData(
//         new Uint8Array([PIPMessageType.DebugAcknowledge, 0x04]),
//     );
// };
// setTimeout(() => void handleTrapMock(), 0);
