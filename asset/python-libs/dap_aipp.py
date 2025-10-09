"""
Lightweight debug tunnel for pybricks runtime.
Intended for use with VS Code extension "BlocklyPy Commander".
https://marketplace.visualstudio.com/items?itemName=blocklypy.blocklypy-vscode

author: Attila Farago
license: MIT

Communication Flow (Request:Response)
...
"""

from aipp import send_tunnel, tunnel_wait, encode_debug_message_raw, MessageType, DebugSubCode


class debug_tunnel:
    """
    Lightweight debug tunnel for pybricks runtime.
    """
    _initialized: bool = False
    _handshaken: bool = False
    _hub = None
    _stdin = None
    _keyboard = None
    _silent = True

    @classmethod
    def init(cls) -> bool:
        """Initialize tunnel and perform handshake if possible."""
        if cls._initialized:
            return cls._handshaken
        try:
            from pybricks.hubs import ThisHub
            cls._hub = ThisHub()
            start_type = cls._hub.system.info().get('program_start_type')
            # Only enable when downloaded from PC (start_type == 3)
            if start_type != 3:
                return False

            cls._initialized = True
            cls._handshaken = cls._start_handshake()
        except Exception as e:
            # print(e)
            # raise (e)
            cls._initialized = False
            cls._handshaken = False
        return cls._handshaken

    @classmethod
    def _start_handshake(cls) -> bool:
        # print("Waiting for debugger start acknowledge")
        # send_tunnel(encode_debug_message_raw([DebugSubCode.StartNotification]))
        response = cls._channel_wait(DebugSubCode.StartAcknowledge,
                                     encode_debug_message_raw(
                                         [DebugSubCode.StartNotification]),
                                     True)
        if not response is None and not response[1]:
            # nack for Init
            retval = False
        else:
            retval = True

        # print("Server acknowledged debugger start", retval)
        # cls._silent = result[0] != "True"
        return retval

    @classmethod
    def _hub_feedback(cls, state):
        """
        state: None (prompt), True (success), False (fail)
        """
        try:
            hub = cls._hub

            if cls._silent:
                return
            hub.speaker.volume(40)
            if state is None:
                hub.speaker.play_notes(['E4/4', 'G4/4', 'B4/2'], 2000)
            elif state is True:
                hub.speaker.play_notes(['G4/4', 'C5/4'], 2000)
            else:
                hub.speaker.play_notes(
                    ['A4/8', 'F4/8', 'D4/4', 'R/8', 'D3/4'], 2000)
        except Exception as e:
            # print(e)
            pass

    @classmethod
    def _read_byte(cls):
        """Non-blocking-ish single byte read; returns None if nothing."""
        if cls._keyboard is None:
            return None
        # events = cls._keyboard.poll(50)  # 50 ms poll slice
        # if not events:
        #     return None
        b = cls._stdin.read(1)  # blocking read
        return b

    @classmethod
    def _channel_wait(cls, target_message_subcode, message_to_send=None, allow_unhandshaken=False):
        """
        Wait for a control line.
        Returns:
          True  -> ack received
          False -> exit or failure
        """
        if not (cls._initialized and (cls._handshaken or allow_unhandshaken)):
            return
        cls._hub_feedback(None)  # prompt
        return tunnel_wait([MessageType.DebugAcknowledge, target_message_subcode], message_to_send)

    @classmethod
    def trap(cls, file: str, lineno: int):
        """
        Trap execution point for interactive update.
        file, lineno used for host context.
        variables: locals() dict (mutable)
        exposed: whitelist of variable names allowed to be set.
        """
        if not (cls._initialized and cls._handshaken):
            return
        # print("Waiting for server acknowledg of trap notification")
        response = cls._channel_wait(DebugSubCode.TrapAcknowledge,
                                     encode_debug_message_raw([DebugSubCode.TrapNotification, file, lineno]))
        if not response is None and not response[1]:
            # nack for Trap
            cls._handshaken = False
        # print("Server acknowledged trap notification")

        # print("Waiting for Trap continue request")
        response = cls._channel_wait(DebugSubCode.ContinueRequest)
        if not response is None and not response[1]:
            # step = True, continue = False
            cls._handshaken = False
        send_tunnel(encode_debug_message_raw([DebugSubCode.ContinueResponse]))
        # print("Server Sent trap continue")


# auto start debug tunnel
debug_tunnel.init()
# debug_tunnel.trap("hello.py", 42)
