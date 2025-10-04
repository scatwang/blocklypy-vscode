"""
Lightweight debug tunnel for pybricks runtime.
Intended for use with VS Code extension "BlocklyPy Commander".
https://marketplace.visualstudio.com/items?itemName=blocklypy.blocklypy-vscode

author: Attila Farago
license: MIT

Communication Flow (Request:Response)

Host -> Hub:
  "start"               # Host requests to start debug session
Hub -> Host:
  "ack"                 # Hub acknowledges and handshake is complete

Hub -> Host:
  "trap"                # Hub signals a trap (breakpoint) with file, line, and exposed variables
Host -> Hub:
  "ack"                 # Host acknowledges trap
  "exit"                # Host requests to exit debug session
  "set <var> <value>"   # Host requests to set a variable's value

Hub -> Host:
  "ack set ..."         # Hub acknowledges variable set
  "nack ..."            # Hub signals error or unknown command

Message details:
Message format is line-based text, prefixed with "debug:" for host filtering.

    "start"
    "ack"
    "trap [<file>, <line>, { var_name: current_value, ... }]"

"""


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

            from usys import stdin
            from uselect import poll
            p = poll()
            p.register(stdin)
            cls._keyboard = p
            cls._stdin = stdin
            cls._initialized = True
            cls._handshaken = cls._start_handshake()
        except Exception:
            cls._initialized = False
            cls._handshaken = False
        return cls._handshaken

    @classmethod
    def _start_handshake(cls) -> bool:
        cls._channel_send('start')
        result = cls._channel_wait()
        # cls._silent = result[0] != "True"
        return result != False

    @classmethod
    def _channel_send(cls, *args):
        """Output is line-based, prefixed for host filtering."""
        print('debug:', *args)

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
        except Exception:
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
    def _channel_wait(cls, variables=None, **exposed):
        """
        Wait for a control line.
        Returns:
          True  -> ack received
          False -> exit or failure
        """
        if variables is None:
            variables = {}
        cls._hub_feedback(None)  # prompt

        line_buf = []

        while True:
            b = cls._read_byte()
            if b is None:
                continue

            ch = ord(b)
            if ch == 10:  # newline
                line = ''.join(line_buf)
                line_buf.clear()
                parts = line.split()

                cmd = parts[0] if parts else None
                if cmd == 'ack' or cmd is None:
                    return parts[1:]

                if cmd == 'exit':
                    cls._handshaken = False
                    cls._hub_feedback(False)  # fail
                    return False

                if cmd == 'set':
                    try:
                        var, val = parts[1], parts[2]
                        # Only allow explicitly exposed + existing locals
                        if var not in variables or var not in exposed:
                            raise KeyError('unknown variable')
                        cast_type = type(variables[var])
                        variables[var] = cast_type(val)
                        cls._channel_send('ack', 'set', [var, variables[var]])
                        cls._hub_feedback(True)   # success
                    except Exception as e:
                        cls._channel_send('nack', 'set', [var, val, repr(e)])
                        cls._hub_feedback(False)  # fail
                else:
                    cls._channel_send('nack', 'cmd', [cmd])
            else:
                line_buf.append(chr(ch))

    @classmethod
    def trap(cls, file: str, lineno: int, variables: dict, **exposed):
        """
        Trap execution point for interactive update.
        file, lineno used for host context.
        variables: locals() dict (mutable)
        exposed: whitelist of variable names allowed to be set.
        """
        if not (cls._initialized and cls._handshaken):
            return
        cls._channel_send('trap', [file, lineno, exposed])
        cls._channel_wait(variables, **exposed)


# auto start debug tunnel
debug_tunnel.init()
