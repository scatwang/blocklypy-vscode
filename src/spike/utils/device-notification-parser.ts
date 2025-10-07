import { DeviceNotificationMessage } from '../messages/device-notification-message';
import { DataViewExtended } from './dataview-extended';

const DeviceNoficicationLittleEndian = true; // little-endian
const MAX_PAYLOAD_SIZE = 512;

export enum DeviceNotificationMessageType {
    Battery = 0,
    ImuValues = 1,
    MatrixDisplay5x5 = 2,
    Motor = 10,
    ForceSensor = 11,
    ColorSensor = 12,
    DistanceSensor = 13,
    ColorMatrix3x3 = 14,
    Unknown = -1,
}

export type DeviceNotificationPayload =
    | {
          readonly type: DeviceNotificationMessageType.Battery;
          readonly batteryLevel: number;
      }
    | {
          readonly type: DeviceNotificationMessageType.ImuValues;
          readonly faceUp: number;
          readonly yawFace: number;
          readonly yaw: number;
          readonly pitch: number;
          readonly roll: number;
          readonly accX: number;
          readonly accY: number;
          readonly accZ: number;
          readonly gyroX: number;
          readonly gyroY: number;
          readonly gyroZ: number;
      }
    | {
          readonly type: DeviceNotificationMessageType.MatrixDisplay5x5;
          readonly pixels: readonly number[];
      }
    | {
          readonly type: DeviceNotificationMessageType.Motor;
          readonly port: number;
          readonly deviceType: number;
          readonly absPos: number;
          readonly power: number;
          readonly speed: number;
          readonly position: number;
      }
    | {
          readonly type: DeviceNotificationMessageType.ForceSensor;
          readonly port: number;
          readonly value: number;
          readonly pressed: boolean;
      }
    | {
          readonly type: DeviceNotificationMessageType.ColorSensor;
          readonly port: number;
          readonly color: number;
          readonly red: number;
          readonly green: number;
          readonly blue: number;
      }
    | {
          readonly type: DeviceNotificationMessageType.DistanceSensor;
          readonly port: number;
          readonly distance: number;
      }
    | {
          readonly type: DeviceNotificationMessageType.ColorMatrix3x3;
          readonly port: number;
          readonly pixels: readonly number[];
      }
    | {
          readonly type: DeviceNotificationMessageType.Unknown;
          readonly msgType: number;
          readonly raw: Uint8Array;
      };

export function checkIsDeviceNotification(data: Uint8Array): number | undefined {
    const view = new DataViewExtended(data, 0, DeviceNoficicationLittleEndian);

    const msgType = view.readInt8();
    if (msgType !== DeviceNotificationMessage.Id) return undefined;

    const payloadSize = view.readInt16();
    if (payloadSize > MAX_PAYLOAD_SIZE) return undefined;

    return payloadSize;
}

function parseDeviceNotificationElem(
    view: DataViewExtended,
): DeviceNotificationPayload {
    const type = view.readUInt8() as DeviceNotificationMessageType;
    switch (type) {
        case DeviceNotificationMessageType.Battery: {
            const batteryLevel = view.readUInt8();
            return { type, batteryLevel };
        }
        case DeviceNotificationMessageType.ImuValues: {
            const faceUp = view.readUInt8();
            const yawFace = view.readUInt8();
            const yaw = view.readInt16();
            const pitch = view.readInt16();
            const roll = view.readInt16();
            const accX = view.readInt16();
            const accY = view.readInt16();
            const accZ = view.readInt16();
            const gyroX = view.readInt16();
            const gyroY = view.readInt16();
            const gyroZ = view.readInt16();
            return {
                type,
                faceUp,
                yawFace,
                yaw,
                pitch,
                roll,
                accX,
                accY,
                accZ,
                gyroX,
                gyroY,
                gyroZ,
            };
        }
        case DeviceNotificationMessageType.MatrixDisplay5x5: {
            const pixels: number[] = Array.from(view.readBuffer(25));
            return { type, pixels };
        }
        case DeviceNotificationMessageType.Motor: {
            const port = view.readUInt8();
            const deviceType = view.readUInt8();
            const absPos = view.readInt16();
            const power = view.readInt16();
            const speed = view.readInt8();
            const position = view.readInt32();
            return {
                type,
                port,
                deviceType,
                absPos,
                power,
                speed,
                position,
            };
        }
        case DeviceNotificationMessageType.ForceSensor: {
            const port = view.readUInt8();
            const value = view.readUInt8();
            const pressed = view.readBool();
            return { type, port, value, pressed };
        }
        case DeviceNotificationMessageType.ColorSensor: {
            const port = view.readUInt8();
            const color = view.readInt8();
            const red = view.readUInt16();
            const green = view.readUInt16();
            const blue = view.readUInt16();
            return { type, port, color, red, green, blue };
        }
        case DeviceNotificationMessageType.DistanceSensor: {
            const port = view.readUInt8();
            const distance = view.readInt16();
            return { type, port, distance };
        }
        case DeviceNotificationMessageType.ColorMatrix3x3: {
            const port = view.readUInt8();
            const pixels: number[] = Array.from(view.readBuffer(9));
            return { type, port, pixels };
        }
        default: {
            // Unknown message type - read all remaining data
            return {
                type: DeviceNotificationMessageType.Unknown,
                msgType: type,
                raw: view.readBuffer(view.length - view.offset),
            };
        }
    }
}

export function parseDeviceNotificationPayloads(data: Uint8Array): {
    payloads: DeviceNotificationPayload[];
    length: number;
} {
    const payloadSize = checkIsDeviceNotification(data);
    if (!payloadSize) throw new Error('Invalid DeviceNotification');

    // Skip header - id (1) + length (2)
    const view = new DataViewExtended(data, 3, DeviceNoficicationLittleEndian);
    const retval: DeviceNotificationPayload[] = [];
    while (view.offset < Math.min(payloadSize + 3, data.byteLength)) {
        const elem = parseDeviceNotificationElem(view);
        retval.push(elem);
    }
    return { payloads: retval, length: view.offset };
}
