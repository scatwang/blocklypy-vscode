/** HubOS (SPIKE Prime and Robot Inventor) messages
 * according to the documentation at
 * ref: https://lego.github.io/spike-prime-docs/
 */
import { InboundMessage } from './base-message';
import { BeginFirmwareUpdateResponseMessage } from './begin-firmware-update-response-message';
import { ClearSlotResponseMessage } from './clear-slot-response-message';
import { ConsoleNotificationMessage } from './console-notification-message';
import { DeletePathResponseMessage } from './delete-path-response-message';
import { DeviceNotificationMessage } from './device-notification-message';
import { DeviceNotificationResponseMessage } from './device-notification-response-message';
import { DeviceUuidResponseMessage } from './device-uuid-response-message';
import { GetHubNameResponseMessage } from './get-hub-name-response-message';
import { InfoResponseMessage } from './info-response-message';
import { ListPathResponseMessage } from './list-path-response-message';
import { MoveSlotResponseMessage } from './move-slot-response-message';
import { ProgramFlowNotificationMessage } from './program-flow-notification-message';
import { ProgramFlowResponseMessage } from './program-flow-response-message';
import { SetHubNameResponseMessage } from './set-hub-name-response-message';
import { StartFileDownloadResponseMessage } from './start-file-download-response-message';
import { StartFileUploadResponseMessage } from './start-file-upload-response-message';
import { StartFirmwareUploadResponseMessage } from './start-firmware-upload-response-message';
import { TransferChunkResponseMessage } from './transfer-chunk-response-message';
import { TunnelNotificationMessage } from './tunnel-notification-message';

type InboundMessageConstructor = {
    Id: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (...args: any[]): InboundMessage;
    fromBytes(data: Uint8Array): InboundMessage;
};

export const HubOSInboundMessageMap: { [id: number]: InboundMessageConstructor } = {
    // [InfoRequestMessage.Id]: InfoRequestMessage, // 0x00
    [InfoResponseMessage.Id]: InfoResponseMessage, // 0x01
    // [StartFirmwareUploadRequestMessage.Id]: StartFirmwareUploadRequestMessage, // 0x0a
    [StartFirmwareUploadResponseMessage.Id]: StartFirmwareUploadResponseMessage, // 0x0b
    // [StartFileUploadRequestMessage.Id]: StartFileUploadRequestMessage, // 0x0c
    [StartFileUploadResponseMessage.Id]: StartFileUploadResponseMessage, // 0x0d
    // [StartFileDownloadRequestMessage.Id]: StartFileDownloadRequestMessage, // 0x0e
    [StartFileDownloadResponseMessage.Id]: StartFileDownloadResponseMessage, // 0x0f
    // [TransferChunkRequestMessage.Id]: TransferChunkRequestMessage, // 0x10
    [TransferChunkResponseMessage.Id]: TransferChunkResponseMessage, // 0x11
    // [BeginFirmwareUpdateRequestMessage.Id]: BeginFirmwareUpdateRequestMessage, // 0x14
    [BeginFirmwareUpdateResponseMessage.Id]: BeginFirmwareUpdateResponseMessage, // 0x15
    // [SetHubNameRequestMessage.Id]: SetHubNameRequestMessage, // 0x16
    [SetHubNameResponseMessage.Id]: SetHubNameResponseMessage, // 0x17
    // [GetHubNameRequestMessage.Id]: GetHubNameRequestMessage, // 0x18
    [GetHubNameResponseMessage.Id]: GetHubNameResponseMessage, // 0x19
    // [DeviceUuidRequestMessage.Id]: DeviceUuidRequestMessage, // 0x1a
    [DeviceUuidResponseMessage.Id]: DeviceUuidResponseMessage, // 0x1b
    // [ProgramFlowRequestMessage.Id]: ProgramFlowRequestMessage, // 0x1e
    [ProgramFlowResponseMessage.Id]: ProgramFlowResponseMessage, // 0x1f
    [ProgramFlowNotificationMessage.Id]: ProgramFlowNotificationMessage, // 0x20
    [ConsoleNotificationMessage.Id]: ConsoleNotificationMessage, // 0x21
    // [DeviceNotificationRequestMessage.Id]: DeviceNotificationRequestMessage, // 0x28
    [DeviceNotificationResponseMessage.Id]: DeviceNotificationResponseMessage, // 0x29
    [DeviceNotificationMessage.Id]: DeviceNotificationMessage, // 0x3c
    //TunnelRequestMessage.Id]: TunnelRequestMessage, // 0x32 --- IGNORE ---
    [TunnelNotificationMessage.Id]: TunnelNotificationMessage, // 0x32
    // [ClearSlotRequestMessage.Id]: ClearSlotRequestMessage, // 0x46
    [ClearSlotResponseMessage.Id]: ClearSlotResponseMessage, // 0x47
    // [MoveSlotRequestMessage.Id]: MoveSlotRequestMessage, // 0x48
    [MoveSlotResponseMessage.Id]: MoveSlotResponseMessage, // 0x49
    // [ListPathRequestMessage.Id]: ListPathRequestMessage, // 0x4a
    [ListPathResponseMessage.Id]: ListPathResponseMessage, // 0x4b
    // [DeletePathRequestMessage.Id]: DeletePathRequestMessage, // 0x4c
    [DeletePathResponseMessage.Id]: DeletePathResponseMessage, // 0x4d
};

export function decodeHubOSInboundMessage(
    data: Uint8Array,
): [id: number, message: InboundMessage] {
    const id = data[0];
    const MessageClass = HubOSInboundMessageMap[id];
    if (!MessageClass) {
        throw new Error(`Unknown message ID: ${id}`);
    }
    const message = MessageClass.fromBytes(data);
    return [id, message];
}
