# AIPP: AppData Instrumentation Protocol for Pybricks

## Summary

AIPP (AppData Instrumentation Protocol for Pybricks) is a tiny binary protocol
that tunnels telemetry, plot and debugger messages over the Pybricks AppData
channel. It is implemented for MicroPython on Pybricks hubs and is optimized for
constrained MTU sizes and simple host/hub interactions (handshake, trap,
set-variable, continue).

## AIPP Tunnel framing and checksums

- Framing bytes:
  - First chunk marker: 0xFE
  - Continuation chunk marker: 0xFF (used as first byte of non-first chunks)
  - Last-chunk terminator: 0x00 (last chunk ends with 0x00), other chunks end
    with 0xFF
- Payload: application message bytes + single checksum byte appended.
- Checksum: simple 8-bit sum of all payload bytes modulo 256 (sum(data) & 0xFF).
- MTU: implementations use ~19 bytes payload window (counting header/end
  markers). Implementations in examples use \_APPDATA_MTU = 19 and one helper
  uses mtu = 17 — take MTU constraints into account when chunking.

Channel usage:

- AIPP uses Pybricks AppData object, undocumented, dev in progress to keep
  standard output clean
- Writes chunks based on the supported AppData chunk size
- Writes chunks with a small wait between chunks to control in-flight data
  volume

## Message types (top-level)

| Message type                   | Code        | Details                                                |
| ------------------------------ | ----------- | ------------------------------------------------------ |
| Debug Notification/Acknowledge | 0x71 / 0x70 | [AIPP Debug](aipp-debug.md)                            |
| Plot Notification/Acknowledge  | 0x73 / 0x72 | [AIPP Plot](aipp-plot.md)                              |
| Tunnel Notification            | 0x32        | [AIPP Tunnel Notification](aipp-devicenotification.md) |
| Device Notification            | 0x3c        | [AIPP Device Notification](aipp-tunnelnotification.md) |

Endianness:

- All messages use little-endian, including payload encoding
- Tunnel Notification payload encoding uses big-endian encoding

Encoding:

- Debug and Plot messages are AIPP proprietary format
- Device and Tunnel Notifications follow the
  [HubOS v3 protocol](https://lego.github.io/spike-prime-docs/messages.html)

### Examples

| Frame type   |                                                                                         Chunks (hex) | Notes                                                                                                                                                                                                                                                                         | Decoded payload (hex)                                      |
| ------------ | ---------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Single-frame |                                                                                  `FE 01 02 03 06 00` | Payload 01 02 03, checksum = 0x06 (1+2+3), leading 0xFF on first chunk, terminator 0x00 = last chunk                                                                                                                                                                          | `01 02 03`                                                 |
| Double-frame | Chunk 1: `FE 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 FF`<br><br>Chunk 2: `FF 13 BE 00` | Payload bytes 0x01..0x13 (decimal 1..19). Checksum = sum(1..19)=190 = 0xBE. First chunk contains first 18 payload bytes + 0xFF (not last). <br><br> Second chunk starts with 0xFF (continuation), contains the remaining payload byte and a checksum 0xBE and terminator 0x00 | `01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13` |

### Message encoding notes

- Strings are zero-terminated (zstrings).
- Numeric values use little-endian packing via pack/unpack ('<H', '<i', '<f',
  etc.).
- Reception is highly limited with the following consequences
  - hub is not able to detect incoming data event
  - full frames (MTU) are sent, assuming full MTU packet
  - checksum is aligned to the last possible position, payload is padded before
    with zeroes
  - two AIPP frames of the same data cannot be detected, right now - potential
    source of error
  - current workaround: extension appends a packet id at the end of the packet

## MicroPython / Pybricks integration

- Uses pybricks.tools.AppData to read/write AppData bytes and ThisHub for hub
  features.
- Uses ustruct.pack/unpack and micropython const for space/size efficiency.
- Tunnel code is resilient to repeated chunks and uses last-data checks to avoid
  redundant processing.
- Manual behavior: Button.BLUETOOTH pressed triggers a manual continue return
  from waits.

## Caveats & implementation notes

- Keep chunks small: available payload per AppData chunk is limited by MTU and
  two framing bytes, so encode large strings or arrays carefully.
- Checksum is intentionally simple; if checksum mismatch occurs decode_tunnel
  raises/returns empty and the sender should retry.
- The protocol is intentionally minimal for constrained embedded environments;
  extend with versioning or packet numbering if you need flow control or
  reliability beyond the simple repeat loop.
