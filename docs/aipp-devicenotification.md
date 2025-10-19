# Device Notification packet

This encoding is defined by the LEGO standard
[DeviceNotification format](https://lego.github.io/spike-prime-docs/messages.html#x3c-devicenotification).

## Hub support

- SPIKE HubOSv3 devices use it in a built in manner, using their transport
  layer.
- Pybricks devices might add a user or built-in program to detect and send over
  the AIPP tunnel (see example below).

## Behavior

The extension offers selecting/filtering the incoming messages and plotting
them.  
See command: "Set HubOS Device Notification Plot Filter".

## Format

- `uint8` — Message type (`0x3C`)
- `uint16` — Payload size in bytes
- `uint8[payload_size]` — Payload as an array of device messages

## Device messages

The payload is a sequence of device messages. Each device message starts with a
`uint8` message type byte that determines the rest of the message format.

0x00 DeviceBattery

- Format
  - `uint8` — Message type (`0x00`)
  - `uint8` — Battery level in percent

0x01 DeviceImuValues

- Format
  - `uint8` — Message type (`0x01`)
  - `uint8` — Hub face pointing up
  - `uint8` — Hub face configured as yaw face
  - `int16` — Yaw (relative to configured yaw face)
  - `int16` — Pitch (relative to configured yaw face)
  - `int16` — Roll (relative to configured yaw face)
  - `int16` — Accelerometer X
  - `int16` — Accelerometer Y
  - `int16` — Accelerometer Z
  - `int16` — Gyroscope X
  - `int16` — Gyroscope Y
  - `int16` — Gyroscope Z

0x02 Device5x5MatrixDisplay

- Format
  - `uint8` — Message type (`0x02`)
  - `uint8[25]` — Pixel values for 5×5 display (row-major)

0x0A DeviceMotor

- Format
  - `uint8` — Message type (`0x0A`)
  - `uint8` — Hub port
  - `uint8` — Motor device type
  - `int16` — Absolute position in degrees (−180 .. 179)
  - `int16` — Power applied (−10000 .. 10000)
  - `int8` — Speed (−100 .. 100)
  - `int32` — Position (full 32-bit position)

0x0B DeviceForceSensor

- Format
  - `uint8` — Message type (`0x0B`)
  - `uint8` — Hub port
  - `uint8` — Measured value (0 .. 100)
  - `uint8` — Contact flag (`0x01` = pressure detected, `0x00` = not)

0x0C DeviceColorSensor

- Format
  - `uint8` — Message type (`0x0C`)
  - `uint8` — Hub port
  - `int8` — Detected color
  - `uint16` — Raw red (0 .. 1023)
  - `uint16` — Raw green (0 .. 1023)
  - `uint16` — Raw blue (0 .. 1023)

0x0D DeviceDistanceSensor

- Format
  - `uint8` — Message type (`0x0D`)
  - `uint8` — Hub port
  - `int16` — Distance in millimetres (40 .. 2000), `-1` if no object detected

0x0E Device3x3ColorMatrix

- Format
  - `uint8` — Message type (`0x0E`)
  - `uint8` — Hub port
  - `uint8[9]` — 3×3 pixel values; each byte: high nibble = brightness, low
    nibble = color

## Notes

- Device messages are concatenated inside the payload; use the leading type byte
  and the known per-type length to parse sequentially.
- All integer fields use big-endian encoding.
- Keeps payload size consistent with the sum of contained device message
  lengths.
- Follows the same tunnel framing and checksum rules when sending
  DeviceNotification messages over the AIPP tunnel.

## HubMonitor.py

Hub Device Monitor is an extension app over AIPP tunnel. An example
implenetation is delivered with the blocklypy-vscode extension.

- HubMonitor encodes battery, IMU and peripheral device data into a device
  notification payload (type 0x3C, then a length + device payloads).
- Typical encoded pieces:
  - Battery: tag 0x00 + percent (uint8)
  - IMU: tag 0x01 + orientation/tilt/accel/gyro
  - Motors, force, color, distance encoded per-device with small packed records
- aipp_send() in hubmonitor.py demonstrates sending device notifications over
  the same tunnel framing:

  - Appends checksum
  - Splits into chunks with 0xFE/0xFF start markers and 0x00/0xFF end markers
  - Writes chunks with a small wait between chunks
