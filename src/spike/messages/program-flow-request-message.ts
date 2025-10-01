import { OutboundMessage } from './base-message';
import { ProgramFlowResponseMessage } from './program-flow-response-message';

export class ProgramFlowRequestMessage extends OutboundMessage {
    public static override readonly Id = 0x1e;

    constructor(public start: boolean, public slot?: number) {
        super();
        if (start && slot === undefined)
            throw new Error('Slot must be defined when starting a program');
    }

    public serialize(): Uint8Array {
        return new Uint8Array([
            ProgramFlowRequestMessage.Id,
            this.start ? 0x00 : 0x01,
            this.slot ?? 0,
        ]);
    }

    public acceptsResponse(): number {
        return ProgramFlowResponseMessage.Id;
    }
}
