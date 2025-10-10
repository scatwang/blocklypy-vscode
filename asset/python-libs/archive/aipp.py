# %% [markdown]
# # AIPP: AppData Instrumentation Protocol for Pybricks

# %% [markdown]
# ## Shared code

# %%
from pybricks.tools import AppData, wait
from struct import pack, unpack  # ustruct for pybricks-micropython


class MessageType:
    DebugAcknowledge = (0x70)
    DebugNotification = (0x71)
    PlotAcknowledge = (0x72)
    PlotNotification = (0x73)


class DebugSubCode:
    StartAcknowledge = 0x00
    StartNotification = 0x01
    TrapAcknowledge = 0x02
    TrapNotification = 0x03
    ContinueRequest = 0x04
    ContinueResponse = 0x05
    GetVariableRequest = 0x06
    GetVariableResponse = 0x07
    SetVariableRequest = 0x08
    SetVariableResponse = 0x09


class PlotSubCode:
    Ack = 0x00
    Define = 0x01
    UpdateCells = 0x02
    UpdateRow = 0x03


MTU = 20  # max bytes per packet including header

# %%


class VarType:
    NONE = (0)
    INT = (1)
    FLOAT = (2)
    STRING = (3)
    BOOL = (4)


VARIABLE_TYPE_MAP = {
    int: (VarType.INT, lambda v: pack('<i', v)),
    float: (VarType.FLOAT, lambda v: pack('<f', v)),
    str: (VarType.STRING, lambda v: encode_zstring(v)),
    bool: (VarType.BOOL, lambda v: bytes([1 if v else 0])),
    type(None): (VarType.NONE, lambda v: b'')
}


def encode_zstring(s: str) -> bytes:
    """Encodes a zero-terminated string."""
    # return s.encode('utf-8') + b'\x00'
    return (bytes(s, 'utf-8') if type(s) == str and len(s) else b'') + b'\x00'


def decode_zstring(data: bytes, start_idx: int) -> (str, int):
    """Decodes a zero-terminated byte string from data starting at start_idx."""
    s = []
    idx = start_idx
    while idx < len(data) and data[idx] != 0:
        s.append(chr(data[idx]))
        idx += 1
    idx += 1  # skip zero terminator
    return ''.join(s), idx


def simple_sum_checksum(data: bytes) -> int:
    """
    Computes a simple 8-bit checksum by summing all bytes.
    The result is modulo 256.

    :param data: The bytes-like object to checksum.
    :return: The 8-bit checksum (0-255).
    """
    checksum = 0
    for byte in data:
        checksum += byte
    # Only keep the lowest 8 bits
    return checksum & 0xFF

# %%
# # test code only -- start


def format_bytes(data: bytes, hex: bool = True) -> str:
    fmt = '{:02x} ' if hex else '{:03} '
    return ''.join(fmt.format(b) for b in data)

# # test code only -- end


# %%
def encode_channel(data: bytes):
    """Sends data over appdata. Considers MTU of 19 bytes.
    Chunks data if needed. On continuation, first byte is 0xFF.
    Adds checksum at the end of data.
    Last byte indicates if there is a continuation (0xff) or not (0x00).
    """
    offset = 0
    data += bytes([simple_sum_checksum(data)])
    chunks = []
    while offset < len(data):
        chunk_size = min(MTU-1, len(data) - offset)
        # indicate if more chunks follow
        chunk = bytes((bytes([0xFF]) if offset > 0 else bytes()) +
                      bytes(data[offset:offset+chunk_size]) +
                      (bytes([0x00]) if offset + chunk_size >=
                       len(data) else bytes([0xFF])))
        chunks.append(chunk)
        offset += chunk_size
    return chunks


def decode_tunnel(chunks: bytes) -> bytes:
    """Assembles a list of byte chunks into a single bytes object.
    If a chunk ends with 0xFF, it indicates more chunks follow.
    If a chunk starts with 0xFF, it is a continuation and the 0xFF is removed.
    The last chunk ends with checksum byte and 0x00.
    """
    if isinstance(chunks, bytes):
        # single chunk, treat as list of one
        chunks = [chunks]
    assembled = bytearray()
    for i, chunk in enumerate(chunks):
        # Remove leading 0xFF if present (continuation marker)
        if i > 0:
            if chunk[0] != 0xFF:
                raise ValueError
            chunk = chunk[1:]
        # Remove trailing 0xFF or 0x00 (continuation or end marker)
        is_last = chunk[-1] == 0x00
        chunk = chunk[:-1]
        assembled += chunk
        if is_last:
            break
    if len(assembled) < 1:
        return b''
    checksum = assembled[-1]
    data = assembled[:-1]
    # checksum decoding is problematic; either align to the end (-1 for continuation) or rework checksum
    # if simple_sum_checksum(data) != checksum:
    #     print(format_bytes(assembled), checksum, simple_sum_checksum(data))
    #     raise ValueError("Checksum mismatch")
    return bytes(data)


def send_tunnel(encoded: bytes):
    chunks = encode_channel(encoded)
    for chunk in chunks:
        try:
            appdata.write_bytes(bytes(chunk))
        except:
            pass  # print("chunk: ", chunk)


appdata_last_data = b''


def receive_tunnel():
    global appdata_last_data
    try:
        data = appdata.get_bytes()
        if len(data) == 0 or data[0] == 0 or \
                data[:MTU] == appdata_last_data[:MTU]:
            return None, None
        appdata_last_data = data
        decoded = decode_tunnel(data)
        msgtype, message = decode_message_raw(decoded)
        # should somehow reset the buffer - appdata.reset()
        return msgtype, message
    except Exception as e:
        # print(e)
        # raise e
        return type(None), None


def decode_message_raw(data: list[bytes]):
    if len(data) < 2:
        raise ValueError("Data too short to decode")
    msg_type = data[0]
    # print("decode_message_raw", msg_type, data, MessageType.DebugAcknowledge)
    if msg_type == MessageType.DebugAcknowledge:
        return [msg_type, decode_debug_message_raw(data[1:])]
    elif msg_type == MessageType.PlotAcknowledge:
        return [msg_type, True]  # todo
    return [None, None]

# %%
# # test code only -- start
# messages = [
#   b'\x01\x02\x03',
#   b'',
#   b'\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F\x10\x11\x12\x13',
# ]

# for message in messages:
#     print(message)
#     encoded = encode_channel(message)
#     print(encoded)
#     decoded = decode_tunnel(encoded)
#     print(decoded)
#     print()

# # test code only -- end


# %% [markdown]
# ## Plot Message Flow

# %% [markdown]
# ### Specification

# %% [markdown]
# | direction | message | binary |
# | --- | --- | --- |
# | hub->pc | plot notification updatecells [01] (count:uint8, [name, value:float]) | `73 01 01 y a w 00 c3 f5 48 40` |
# | pc->hub | plot ack (success) *optional* | `72 00 01` |
# | alternative flow |
# | hub->pc | plot notification definition [00] (count, [name]) | `73 00 03 y a w 00 pitch 00 t i l t 00` |
# | pc->hub | plot ack (success) *optional* | `72 00 01` |
# | hub->pc | plot notification fullrow-values [03] (count, [value:float]) | `73 03 c3 f5 48 40 c3 f5 48 40 c3 f5 48 40` |
#

# %% [markdown]
# ### Example

# %%
plot_columns = []


def encode_plot_message_raw(message) -> bytes:
    subcode = message[0]
    parts = bytearray()
    parts.append(MessageType.PlotNotification)
    parts.append(subcode)

    if subcode == PlotSubCode.UpdateCells:
        # [name, value]
        plotdata = message[1]
        parts.append(len(plotdata))
        parts += pack('<B', len(plotdata))  # number of entries
        for name, value in plotdata:
            parts += encode_zstring(name)  # name
            parts += pack('<f', value)  # always float
            if not name in plot_columns:
                plot_columns.append(name)

    elif subcode == PlotSubCode.UpdateRow:
        # [value]
        values = message[1]
        values = values[0:len(plot_columns)]  # truncate to known columns
        parts.append(len(values))
        for value in values:
            parts += pack('<f', value)

    elif subcode == PlotSubCode.Define:
        # [name]
        names = message[1]
        parts.append(len(names))
        for name in names:
            parts += encode_zstring(name)
            if not name in plot_columns:
                plot_columns.append(name)

    return bytes(parts)

# %%
# # test code only -- start

# plot_columns = []
# def test(message):
#     encoded = encode_plot_message_raw(message)
#     print(encoded)
#     print(format_bytes(encoded))
#     print()

# test([PlotSubCode.Define, ['yaw', 'tilt', 'pitch']])
# test([PlotSubCode.UpdateRow, [3.1415, 3.1415, 3.1415]])
# test([PlotSubCode.UpdateCells, [['yaw', 3.1415], ['tilt', 3.1415], ['pitch', 3.1415]]])

# # test code only -- end


# %% [markdown]
# ## Debug Message Flow

# %% [markdown]
# ### Specification

# %% [markdown]
# // TODO: separate trap ack and continue ack
#
#
# | direction | message | binary |
# | --- | --- | --- |
# | hub->pc | start notification | `71 01` |
# | pc->hub | start ack:continue | `70 00` |
# | | either/or...
# | hub->pc | trap notification (file1.py, line:unit16) | `71 03 f i l e . p y 00 0a 00` |
# | hub->pc | trap notification (file1.py, line:unit16) | `71 03 l o n g l o n g e r l o n g l o n`, `ff g e r f i l e . p y 00 0a 00` |
# | hub->pc | ~~alternative<br>trap notification (file1.py crc, starts with 00, line:10)~~ | `71 03 00 11 22 33 44 0a 00` |
# | | either/or...
# | pc->hub | trap ack | `70 02` |
# | pc->hub | continue request step | `70 04 00` |
# | pc->hub | continue request exit | `70 04 ff` |
# | pc->hub | continue response | `71 05` |
# | pc->hub | get variable request (name) | `70 06 x 00` |
# | hub->pc | get variable response (name, vartype, varvalue) | `71 07 x 00 00 11 22 33 44` |
# | | 0 = none<br>1 = int32<br>2 = float32<br>3 = zstring (truncated?)<br>4 = bool (uint8) |
# | pc->hub | set variable request (name, vartype, varvalue) | `70 08 x 00 11 22 33 44` |
# | hub->pc | set variable response ack (success) | `70 09 00` |
# | hub->pc | set variable response ack (failed) | `70 09 E r r o r 00` |

# %% [markdown]
# ### Example

# %%
def encode_debug_message_raw(message) -> bytes:
    """
    Encodes a debug message from pc to hub/me.
    message: list format depends on subcode:
    """
    parts = bytearray()
    parts.append(MessageType.DebugNotification)
    subcode = message[0]
    rest = message[1:]
    parts.append(subcode)
    # if subcode == DebugSubCode.StartNotification: # nothing to add
    # if subcode == DebugSubCode.ContinueResponse: # nothing to add
    if subcode == DebugSubCode.TrapNotification:
        # trap: filename, line, variables
        filename, line = rest
        parts += encode_zstring(filename)
        parts += pack('<H', line)
    elif subcode == DebugSubCode.GetVariableResponse:
        # get variable response: name, varvalue
        name, varvalue = rest
        pytype = type(varvalue)
        vartype, encoder = VARIABLE_TYPE_MAP[pytype]
        parts += encode_zstring(name)
        parts.append(vartype)
        parts += encoder(varvalue)
    elif subcode == DebugSubCode.SetVariableResponse:
        # set variable response: error message
        [error_msg] = rest
        parts += encode_zstring(error_msg)
    return bytes(parts)

# %%
# # test code only -- start

# print("## messages to send:")
# test_messages = [
#     [DebugSubCode.StartNotification],
#     [DebugSubCode.StartAcknowledge],
#     [DebugSubCode.TrapNotification, 'file.py', 10],
#     [DebugSubCode.TrapNotification, 'longlongerlonglongerfile.py', 10],
#     [DebugSubCode.GetVariableResponse, 'var1', 1234],
#     [DebugSubCode.GetVariableResponse, 'var2', 3.14],
#     [DebugSubCode.GetVariableResponse, 'var3', 'hello'],
#     [DebugSubCode.GetVariableResponse, 'var4', True],
#     [DebugSubCode.GetVariableResponse, 'var5', False],
#     [DebugSubCode.GetVariableResponse, 'variablewithlongname', 1234],
#     [DebugSubCode.SetVariableResponse, None],
#     [DebugSubCode.SetVariableResponse, 'Value Error in conversion']
# ]
# for message in test_messages:
#     print(message)
#     encoded = encode_debug_message_raw(message)
#     # print(format_bytes(encoded))
#     send_tunnel(encoded)
#     print()

# # test code only -- end

# %%


def decode_debug_message_raw(data: list[bytes]):
    """
    Decodes a debug message from hub/me to pc.
    Returns a list or tuple, format depends on subcode
    """
    # If data is a list of bytes chunks, assemble into a single bytes object
    if len(data) < 2:
        raise ValueError("Data too short to decode")
    subcode = data[0]
    rest = data[1:]
    if subcode == DebugSubCode.StartAcknowledge:
        # start ack: success in connect to debugger
        success = data[1] != 0
        return [subcode]
    elif subcode == DebugSubCode.TrapAcknowledge:
        # trap ack: success
        success = data[1] != 0
        return [subcode]
    elif subcode == DebugSubCode.ContinueRequest:
        # trap ack: continue/exit_debug
        step = rest[0] != 0
        return [subcode, step]
    elif subcode == DebugSubCode.GetVariableRequest:
        # get variable request: name
        name, _ = decode_zstring(rest, 0)
        return [subcode, name]
    elif subcode == DebugSubCode.SetVariableRequest:
        # set variable request: name, vartype, varvalue
        name, index = decode_zstring(rest, 0)
        vartype = rest[index]
        varvalue_data = rest[index + 1:]
        if vartype == VarType.INT and len(varvalue_data) >= 4:
            varvalue = int.from_bytes(varvalue_data[:4], 'little', signed=True)
        elif vartype == VarType.FLOAT and len(varvalue_data) >= 4:
            varvalue = unpack('<f', varvalue_data[:4])[0]
        elif vartype == VarType.BOOL:
            varvalue = varvalue_data[0] != 0
        elif vartype == VarType.STRING:
            name, index = decode_zstring(rest, 0)
        # index increments
        return [subcode, name, vartype, varvalue]


# %%
# # test code only -- start

# encoded_data = [b'\x70\x00',
#                 b'\x70\x02',
#                 b'\x70\x04\x00',
#                 b'\x70\x04\xff',
#                 # set variable request, int32
#                 b'\x70\x06very_long_variable_name2\x00',
#                 b'\x70\x08var1\x00\x01\xd2\x04\x00\x00',
#                 b'\x70\x08var1\x00\x04\x01',
#                 b'\x70\x08var1\x00\x02\x56\x0e\x49\x40'
#                 ]
# for encoded in encoded_data:
#   message = decode_debug_message_raw(encoded)
#   print(message)


# test code only -- end


##############################


appdata = AppData("<BBBBBBBBBBBBBBBBBBBB")
# todo add init appdata, for now - ignore user created AppData

# from pybricks.hubs import ThisHub
# _hub = ThisHub()


def tunnel_wait(expected: list, message_to_send: bytes = None) -> (number, list):
    # target_message_type -> lambda / or subcode
    # print("tunnel_wait", expected); wait(10)
    cnt = 0
    while True:
        if not message_to_send is None and cnt % 50 == 0:
            send_tunnel(message_to_send)
        cnt += 1
        msgtype, message = receive_tunnel()
        if not message is None:
            if not type(expected) is list or len(expected) <= 1 or message[0] == expected[1]:
                # print("     received: ", expected, msgtype, message)
                return msgtype, message
        # would need to detect ans safeguard disconnect - hub.info() is not updated though
        # try:
        #     if _hub.info()['host_connected_ble'] == False:
        #         return None, None
        # except: pass
        wait(100)


# def debug_wait_ack():
#     data = tunnel_wait(MessageType.DebugAcknowledge, \
#         encode_debug_message_raw([DebugSubCode.StartNotification]))
#     print("Debugger start acknowledged", data)
#     startAcked = True

# print("Waiting for debugger start acknowledge")
# debug_wait_ack()

##############################
# Example usage

# def send_start():
#     message = [DebugSubCode.StartNotification]
#     encoded = encode_debug_message_raw(message)
#     chunks = encode_for_channel(encoded)
#     for chunk in chunks:
#         # print(f'Sending {len(chunk)} bytes: {format_bytes(chunk)}')
#         appdata.write_bytes(bytes(chunk))
#     print(']start')

# from pybricks.hubs import PrimeHub
# hub = PrimeHub()
# # sw = StopWatch()
# counter = 0
# def send_plot_updaterow():
#     global counter
#     counter += 1
#     # message = [PlotSubCode.UpdateCells, ["counter", counter], ["yaw", hub.imu.heading()]]
#     message = [PlotSubCode.UpdateRow, [counter, hub.imu.heading()]]
#     send_tunnel(encode_plot_message_raw(message))

# print("sending plot data")
# message = [PlotSubCode.Define, ["counter", "yaw"]]
# send_tunnel(encode_plot_message_raw(message))
# while True:
#     send_plot_updaterow()
#     wait(30)
#     # wait(200)
#     # must take into account in flight data volume and not overload the BLE channel!


# startAcked = False
# while True:
#     send_start()
#     data = appdata.get_bytes()
#     decoded = decode_tunnel(data)
#     msgtype = data[0]
#     message = decode_message_raw(decoded)
#     if msgtype == MessageType.DebugAcknowledge:
#         startAcked = True
#         break;
#     wait(100)
# print("Debug start acked")

# # send_start()
# # send_plot()
# last_appdata = b''
# while True:
#     data = appdata.get_bytes() # seem to show only the last state, without clearing it
#     # print(data[0])
#     if len(data)>0 and data != last_appdata:
#         last_appdata = data
#         print("data changed", data[0])
#         if data[0]!=0:
#             # print(data)
#             # print(data[0])
#             decoded = decode_tunnel(data)
#             message = decode_message_raw(decoded)
#             print(message)

#     send_plot()
#     wait(100)
