import {
    decodeTunnelMessage,
    TunnelPayload,
} from '../utils/tunnel-notification-parser';
import { InboundMessage } from './base-message';

/**
 * Message to receive from the tunnel.
 * Intentionally same Id as TunnelRequestMessage to separate handling.
 */

export class TunnelNotificationMessage extends InboundMessage {
    public static override readonly Id = 0x32;

    constructor(public tunnelData: TunnelPayload[]) {
        super();
    }

    public static override fromBytes(data: Uint8Array): InboundMessage {
        const payload = decodeTunnelMessage(data);

        return new TunnelNotificationMessage(payload);
    }
}
