import { ResponseMessageWithStatus } from './base-message';

export class MoveSlotResponseMessage extends ResponseMessageWithStatus {
    public static override readonly Id = 0x49;

    constructor(public status: number = 0) {
        super();
    }

    public static override fromBytes(data: Uint8Array): MoveSlotResponseMessage {
        const status = data[1];
        return new MoveSlotResponseMessage(status);
    }
}
