# Tunnel Notification packet

This encoding is defined by the LEGO standard
[TunnelNotification format](https://lego.github.io/spike-prime-docs/messages.html#x32-tunnelmessage).

Message types are not officially documented by LEGO. The listing below is a
reverse-engineered list of codes (synchronised with
tunnel-notification-parser.ts).

This message is bidirectionan and can be sent both by the hub and the host.
Message subcodes follow a well-defined notification/acknowledge pattern, using a
`correlationId` identifier. Here response is mandatory.

## Hub support

- SPIKE HubOSv3 devices use it in a built in manner, using their transport
  layer.
- There is no current support for Pybricks devices over AIPP

## Behavior

VSCode implements some logical responses to these messages including plotting,
display messages, and manually prompting for weather update manually.

## Format

- uint8 — Message type (0x32)
- uint16 — Payload size in bytes (big-endian)
- uint8[payload_size] — Payload data (see element format below)

## Element (Tunnel message) format

- uint8 — Element type (TunnelMessageType)
- Fields — Zero or more fields, in the order declared for that element type.
  Field kinds:
  - fixed: integer of given size (1/2/4), signed/unsigned, optional scale
  - float: 4 bytes
  - string: zero‑terminated UTF‑8
  - bool: 1 byte

## Music

- MusicPlayDrumForBeats (1)
  - drum: fixed uint8
- MusicPlayNoteForBeats (2)
  - instrument: fixed uint8
  - note: fixed uint8
  - duration: fixed uint32
- MusicTempoUpdate (3)
  - tempo: fixed uint16
- MusicStopAllNotes (4)
  - no fields
- MusicStopAllDrums (5)
  - no fields

## Sound

- SoundPlay (22)
  - crc: fixed uint32
  - volume: fixed uint8
  - pitch: fixed int16
  - pan: fixed int8
- SoundPlayUntilDone (23)
  - correlationId: fixed uint8
  - crc: fixed uint32
  - volume: fixed uint8
  - pitch: fixed int16
  - pan: fixed int8
  - (with mandatory response 24)
- SoundDone (24)
  - correlationId: fixed uint8
- SoundStopAll (25)
  - no fields
  - (with mandatory response 24)
- SoundSetAttributes (26)
  - volume: fixed uint8
  - pitch: fixed int16
  - pan: fixed int8
- SoundStop (27)
  - correlationId: fixed uint8 (request stop for specific correlation)
  - (with mandatory response 24)

## Weather

- WeatherAtOffsetRequest (31)
  - correlationId: fixed uint8
  - days: fixed uint8
  - hours: fixed uint8
  - location: string (zstring)
  - (with mandatory response 33)
- WeatherForecast (33)
  - correlationId: fixed uint8
  - temperature: fixed int16, scale 10 (divide by 10 → °C)
  - precipitation: fixed uint16, scale 10
  - condition: fixed uint8 (see TunnelWeatherForecastCondition)
  - windDirection: string (zstring)
  - windSpeed: fixed uint16, scale 10
  - pressure: fixed uint16, scale 10
  - offset: fixed uint8
  - location: string (zstring)

## Display

- DisplayImage (41)
  - image: fixed uint8
- DisplayImageForTime (42)
  - image: fixed uint8
- DisplayNextImage (43)
  - no fields
- DisplayText (44)
  - text: string (zstring)
- DisplayTextForTime (45)
  - text: string (zstring)
- DisplayShow (46)
  - fullscreen: bool
- DisplayHide (47)
  - no fields

## Graphs (general)

- GraphShow (50)
  - graphType: fixed uint8
  - fullscreen: bool
- GraphHide (51)
  - graphType: fixed uint8
- GraphClear (52)
  - graphType: fixed uint8
- GraphValue (53)
  - correlationId: fixed uint8
  - value: float (4 bytes)

## Line graphs

- LineGraphClearColor (54)
  - color: fixed uint8
- LineGraphPlot (55)
  - color: fixed uint8
  - x: float
  - y: float
- LineGraphRequestValue (56)
  - correlationId: fixed uint8
  - color: fixed uint8
  - option: fixed uint8
    - option semantics: 0=current, 1=min, 2=max, 3=average (as
      implemented/commented)
  - (with mandatory response 53)

## Bar graphs

- BarGraphSetValue (57)
  - color: fixed uint8
  - value: float
- BarGraphChange (58)
  - color: fixed uint8
  - delta: float
- BarGraphRequestValue (59)
  - correlationId: fixed uint8
  - color: fixed uint8
  - (with mandatory response 53)

## Program / State / Assertions

- Assertion (91)
  - success: bool
  - message: string (zstring)
- ProgramAttributes (92)
  - project: string (zstring)

## Latest value requests/responses

- LatestTunnelValueRequest (93)
  - correlationId: fixed uint8
  - type2: fixed uint8
  - field: string (zstring)
  - (with mandatory response 94 ??)
- LatestTunnelValueResponse (94)
  - correlationId: fixed uint8
  - success: bool
  - age: fixed uint16
  - value: string (zstring)

## Variables and Lists

- VariableUpdate (96)
  - name: string (zstring)
  - value: string (zstring)
- ListAddItem (97)
  - name: string (zstring)
  - item: string (zstring)
- ListRemoveItem (98)
  - name: string (zstring)
  - index: fixed uint8
- ListInsertItem (99)
  - name: string (zstring)
  - item: string (zstring)
  - index: fixed uint8
- ListReplaceItem (100)
  - name: string (zstring)
  - item: string (zstring)
  - index: fixed uint8
- ListClear (101)
  - name: string (zstring)

## Notes / interoperability (summary)

- The Tunnel Notification payload is a concatenation of one or more tunnel
  elements.
- Each element begins with a 1‑byte element type (TunnelMessageType) followed by
  fields encoded according to the type definition.
- All multi-byte numeric fields in the Tunnel Notification packet use big-endian
  ordering (the parser sets TunnelMessageLittleEndian = false).
- Strings are UTF‑8 zero‑terminated (zstrings).
- Floats are 4‑byte IEEE‑754.
- Boolean fields occupy 1 byte.
- Fixed numeric fields use sizes 1, 2 or 4 bytes and may be signed; some fields
  use a scale factor (value is stored as integer and should be divided by the
  scale when decoding).
