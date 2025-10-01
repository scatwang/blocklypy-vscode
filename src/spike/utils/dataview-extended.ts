export class DataViewExtended {
    private _view: DataView;
    constructor(
        private bytes: Uint8Array,
        public offset: number,
        private littleEndian: boolean,
    ) {
        this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }

    readInt8(): number {
        const value = this._view.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    readUInt8(): number {
        const value = this._view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readInt16(): number {
        const value = this._view.getInt16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }

    readUInt16(): number {
        const value = this._view.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }

    readInt32(): number {
        const value = this._view.getInt32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    readUInt32(): number {
        const value = this._view.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    readFloat(): number {
        const value = this._view.getFloat32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    readBool(): boolean {
        const value = this._view.getUint8(this.offset) !== 0;
        this.offset += 1;
        return value;
    }

    readString(): string {
        let strBytes: number[] = [];
        while (this._view.getUint8(this.offset) !== 0) {
            strBytes.push(this._view.getUint8(this.offset));
            this.offset++;
        }
        this.offset++;
        return Buffer.from(strBytes).toString('utf8');
    }

    readBuffer(length: number): Uint8Array {
        const value = this.bytes.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    /// --- Writing methods ---
    writeInt8(value: number): void {
        this._view.setInt8(this.offset, value);
        this.offset += 1;
    }

    writeUInt8(value: number): void {
        this._view.setUint8(this.offset, value);
        this.offset += 1;
    }

    writeInt16(value: number): void {
        this._view.setInt16(this.offset, value, this.littleEndian);
        this.offset += 2;
    }

    writeUInt16(value: number): void {
        this._view.setUint16(this.offset, value, this.littleEndian);
        this.offset += 2;
    }

    writeInt32(value: number): void {
        this._view.setInt32(this.offset, value, this.littleEndian);
        this.offset += 4;
    }

    writeUInt32(value: number): void {
        this._view.setUint32(this.offset, value, this.littleEndian);
        this.offset += 4;
    }

    writeFloat(value: number): void {
        this._view.setFloat32(this.offset, value, this.littleEndian);
        this.offset += 4;
    }

    writeBool(value: boolean): void {
        this._view.setUint8(this.offset, value ? 1 : 0);
        this.offset += 1;
    }

    writeString(value: string): void {
        const strBytes = Buffer.from(value, 'utf8');
        new Uint8Array(this._view.buffer).set(strBytes, this.offset);
        this.offset += strBytes.length;
        this._view.setUint8(this.offset, 0); // null terminator
        this.offset += 1;
    }

    writeBuffer(value: Uint8Array): void {
        new Uint8Array(this._view.buffer).set(value, this.offset);
        this.offset += value.length;
    }

    get length(): number {
        return this.bytes.length;
    }
}
