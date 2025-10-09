# Backlog and Refernces

## TODO items

- snippets
- USB connect EV3/Spike
- better compilation for LEGO files (get pybrick content / or switch to)
- consider TextDocumentContentProvider
  <https://code.visualstudio.com/api/extension-guides/virtual-documents>
- consider fsprovider for multi views:
  <https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider>
- web extension:
  <https://code.visualstudio.com/api/extension-guides/web-extensions>
- AI extensibility
  <https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview>
- implement pybricks auto complete for the pybricks python language
- characteristic.broadcast(broadcast[, callback(error)]); // broadcast is
  true|false
- characteristic.discoverDescriptors([callback(error, descriptors)]);
- nordic/uart?
- REPL
- logging and data export, maybe even graphing???
- log file activity panel / file
- create REPL notbook?
- generate svgs simply and show them as base editors?
- <https://code.visualstudio.com/api/ux-guidelines/panel>
- datalog through AppData send
- use debug console
- cancelled promise / debug

- feature: spike - tunnel

- plot: ability to group metrics to same axis
- plot: spike / ability to select any DeviceNotificationPayload field (+optional
  port filter); allow group by uom?
- use debugterminal instead of outputchannel, when user starts from hub end, can I also create a session?
- use detached handling via queue on physical layers, incoming messages

## TO-FIX

N/A

## SPIKE

- check/align usb with pyb!

- handle COBS multiple messages when decoding

- Move to secondary panel

## Reference

- <https://code.visualstudio.com/api/references/contribution-points>
- <https://lego.github.io/spike-prime-docs/index.html>
- <https://lego.github.io/lego-ble-wireless-protocol-docs/>

---

color on A also buffer/queue messages incoming for handling

Error handling message: RangeError: Offset is outside the bounds of the DataView

- add featureflags
- integrate full program start to :     protected override async launchRequest(
    // check F5 / Ctrl F5 usage

----

## DAP/PTU

- add instrumentation for plot as well!
- ack start from hub
- do not stop on each trap, communicate brkpoints
- multi file handling
- add configurable appdata protocol
- instrumentation: add log / plot / debug
- instrumentation: keep reference for debug frame highlighting
- instrumentation: add a comment to the debug log


- instrumentation over appdata - create a protocol / must support multi package / maybe COBS?
- cobs: src/spike/utils/cobs.ts
- devicenotification: src/spike/messages/device-notification-message.ts, src/spike/utils/device-notification-parser.ts
- tunnelnotification: src/spike/utils/tunnel-notification-parser.ts, src/spike/messages/tunnel-notification-message.ts

```plain
msgtype: uint8 // maybe 0x00-0x6F:hubos, 0x70-0x7F: 0x70:debug, 0x71:plot

devicenotification: 0x3c
tunnelnotification: 0x32
debug: 0x70
plot: 0x71 (or use the 0x32+55=LineGraphPlot)

debug: // support only simple vars ??
msgtype, uint8, 0x70
filecrc, uint32, 0x12345678
line, uint16, 0x0001
var1, ?? {'x': 1, 'strval': 'alma', 'y': 42}
var // should I reflect the original type??

...

plot:
msgtype, uint9, 0x71
name, zstring
value1, float32
value2, float32
```

---

- change the breakpoint logic - instrument it everywhere where I add a breakpoint
- ?? how to set/convey variables ??, parse every - tedious and error-prone, any other means?
- on debug / pybricks - add the same DMTF sound as HubOS
- possibility not to use the debugger F5/CtrlF5 confusion, timing
- test with virtualhub?
- DAP: request variable, do not send/augment it
- DAP: use ad-hoc breakpoints!