import { OutboundMessage } from './base-message';
import { DeviceUuidResponseMessage } from './device-uuid-response-message';

export class DeviceUuidRequestMessage extends OutboundMessage {
    public static override readonly Id = 0x1a;

    public serialize(): Uint8Array {
        return new Uint8Array([DeviceUuidRequestMessage.Id]);
    }

    public acceptsResponse(): number {
        return DeviceUuidResponseMessage.Id;
    }
}
