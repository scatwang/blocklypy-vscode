import { ResponseMessageWithStatus } from './base-message';

export class ClearSlotResponseMessage extends ResponseMessageWithStatus {
    public static override readonly Id = 0x47;

    constructor(public status: number = 0) {
        super();
    }

    static override fromBytes(data: Uint8Array): ClearSlotResponseMessage {
        const status = data[1];
        return new ClearSlotResponseMessage(status);
    }
}
