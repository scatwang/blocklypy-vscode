import {
    DeviceNotificationPayload,
    parseDeviceNotificationPayloads,
} from '../utils/device-notification-parser';
import { InboundMessage } from './base-message';

export class DeviceNotificationMessage extends InboundMessage {
    public static override readonly Id = 0x3c;

    constructor(public payloads: DeviceNotificationPayload[]) {
        super();
    }

    public static override fromBytes(data: Uint8Array): DeviceNotificationMessage {
        const { payloads } = parseDeviceNotificationPayloads(data);
        return new DeviceNotificationMessage(payloads);
    }
}
