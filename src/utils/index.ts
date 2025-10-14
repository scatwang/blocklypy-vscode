export function bufferToHexString(buffer: ArrayBuffer | Uint8Array): string {
    return Array.prototype.map
        .call(new Uint8Array(buffer), (x: number) => ('00' + x.toString(16)).slice(-2))
        .join(' ');
}

export function hexStringToBuffer(hexString: string): ArrayBuffer {
    const hex = hexString.replace(/[^a-fA-F0-9]/g, '');
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes.buffer;
}
