/** Pybricks Instrumentation Protocol (PIP)
 *
 * Conveys debug and plot messages from Pybricks MicroPython over the SPIKE app data channel.
 * Uses COBS framing for message boundaries.
 */
import { handleIncomingAIPPDebug } from '../debug-tunnel/debugtunnel-appdata-helper';
import { DeviceNotificationMessage } from '../spike/messages/device-notification-message';
import { TunnelNotificationMessage } from '../spike/messages/tunnel-notification-message';
import { TunnelRequestMessage } from '../spike/messages/tunnel-request-message';
import { DataViewExtended } from '../spike/utils/dataview-extended';

export const AIPP_MODULE_NAME = 'aipp'; // name of the module to import in user code - file name without .py

/**
 * Supported message types.
 */
export enum MessageType {
    DeviceNotification = DeviceNotificationMessage.Id, // uses little-endian
    TunnelNotification = TunnelNotificationMessage.Id, // uses big-endian
    DebugAcknowledge = 0x70, // uses little-endian
    DebugNotification = 0x71, // uses little-endian
    PlotAcknowledge = 0x72, // uses little-endian
    PlotNotification = 0x73, // uses little-endian
}

const DebugMessageLittleEndian = true; // little-endian
const PlotMessageLittleEndian = true; // little-endian

export enum DebugSubCode {
    StartAcknowledge = 0x00,
    StartNotification = 0x01,
    TrapAcknowledge = 0x02,
    TrapNotification = 0x03,
    ContinueRequest = 0x04,
    ContinueResponse = 0x05,
    GetVariableRequest = 0x06,
    GetVariableResponse = 0x07,
    SetVariableRequest = 0x08,
    SetVariableResponse = 0x09,
    //!! add control/terminate request
}

export enum PlotSubCode {
    Ack = 0x00,
    Define = 0x01,
    UpdateCells = 0x02,
    UpdateRow = 0x03,
}

/**
 * Supported variable types for debug messages.
 */
export enum VarType {
    None = 0,
    Int = 1,
    Float = 2,
    String = 3,
    Bool = 4,
}

enum PacketContinuation {
    NoContinuation = 0x00,
    HasContinuation = 0xff,
}

const AIPP_MTU = 19; // max size of appdata packet payload

export type DebugMessage =
    | {
          Id: MessageType.DebugNotification;
          subcode: DebugSubCode.StartNotification;
      }
    | {
          Id: MessageType.DebugAcknowledge;
          subcode: DebugSubCode.StartAcknowledge;
          success: boolean;
      }
    | {
          Id: MessageType.DebugNotification;
          subcode: DebugSubCode.TrapNotification;
          filename: string;
          line: number;
      }
    | {
          Id: MessageType.DebugAcknowledge;
          subcode: DebugSubCode.TrapAcknowledge;
          success: boolean;
      }
    | {
          Id: MessageType.DebugAcknowledge;
          subcode: DebugSubCode.ContinueRequest;
          step: boolean;
      }
    | {
          Id: MessageType.DebugNotification;
          subcode: DebugSubCode.ContinueResponse;
      }
    | {
          Id: MessageType.DebugAcknowledge;
          subcode: DebugSubCode.GetVariableRequest;
          varname: string;
      }
    | {
          Id: MessageType.DebugNotification;
          subcode: DebugSubCode.GetVariableResponse;
          varname: string;
          type: VarType;
          value: number | string | boolean | null;
      }
    | {
          Id: MessageType.DebugAcknowledge;
          subcode: DebugSubCode.SetVariableRequest;
          varname: string;
          type: VarType;
          value: number | string | boolean | null;
      }
    | {
          Id: MessageType.DebugNotification;
          subcode: DebugSubCode.SetVariableResponse;
          success: boolean;
      };

export type PlotMessage =
    | {
          Id: MessageType.PlotAcknowledge;
          subcode: PlotSubCode.Ack;
      }
    | {
          Id: MessageType.PlotNotification;
          subcode: PlotSubCode.Define;
          columns: string[];
      }
    | {
          Id: MessageType.PlotNotification;
          subcode: PlotSubCode.UpdateCells;
          values: { name: string; value: number }[];
      }
    | {
          Id: MessageType.PlotNotification;
          subcode: PlotSubCode.UpdateRow;
          values: number[];
      };

export type Message =
    | DebugMessage
    | PlotMessage
    | DeviceNotificationMessage
    | TunnelNotificationMessage;

const MAX_DEBUG_MESSAGE_SIZE = 1024;

/**
 * Computes a simple 8-bit checksum by summing all bytes.
 * The result is modulo 256.
 *
 * @param data The bytes-like object to checksum.
 * @returns The 8-bit checksum (0-255).
 */
function simpleSumChecksum(data: Uint8Array | Buffer): number {
    let checksum = 0;
    for (const byte of data) {
        checksum += byte;
    }
    return checksum & 0xff;
}

/**
 * Encode a debug message (raw, without COBS).
 * Returns the raw Uint8Array.
 */
function encodeDebugMessageRaw(data: DebugMessage): Uint8Array {
    const buffer = new Uint8Array(MAX_DEBUG_MESSAGE_SIZE);
    const dataview = new DataViewExtended(buffer, 0, DebugMessageLittleEndian);

    dataview.writeUInt8(data.Id);
    dataview.writeUInt8(data.subcode);

    switch (data.subcode) {
        case DebugSubCode.StartNotification:
        case DebugSubCode.ContinueResponse:
            // nothing to add
            break;

        case DebugSubCode.TrapNotification:
            // filename: zstring, line: uint16
            dataview.writeString(data.filename);
            dataview.writeUInt16(data.line);
            break;

        case DebugSubCode.GetVariableResponse:
            // varname: zstring, type: uint8, value: depends on type
            dataview.writeString(data.varname);
            dataview.writeUInt8(data.type);
            switch (data.type) {
                case VarType.Int:
                    dataview.writeInt32(data.value as number);
                    break;
                case VarType.Float:
                    dataview.writeFloat(data.value as number);
                    break;
                case VarType.String:
                    dataview.writeString(data.value as string);
                    break;
                case VarType.Bool:
                    dataview.writeBool(data.value as boolean);
                    break;
                default:
                    // None, write nothing
                    break;
            }
            break;

        case DebugSubCode.SetVariableResponse:
            // success: boolean
            dataview.writeBool(data.success);
            break;

        case DebugSubCode.GetVariableRequest:
            // varname: zstring
            dataview.writeString(data.varname);
            break;

        case DebugSubCode.SetVariableRequest:
            // varname: zstring, type: uint8, value: depends on type
            dataview.writeString(data.varname);
            dataview.writeUInt8(data.type);
            switch (data.type) {
                case VarType.Int:
                    dataview.writeInt32(data.value as number);
                    break;
                case VarType.Float:
                    dataview.writeFloat(data.value as number);
                    break;
                case VarType.String:
                    dataview.writeString(data.value as string);
                    break;
                case VarType.Bool:
                    dataview.writeBool(data.value as boolean);
                    break;
                default:
                    // None, write nothing
                    break;
            }
            break;

        case DebugSubCode.StartAcknowledge:
        case DebugSubCode.TrapAcknowledge:
            // success: boolean
            dataview.writeBool(data.success);
            break;

        case DebugSubCode.ContinueRequest:
            // step: boolean
            dataview.writeBool(data.step);
            break;

        default:
            throw new Error('Unknown debug subcode');
    }

    return buffer.slice(0, dataview.offset);
}

/**
 * Decode a debug message from a raw Uint8Array (no COBS).
 * Returns an object with filename, line, and variables.
 */
function decodeDebugMessageRaw(data: Uint8Array): DebugMessage {
    const dataview = new DataViewExtended(data, 0, DebugMessageLittleEndian);
    const msgtype = dataview.readUInt8();
    if (msgtype !== MessageType.DebugNotification)
        throw new Error('Not a debug message');

    const subcode = dataview.readUInt8();

    switch (subcode) {
        case DebugSubCode.StartNotification:
            return {
                Id: MessageType.DebugNotification,
                subcode: DebugSubCode.StartNotification,
            };
        case DebugSubCode.StartAcknowledge:
            return {
                Id: MessageType.DebugAcknowledge,
                subcode: DebugSubCode.StartAcknowledge,
                success: dataview.readBool(),
            };
        case DebugSubCode.TrapNotification:
            return {
                Id: MessageType.DebugNotification,
                subcode: DebugSubCode.TrapNotification,
                filename: dataview.readString(),
                line: dataview.readUInt16(),
            };
        case DebugSubCode.TrapAcknowledge:
            return {
                Id: MessageType.DebugAcknowledge,
                subcode: DebugSubCode.TrapAcknowledge,
                success: dataview.readBool(),
            };
        case DebugSubCode.ContinueRequest:
            // Not implemented in encode, but could be added here if needed
            throw new Error('ContinueRequest decode not implemented');
        case DebugSubCode.ContinueResponse:
            return {
                Id: MessageType.DebugNotification,
                subcode: DebugSubCode.ContinueResponse,
            };
        case DebugSubCode.GetVariableRequest:
            return {
                Id: MessageType.DebugAcknowledge,
                subcode: DebugSubCode.GetVariableRequest,
                varname: dataview.readString(),
            };
        case DebugSubCode.GetVariableResponse: {
            const varname = dataview.readString();
            const type = dataview.readUInt8();
            let value: number | string | boolean | null = null;
            switch (type) {
                case VarType.Int:
                    value = dataview.readInt32();
                    break;
                case VarType.Float:
                    value = dataview.readFloat();
                    break;
                case VarType.String:
                    value = dataview.readString();
                    break;
                case VarType.Bool:
                    value = dataview.readBool();
                    break;
                default:
                    value = null;
            }
            return {
                Id: MessageType.DebugNotification,
                subcode: DebugSubCode.GetVariableResponse,
                varname,
                type,
                value,
            };
        }
        case DebugSubCode.SetVariableRequest: {
            const varname = dataview.readString();
            const type = dataview.readUInt8();
            let value: number | string | boolean | null = null;
            switch (type) {
                case VarType.Int:
                    value = dataview.readInt32();
                    break;
                case VarType.Float:
                    value = dataview.readFloat();
                    break;
                case VarType.String:
                    value = dataview.readString();
                    break;
                case VarType.Bool:
                    value = dataview.readBool();
                    break;
                default:
                    value = null;
            }
            return {
                Id: MessageType.DebugAcknowledge,
                subcode: DebugSubCode.SetVariableRequest,
                varname,
                type,
                value,
            };
        }
        case DebugSubCode.SetVariableResponse:
            return {
                Id: MessageType.DebugNotification,
                subcode: DebugSubCode.SetVariableResponse,
                success: dataview.readBool(),
            };
        default:
            throw new Error('Unknown debug subcode');
    }
}
/**
 * Encode a plot message (raw, without COBS).
 * @param data
 * @returns The raw Uint8Array.
 */
function encodePlotMessageRaw(data: PlotMessage): Uint8Array {
    const buffer = new Uint8Array(MAX_DEBUG_MESSAGE_SIZE);
    const dataview = new DataViewExtended(buffer, 0, PlotMessageLittleEndian);

    dataview.writeUInt8(data.Id);
    dataview.writeUInt8(data.subcode);

    switch (data.subcode) {
        case PlotSubCode.Ack:
            // nothing to add
            break;

        case PlotSubCode.Define:
            // columns: uint8 count, then zstring for each
            dataview.writeUInt8(data.columns.length);
            for (const col of data.columns) {
                dataview.writeString(col);
            }
            break;

        case PlotSubCode.UpdateCells:
            // values: uint8 count, then (zstring, float) for each
            dataview.writeUInt8(data.values.length);
            for (const v of data.values) {
                dataview.writeString(v.name);
                dataview.writeFloat(v.value);
            }
            break;

        case PlotSubCode.UpdateRow:
            // values: uint8 count, then float for each
            dataview.writeUInt8(data.values.length);
            for (const v of data.values) {
                dataview.writeFloat(v);
            }
            break;

        default:
            throw new Error('Unknown plot subcode');
    }

    return buffer.slice(0, dataview.offset);
}

/**
 * Decode a plot message from a raw Uint8Array (no COBS).
 * Returns an object with columns and values.
 */
function decodePlotMessageRaw(data: Uint8Array): PlotMessage {
    const dataview = new DataViewExtended(data, 0, PlotMessageLittleEndian);
    const msgtype = dataview.readUInt8();
    if (msgtype !== MessageType.PlotNotification) throw new Error('Not a plot message');

    const subcode = dataview.readUInt8();

    switch (subcode) {
        case PlotSubCode.Ack:
            return {
                Id: MessageType.PlotAcknowledge,
                subcode: PlotSubCode.Ack,
            };
        case PlotSubCode.Define: {
            const count = dataview.readUInt8();
            const columns: string[] = [];
            for (let i = 0; i < count; i++) {
                columns.push(dataview.readString());
            }
            return {
                Id: MessageType.PlotNotification,
                subcode: PlotSubCode.Define,
                columns,
            };
        }
        case PlotSubCode.UpdateCells: {
            const count = dataview.readUInt8();
            const values: { name: string; value: number }[] = [];
            for (let i = 0; i < count; i++) {
                const name = dataview.readString();
                const value = dataview.readFloat();
                values.push({ name, value });
            }
            return {
                Id: MessageType.PlotNotification,
                subcode: PlotSubCode.UpdateCells,
                values,
            };
        }
        case PlotSubCode.UpdateRow: {
            const count = dataview.readUInt8();
            const values: number[] = [];
            for (let i = 0; i < count; i++) {
                values.push(dataview.readFloat());
            }
            return {
                Id: MessageType.PlotNotification,
                subcode: PlotSubCode.UpdateRow,
                values,
            };
        }
        default:
            throw new Error('Unknown plot subcode');
    }
}

/**
 * Encode a Pybricks Instrumentation Protocol (PIP) message to a raw Uint8Array (no COBS).
 * Returns the raw Uint8Array.
 */
export function encodeMessageRaw(message: Message): Uint8Array {
    switch (message.Id) {
        case MessageType.DebugAcknowledge:
            return encodeDebugMessageRaw(message as DebugMessage);
        case MessageType.PlotAcknowledge:
            return encodePlotMessageRaw(message as PlotMessage);
        case MessageType.DeviceNotification:
            // TODO: consider implementing
            throw new Error('Cannot encode device notification message');
        case MessageType.TunnelNotification:
            return (message as TunnelRequestMessage).serialize();
        default:
            throw new Error('Unknown message type');
    }
}

/**
 * Decode a Pybricks Instrumentation Protocol (PIP) message from a raw Uint8Array (no COBS).
 */
export function decodeMessageRaw(data: Uint8Array): Message {
    const msgtype = data[0];
    switch (msgtype) {
        case MessageType.DebugNotification:
            return decodeDebugMessageRaw(data);
        case MessageType.PlotNotification:
            return decodePlotMessageRaw(data);
        case MessageType.DeviceNotification:
            return DeviceNotificationMessage.fromBytes(data);
        case MessageType.TunnelNotification:
            return TunnelNotificationMessage.fromBytes(
                data,
            ) as TunnelNotificationMessage;
        default:
            throw new Error('Unknown message type');
    }
}

export class AppDataInstrumentationPybricksProtocol {
    public static encode(payload: Message): ArrayBuffer[] {
        const encoded0 = encodeMessageRaw(payload);
        const encoded1 = Buffer.from([...encoded0, simpleSumChecksum(encoded0)]);

        // split into chunks of MTU size (AIPP_MTU)
        const chunks: ArrayBuffer[] = [];
        for (let i = 0; i < encoded1.length; i += AIPP_MTU) {
            const firstPacket = i === 0;
            const maxPacketSize = AIPP_MTU - (firstPacket ? 0 : 1) - 1; // minus initial continuation byte not first, minus end byte
            const packet_size = Math.min(maxPacketSize, encoded1.length - i);
            const chunk = encoded1.subarray(i, i + packet_size);
            const isLastChunk = i + packet_size >= encoded1.length;
            const packet = Buffer.from([
                ...(i === 0 ? [] : [PacketContinuation.HasContinuation]), // initial continuation byte if not first packet
                ...chunk,
                isLastChunk
                    ? PacketContinuation.NoContinuation
                    : PacketContinuation.HasContinuation,
            ]);
            chunks.push(
                packet.buffer.slice(
                    packet.byteOffset,
                    packet.byteOffset + packet.byteLength,
                ),
            );
        }
        return chunks;
    }

    static appDataBuffer: Uint8Array = Buffer.alloc(0); // buffer for assembling appdata packets
    public static reset() {
        this.appDataBuffer = Buffer.alloc(0);
    }

    public static async decode(data: Uint8Array): Promise<ArrayBuffer | undefined> {
        const isFirstPacket = data[0] !== 0xff;
        const hasContinuation = data[data.length - 1] === 0xff;
        data = data.subarray(isFirstPacket ? 0 : 1, data.length - /* continuation */ 1);

        //-- assemble packets
        // logDebug(
        //     `App data received (len=${
        //         data.length
        //     }, first=${isFirstPacket}, cont=${hasContinuation}): ${Buffer.from(
        //         new Uint8Array(data),
        //     ).toString('hex')}`,
        // );
        if (isFirstPacket && this.appDataBuffer.length > 0) {
            console.error('Received new appdata while previous incomplete');
            this.appDataBuffer = data;
        }
        if (!isFirstPacket && this.appDataBuffer.length === 0) {
            console.error('Received continuation appdata without previous data');
            return; // ignore
        }
        if (hasContinuation) {
            this.appDataBuffer = Buffer.concat([this.appDataBuffer, data]);
            return; // wait for more data
        }

        //-- last packet - complete message
        // process complete chunks
        const buffer = Buffer.concat([
            this.appDataBuffer,
            data.subarray(0, data.length - 1),
        ]);
        const checksum = data[data.length - 1];
        this.appDataBuffer = Buffer.alloc(0); // reset buffer

        if (simpleSumChecksum(buffer) !== checksum) {
            console.error(
                'App data checksum mismatch',
                simpleSumChecksum(buffer),
                checksum,
            );
            throw new Error('App data checksum mismatch');
        }

        //-- decode incoming message
        const message = decodeMessageRaw(buffer);
        const msgtype = buffer[0];
        switch (msgtype) {
            case MessageType.DebugNotification: {
                await handleIncomingAIPPDebug(message as DebugMessage);
                break;
            }
        }
    }
}
