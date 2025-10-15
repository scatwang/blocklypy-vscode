"""
AIPP: AppData Instrumentation Protocol for Pybricks
A minimal implementation for MicroPython on Pybricks hubs.

"""
from pybricks.parameters import Button
from pybricks.hubs import ThisHub
from pybricks.tools import AppData, wait
from ustruct import pack, unpack
from micropython import const

# optimized version: 3383 bytes

# ------------------------------
# region AIPP Tunnel Handling
APPDATA_MTU = const(19)  # max bytes per packet including header
MAX_COUNT_VALUES = const(255)


def _format_bytes(data: bytes, hex: bool = True) -> str:
    fmt = '{:02x} ' if hex else '{:03} '
    return ''.join(fmt.format(b) for b in data)


def simple_sum_checksum(data: bytes) -> int:
    """
    Computes a simple 8-bit checksum by summing all bytes.
    The result is modulo 256.

    :param data: The bytes-like object to checksum.
    :return: The 8-bit checksum (0-255).
    """
    return sum(data) & 0xFF


def send_tunnel_aipp(data: bytes):
    # frame with start byte, data, checksum, end byte
    # split into chunks of MTU size with continuation bytes
    # start byte: 0xFE
    # continuation byte: 0xFF
    # end byte: 0x00
    # checksum: sum of all data bytes modulo 256
    data += bytes([simple_sum_checksum(data)])

    #!! print("sending data", _format_bytes(data))
    offset = 0
    while offset < len(data):
        n = min(APPDATA_MTU-2, len(data)-offset)
        isfirst = offset == 0
        islast = offset+n >= len(data)
        chunk = (b'\xfe' if isfirst else b'\xff') + \
            data[offset:offset+n] + \
            (b'\x00' if islast else b'\xff')
        try:
            appdata.write_bytes(chunk)
        except:
            pass
        offset += n


def decode_tunnel(chunks: bytes) -> bytes:
    """Assembles a list of byte chunks into a single bytes object.
    If a chunk ends with 0xFF, it indicates more chunks follow.
    Chunk starts with 0xFE for first, then 0xFF.
    The last chunk ends with checksum byte and 0x00.
    """
    if isinstance(chunks, bytes):
        # single chunk, treat as list of one
        chunks = [chunks]
    message = bytearray()
    for i, chunk in enumerate(chunks):
        if chunk[0] != 0xFE if i == 0 else 0xFF:
            raise ValueError()
        is_last = chunk[-1] == 0x00
        # Remove leading 0xFE/0xFF if present (continuation marker)
        # Remove trailing 0xFF or 0x00 (continuation or end marker)
        chunk = chunk[1:-2]
        message.extend(chunk)
        if is_last:
            break
    if len(message) < 1:
        return b''
    data = message[:-1]
    checksum = message[-1]
    # checksum decoding is problematic; either align to the end (-1 for continuation) or rework checksum
    if simple_sum_checksum(data) != checksum:
        raise ValueError()
    return bytes(data)

# endregion AIPP Tunnel Handling
# ------------------------------

# ------------------------------
# region AIPP Protocol handling


# Replace class constants
DEBUG_ACKNOWLEDGE = const(0x70)
DEBUG_NOTIFICATION = const(0x71)
# PLOT_ACKNOWLEDGE = const(0x72)
# PLOT_NOTIFICATION = const(0x73)

DEBUG_START_ACK = const(0x00)
DEBUG_START_NOTIF = const(0x01)
DEBUG_TRAP_ACK = const(0x02)
DEBUG_TRAP_NOTIF = const(0x03)
DEBUG_CONTINUE_REQ = const(0x04)
DEBUG_CONTINUE_RESP = const(0x05)
# DEBUG_GETVAR_REQ = const(0x06)
# DEBUG_GETVAR_RESP = const(0x07)
DEBUG_SETVAR_REQ = const(0x08)
DEBUG_SETVAR_RESP = const(0x09)
DEBUG_TERM_REQ = const(0x0a)
DEBUG_TERM_RESP = const(0x0b)

# PLOT_ACK = const(0x00)
# PLOT_DEFINE = const(0x01)
# PLOT_UPDATE_CELLS = const(0x02)
# PLOT_UPDATE_ROW = const(0x03)

VAR_NONE = const(0x00)
VAR_INT = const(0x01)
VAR_FLOAT = const(0x02)
VAR_STRING = const(0x03)
VAR_BOOL = const(0x04)


def encode_zstring(s: str) -> bytes:
    """Encodes a zero-terminated string."""
    # return s.encode('utf-8') + b'\x00'
    return (bytes(s, 'utf-8') if type(s) == str and len(s) else b'') + b'\x00'


def decode_zstring(data: bytes, start_idx: int) -> tuple:  # tuple(str, int)
    """Decodes a zero-terminated byte string from data starting at start_idx."""
    s = []
    idx = start_idx
    while idx < len(data) and data[idx] != 0:
        s.append(chr(data[idx]))
        idx += 1
    idx += 1  # skip zero terminator
    return ''.join(s), idx


def receive_tunnel():
    global appdata_last_data
    try:
        data = appdata.get_bytes()
        if len(data) == 0 or data[0] == 0 or \
                data[:APPDATA_MTU] == appdata_last_data[:APPDATA_MTU]:
            return None, None
        appdata_last_data = data
        decoded = decode_tunnel(data)
        # TODO: only react on full frames!
        msgtype, message = decode_message_raw(decoded)
        # should somehow reset the buffer - appdata.reset()
        return msgtype, message
    except Exception as e:
        # print(e)
        # raise e
        return type(None), None


def decode_message_raw(data: list[bytes]):
    if len(data) < 2:
        raise ValueError()  # "Data too short to decode"
    msg_type = data[0]
    # print("decode_message_raw", msg_type, data, DEBUG_ACKNOWLEDGE)
    if msg_type == DEBUG_ACKNOWLEDGE:
        return [msg_type, decode_debug_message_raw(data)]
    # elif msg_type == PLOT_ACKNOWLEDGE:
    #     return [msg_type, True]
    return [None, None]


# plot_columns = []


# def encode_plot_message_raw(message) -> bytes:
#     subcode = message[0]
#     parts = bytearray()
#     parts.append(PLOT_NOTIFICATION)
#     parts.append(subcode)

#     if subcode == PLOT_UPDATE_CELLS:
#         # [name, value]
#         plotdata = message[1][:MAX_COUNT_VALUES]  # max 255 columns
#         parts.append(len(plotdata))  # count
#         for name, value in plotdata:
#             parts += encode_zstring(name)  # name
#             parts += pack('<f', value)  # always float
#             if not name in plot_columns:
#                 plot_columns.append(name)

#     elif subcode == PLOT_UPDATE_ROW:
#         # [value]
#         values = message[1][:MAX_COUNT_VALUES]  # max 255 columns
#         values = values[0:len(plot_columns)]  # truncate to known columns
#         parts.append(len(values))
#         for value in values:
#             parts += pack('<f', value)

#     elif subcode == PLOT_DEFINE:
#         # [name]
#         names = message[1][:MAX_COUNT_VALUES]  # max 255 columns
#         parts.append(len(names))
#         for name in names:
#             parts += encode_zstring(name)
#             if not name in plot_columns:
#                 plot_columns.append(name)

#     return bytes(parts)


def encode_debug_message_raw(message) -> bytes:
    """
    Encodes a debug message from pc to hub/me.
    message: list format depends on subcode:
    """
    parts = bytearray()
    parts.append(DEBUG_NOTIFICATION)
    subcode = message[0]
    rest = message[1:]
    parts.append(subcode)
    # if subcode == DEBUG_START_NOTIF: # nothing to add
    # if subcode == DEBUG_CONTINUE_RESP: # nothing to add
    # if subcode == DEBUG_TERM_RESP: # nothing to add
    if subcode == DEBUG_TRAP_NOTIF:
        # trap: filename, line, variables
        filename, line, exposed = rest
        parts += encode_zstring(filename)
        parts += pack('<H', line)
        counter_position = len(parts)
        parts.append(0)  # remember counter
        exposed = exposed[:MAX_COUNT_VALUES]  # max 255 variables
        for exposed_var, v in exposed:
            parts[counter_position] += 1
            parts += encode_zstring(exposed_var)
            parts.append(vartype)
            if v is int:
                data = pack('<i', v)
            elif v is float:
                data = pack('<f', v)
            elif v is str:
                data = encode_zstring(v)
            elif v is bool:
                data = bytes([1 if v else 0])
            else:
                data = b''
            parts += data

    # elif subcode == DEBUG_GETVAR_RESP:
    #     # get variable response: name, varvalue
    #     name, varvalue = rest
    #     pytype = type(varvalue)
    #     vartype, encoder = VARIABLE_TYPE_MAP[pytype]
    #     parts += encode_zstring(name)
    #     parts.append(vartype)
    #     parts += encoder(varvalue)

    elif subcode == DEBUG_SETVAR_RESP:
        # set variable response: error message
        [error_msg] = rest
        parts += encode_zstring(error_msg)

    return bytes(parts)


def decode_debug_message_raw(data: list[bytes]):
    """
    Decodes a debug message from hub/me to pc.
    Returns a list or tuple, format depends on subcode
    """
    # If data is a list of bytes chunks, assemble into a single bytes object
    if len(data) < 3:
        raise ValueError()
    subcode = data[1]
    rest = data[2:]
    #!! print("Appdata complete message received:", _format_bytes(data))  # !!
    if subcode == DEBUG_START_ACK:
        # start ack: success in connect to debugger
        success = rest[0] != 0
        return [subcode, success]
    elif subcode == DEBUG_TRAP_ACK:
        # trap ack: success
        success = rest[0] != 0
        return [subcode, success]
    elif subcode == DEBUG_CONTINUE_REQ:
        # trap ack: continue/exit_debug
        step = rest[0] != 0
        return [subcode, step]
    # elif subcode == DEBUG_GETVAR_REQ:
    #     # get variable request: name
    #     name, _ = decode_zstring(rest, 0)
    #     return [subcode, name]
    elif subcode == DEBUG_SETVAR_REQ:
        # set variable request: name, vartype, varvalue
        name, index = decode_zstring(rest, 0)
        vartype = rest[index]
        varvalue_data = rest[index + 1:]
        varvalue = None
        #!! //!! # TODO: use VARTYPES above
        if vartype == VAR_INT and len(varvalue_data) >= 4:
            varvalue = unpack('<i', varvalue_data[:4])[0]
        elif vartype == VAR_FLOAT and len(varvalue_data) >= 4:
            varvalue = unpack('<f', varvalue_data[:4])[0]
        elif vartype == VAR_BOOL:
            varvalue = varvalue_data[0] != 0
        elif vartype == VAR_STRING:
            varvalue, index = decode_zstring(varvalue_data, 0)
        # elif vartype == VAR_NONE:
        #     varvalue = None
        # index increments - not needed as we only set one variable here
        return [subcode, name, vartype, varvalue]
    elif subcode == DEBUG_TERM_REQ:
        return [subcode]


# endregion AIPP Protocol handling
# ------------------------------

# ------------------------------
# region AIPP Debugger Tunnel Waiting

appdata = AppData("<BBBBBBBBBBBBBBBBBBBB")
appdata_last_data = b''
# todo add init appdata, for now - ignore user created AppData

_hub = ThisHub()


def tunnel_wait(expected: list, message_to_send: bytes = None, timeout: int = -1) -> tuple:  # tuple(number, list)
    # target_message_type -> lambda / or subcode
    timer = 0
    while True:
        msgtype, message = receive_tunnel()
        # matching mesage received, note: this only handles msgtype and subcode - should be ok
        if not message is None:
            if not isinstance(expected, list) or len(expected) <= 1 or message[0] == expected[1] or expected[1] is None:
                return msgtype, message

        if (not message_to_send is None) and (timer % _DAP_REPEAT_COUNT == 0):
            send_tunnel_aipp(message_to_send)

        timer += 1

        # would need to detect ans safeguard disconnect - hub.info() is not updated though
        # try:
        #     if _hub.info()['host_connected_ble'] == False:
        #         return None, None
        # except: pass

        # allow manual trigger to continue
        try:
            if Button.BLUETOOTH in _hub.buttons.pressed():
                while Button.BLUETOOTH in _hub.buttons.pressed():
                    # this is blocking, but ok for now
                    wait(0)
                return None, None
        except:
            pass

        # timeout handling
        if timeout >= 0 and timer > timeout:
            return None, None

        # wait a bit to avoid busy loop
        wait(_DAP_TUNNEL_WAIT)


# endregion AIPP Debugger Tunnel Waiting
# ------------------------------

# ------------------------------
# region AIPP Debugger Class

_DAP_TUNNEL_WAIT = 100                      # wait time per loop (const)
_DAP_TIMEOUT = 200                          # full (100ms) cycles
# resend every n loops # to be checked/validated
_DAP_REPEAT_COUNT = 5000/_DAP_TUNNEL_WAIT
# _DAP_TIMEOUT = -1  # !!
# _DAP_REPEAT_COUNT = 100000  # !!
_initialized = False
_handshaken = False
_hub = None


def debug_tunnel_init():
    global _initialized, _handshaken, _hub
    if _initialized:
        return _handshaken
    try:
        from pybricks.hubs import ThisHub
        _hub = ThisHub()
        start_type = _hub.system.info().get('program_start_type')
        # Only enable when downloaded from PC (start_type == 3)
        if start_type != 3:
            return False

        _initialized = True
        _handshaken = debug_tunnel_start_handshake()
    except Exception:
        _initialized = False
        _handshaken = False
    return _handshaken


def debug_tunnel_start_handshake():
    # print("Waiting for debugger start acknowledge")
    # send_tunnel_aipp(encode_debug_message_raw([DEBUG_START_NOTIF]))
    response_msgtype, response_msg = debug_tunnel_channel_wait(DEBUG_START_ACK,
                                                               encode_debug_message_raw(
                                                                   [DEBUG_START_NOTIF]),
                                                               _DAP_TIMEOUT, True)
    if response_msg is None or not response_msg[1]:
        # nack for Init
        # print("Server negatively acknowledged debugger start")
        retval = False
    else:
        retval = True
        # print("Server acknowledged debugger start")

    # cls._silent = result[0] != "True"
    return retval


# @classmethod
# def _hub_feedback(cls, state):
#     """
#     state: None (prompt), True (success), False (fail)
#     """
#     try:
#         hub = cls._hub

#         if cls._silent:
#             return
#         hub.speaker.volume(40)
#         if state is None:
#             hub.speaker.play_notes(['E4/4', 'G4/4', 'B4/2'], 2000)
#         elif state is True:
#             hub.speaker.play_notes(['G4/4', 'C5/4'], 2000)
#         else:
#             hub.speaker.play_notes(
#                 ['A4/8', 'F4/8', 'D4/4', 'R/8', 'D3/4'], 2000)
#     except Exception as e:
#         # print(e)
#         pass


def debug_tunnel_channel_wait(target_message_subcode=None, message_to_send=None, timeout: int = -1, allow_unhandshaken=False) -> tuple:  # tuple(number, list)
    """
    Wait for a control line.
    Returns:
      True  -> ack received
      False -> exit or failure
    """
    global _initialized, _handshaken, _hub
    if not (_initialized and (_handshaken or allow_unhandshaken)):
        return None, None
    # cls._hub_feedback(None)  # prompt
    # TODO: handle TerminateRequest
    return tunnel_wait([DEBUG_ACKNOWLEDGE, target_message_subcode], message_to_send, timeout)


def dt_trap(file: str, lineno: int, **exposed: dict):
    """
    Trap execution point for interactive update.
    file, lineno used for host context.
    variables: locals() dict (mutable)
    exposed: whitelist of variable names allowed to be set.
    """
    global _handshaken, _initialized, _hub
    if not (_initialized and _handshaken):
        return

    # Display current line on hub display
    try:
        _hub.display.number(lineno)  # show line number on hub display
    except:
        pass

    # Send Trap Notification to the host
    # print("Waiting for server acknowledg of trap notification")
    # cache = MAX_COUNT_VALUES  # ___ need this for minification
    zipped = list(exposed.items())
    msg = encode_debug_message_raw(
        [DEBUG_TRAP_NOTIF, file, lineno, zipped])
    msgtype, response = debug_tunnel_channel_wait(
        DEBUG_TRAP_ACK, msg, _DAP_TIMEOUT)
    if not response[1]:
        # nack for Trap - continue
        return exposed.values()
    # print("Server acknowledged trap notification")

    # Wait for user interaction / continue
    # print("Waiting for Trap continue request")
    while True:
        _msgtype, response = debug_tunnel_channel_wait()  # wait indefinitely, no timeout
        subcode = response[0] if isinstance(response, list) else None

        if subcode == DEBUG_CONTINUE_REQ:
            step = response[1] != 0
            # if not response is None and not response[1]:
            #     # step = True, continue = False
            #     # nothing to do with this now...
            send_tunnel_aipp(encode_debug_message_raw(
                [DEBUG_CONTINUE_RESP, step]))
            # exit the trap loop
            break

        elif subcode == DEBUG_SETVAR_REQ:
            varname, vartype, varvalue = response[1:4]

            # check if exists
            exists = varname in exposed
            if exists:
                exposed[varname] = varvalue

            result = exists
            send_tunnel_aipp(encode_debug_message_raw(
                [DEBUG_SETVAR_RESP, result]))
            # continue the trap loop

        elif subcode == DEBUG_TERM_REQ:
            # nothing to send
            # exit the trap loop
            break

        elif subcode == None:
            # this means a manual trigger (e.g. button) was given to continue
            step = True
            send_tunnel_aipp(encode_debug_message_raw(
                [DEBUG_CONTINUE_RESP, step]))

            # exit the trap loop
            break

    # print("Server Sent trap continue")
    return exposed.values()


# auto start debug tunnel
# print("Starting debug tunnel on AIPP.")
#!!! debug_tunnel_init()

# endregion AIPP Debugger Class
# ------------------------------


# ------------------------------
# region Example local usage
# var1=1
# var2=3.1415
# str1="hello"
# bool1=True
# none1=None
# debug_tunnel._handshaken = True
# # [var1, var2, str1, bool1, none1] = dt_trap('dummy.py', 42, var1=var1, var2=var2, str1=str1, bool1=bool1, none1=none1)
# # [var1, var2, str1, bool1, none1] = dt_trap('dummy.py', 42, {'var1':var1, 'var2':var2, 'str1':str1, 'bool1':bool1, 'none1':none1})
# # dummy = simple_sum_checksum('dummy.py') -> CRC32 -> b'\x78\x19\x15\x4e'
# # [var1, var2, str1, bool1, none1] = dt_trap('dummy.py', 42, ['var1', 'var2', 'str1', 'bool1', 'none1'], [var1, var2, str1, bool1, none1])
# print(var1)

# send_tunnel_aipp(encode_plot_message_raw([PLOT_DEFINE, ['col1', 'col2']]))
# wait(100)
# for i in range(100):
#     send_tunnel_aipp(encode_plot_message_raw([PLOT_UPDATE_ROW, [1+i, 34324/(i+1)]]))
#     wait(100)


# endregion Example local usage
# ------------------------------

"""
MINIFICATION

python -m python_minifier --remove-literal-statements --preserve-globals dt_trap --remove-class-attribute-annotations  --rename-globals dap_aipp_full.py --output dap_aipp_min.py
dap_aipp_full.py

then:
minify all function definition parameters on each def and also modify related body code
"""
