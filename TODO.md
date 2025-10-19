# Backlog and References

---

## TODO Items

- Snippets
- USB connect: EV3/Spike
- Better compilation for LEGO files (get pybrick content or switch to)
- Consider `TextDocumentContentProvider`  
  [VS Code Virtual Documents](https://code.visualstudio.com/api/extension-guides/virtual-documents)
- Consider `FileSystemProvider` for multi views  
  [VS Code FileSystemProvider](https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider)
- Web extension  
  [VS Code Web Extensions](https://code.visualstudio.com/api/extension-guides/web-extensions)
- AI extensibility  
  [AI Extensibility Overview](https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview)
- Implement Pybricks autocomplete for the Pybricks Python language
- `characteristic.broadcast(broadcast[, callback(error)])` // broadcast is true|false
- `characteristic.discoverDescriptors([callback(error, descriptors)])`
- Nordic/UART?
- REPL
- Logging and data export (maybe even graphing?)
- Log file activity panel/file
- Create REPL notebook?
- Generate SVGs simply and show them as base editors?
- [VS Code Panel UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/panel)
- Datalog through AppData send
- Use debug console
- Cancelled promise/debug
- **Feature:** Spike - tunnel
- **Plot:** Ability to group metrics to same axis
- **Plot:** Spike / ability to select any `DeviceNotificationPayload` field (+optional port filter); allow group by UOM?
- Use debug terminal instead of output channel; when user starts from hub end, can I also create a session?
- Use detached handling via queue on physical layers, incoming messages
- **Color on A:** Also buffer/queue incoming messages for handling


---

## SPIKE

- Check/align USB with Pyb!
- Handle COBS multiple messages when decoding
- Move to secondary panel

---

## Reference

- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [LEGO Spike Prime Docs](https://lego.github.io/spike-prime-docs/index.html)
- [LEGO BLE Wireless Protocol Docs](https://lego.github.io/lego-ble-wireless-protocol-docs/)

---



---

## DAP/PTU

- Add instrumentation for plot as well!
- Ack start from hub
- Do not stop on each trap, communicate breakpoints
- Multi-file handling
- Add configurable AppData protocol
- Instrumentation: add log / plot / debug
- Instrumentation: keep reference for debug frame highlighting
- Instrumentation: add a comment to the debug log
- Instrumentation over AppData: create a protocol (must support multi-package, maybe COBS?)
    - COBS: `src/spike/utils/cobs.ts`
    - Device notification:  
      `src/spike/messages/device-notification-message.ts`,  
      `src/spike/utils/device-notification-parser.ts`
    - Tunnel notification:  
      `src/spike/utils/tunnel-notification-parser.ts`,  
      `src/spike/messages/tunnel-notification-message.ts`

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

- Change the breakpoint logic: instrument it everywhere a breakpoint is added
- How to set/convey variables? Parsing every variable is tedious and error-prone; any alternatives?
- On debug/pybricks: add the same DMTF sound as HubOS
- Possibility not to use the debugger (F5/Ctrl+F5 confusion, timing)
- Test with VirtualHub?
- DAP: request variable, do not send/augment it
- Emit observe data from host to Pybricks BLE
- Consider adding a payload size (u16) for AIPP
- User input feature through AIPP when connected

- create jupyter notebook engine
- disconnect after x idle minutes! / config


---

## FLL

- score test fraework with timer!
