import { ResponseMessageWithStatus } from './base-message';

export class TransferChunkResponseMessage extends ResponseMessageWithStatus {
    public static override readonly Id = 0x11;

    constructor(public status: number = 0) {
        super();
    }

    public static override fromBytes(data: Uint8Array): TransferChunkResponseMessage {
        const status = data[1];
        return new TransferChunkResponseMessage(status);
    }
}
