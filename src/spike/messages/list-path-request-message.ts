import { OutboundMessage } from './base-message';
import { ListPathResponseMessage } from './list-path-response-message';

export class ListPathRequestMessage extends OutboundMessage {
    public static override readonly Id = 0x4a;

    constructor(public path: string, public slotNumber: number) {
        super();
    }

    public serialize(): Uint8Array {
        // path: up to 31 bytes + 0 terminator, slotNumber: 1 byte
        const encoder = new TextEncoder();
        const pathBytes = encoder.encode(this.path).slice(0, 31);
        const arr = new Uint8Array(1 + pathBytes.length + 1 + 1);
        arr[0] = ListPathRequestMessage.Id;
        arr.set(pathBytes, 1);
        arr[1 + pathBytes.length] = 0; // null terminator
        arr[1 + pathBytes.length + 1] = this.slotNumber & 0xff;
        return arr;
    }

    public acceptsResponse(): number {
        return ListPathResponseMessage.Id;
    }
}
