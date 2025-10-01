import {
    encodeTunnelMessage,
    TunnelPayload,
} from '../utils/tunnel-notification-parser';
import { OutboundMessage } from './base-message';
import { TunnelNotificationMessage } from './tunnel-notification-message';

/**
 * Message to send data through the tunnel.
 * Intentionally same Id as TunnelResponseMessage to separate handling.
 */

export class TunnelRequestMessage extends OutboundMessage {
    public static override readonly Id = 0x32;

    constructor(public tunnelData?: TunnelPayload[]) {
        super();
    }

    public serialize(): Uint8Array {
        const buf = encodeTunnelMessage(this.tunnelData || []);
        return buf;
    }

    public override acceptsResponse(): number {
        return TunnelNotificationMessage.Id;
    }
}
