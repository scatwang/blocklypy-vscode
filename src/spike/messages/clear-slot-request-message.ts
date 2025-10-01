import { OutboundMessage } from './base-message';
import { ClearSlotResponseMessage } from './clear-slot-response-message';

export class ClearSlotRequestMessage extends OutboundMessage {
    public static override readonly Id = 0x46;

    constructor(public slot: number) {
        super();
    }

    public serialize(): Uint8Array {
        return new Uint8Array([ClearSlotRequestMessage.Id, this.slot]);
    }

    public acceptsResponse(): number {
        return ClearSlotResponseMessage.Id;
    }
}
