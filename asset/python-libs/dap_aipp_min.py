from pybricks.tools import AppData, wait
from ustruct import pack, unpack
from micropython import const

# Replace class definitions with constants
mt70 = const(0x70)      # MT_DBG_ACK = 0x70
mt71 = const(0x71)      # MT_DBG_NOT = 0x71
# MT_PLOT_ACK = 0x72
# MT_PLOT_NOT = 0x73

db0 = const(0x00)       # DBG_START_ACK = 0x00
db1 = const(0x01)       # DBG_START_NOT = 0x01
db2 = const(0x02)       # DBG_TRAP_ACK = 0x02
db3 = const(0x03)       # DBG_TRAP_NOT = 0x03
db4 = const(0x04)       # DBG_CONT_REQ = 0x04
db5 = const(0x05)       # DBG_CONT_RESP = 0x05
db6 = const(0x06)       # DBG_GET_REQ = 0x06
db7 = const(0x07)       # DBG_GET_RESP = 0x07
db8 = const(0x08)       # DBG_SET_REQ = 0x08
db9 = const(0x09)       # DBG_SET_RESP = 0x09

# PL_ACK = 0x00
# PL_DEFINE = 0x01
# PL_UPDATE_CELLS = 0x02
# PL_UPDATE_ROW = 0x03

vt0 = const(0)     # VT_NONE
vt1 = const(1)      # VT_INT
vt2 = const(2)    # VT_FLOAT
vt3 = const(3)   # VT_STRING
vt4 = const(4)     # VT_BOOL

MTU = const(19)

# [B]*MTU
appdata = AppData(const("<")+(const("B")*MTU))
_last = b''


def ez(s): return (bytes(s, 'utf-8') if type(s)
                   == str and len(s) else b'') + b'\x00'


def dz(b, i):
    j = b.find(0, i)
    return ('', i) if j < 0 else (b[i:j].decode(), j+1)


def cs(d): return sum(d) & 0xFF


VARIABLE_TYPE_MAP = {
    int:   (vt1, lambda v: pack('<i', v)),
    float: (vt2, lambda v: pack('<f', v)),
    str:   (vt3, lambda v: ez(v)),
    bool:  (vt4, lambda v: bytes([1 if v else 0])),
    type(None): (vt0, lambda v: b'')
}


def ec(d):
    d += bytes([cs(d)])
    o = []
    off = 0
    m = MTU-1
    L = len(d)
    while off < L:
        n = min(m, L-off)
        o.append((b'\xFF' if off else b'') +
                 d[off:off+n]+(b'\x00' if off+n >= L else b'\xFF'))
        off += n
    return o


def dc(chunks):
    if isinstance(chunks, bytes):
        chunks = [chunks]
    buf = bytearray()
    for i, c in enumerate(chunks):
        if i:
            if c[0] != 0xFF:
                raise ValueError
            c = c[1:]
        last = c[-1] == 0x00
        buf.extend(c[:-1])
        if last:
            break
    return bytes(buf[:-1]) if buf else b''  # drop checksum


def st(b):
    for c in ec(b):
        try:
            appdata.write_bytes(c)
        except:
            pass


def rt():
    global _last
    try:
        d = appdata.get_bytes()
        if not d or d[0] == 0 or d[:MTU] == _last[:MTU]:
            return None, None
        _last = d
        return dmr(dc(d))
    except:
        return type(None), None


def dmr(data: bytes):
    if len(data) < 2:
        return None, None
    t = data[0]
    if t == mt70:
        return t, dd(data[1:])
    # if t == MT_PLOT_ACK:
    #     return t, True
    return None, None


# # Plot encoding -------------------------------------------------
# _cols = []


# def ep(msg):
#     sc = msg[0]
#     p = bytearray([MT_PLOT_NOT, sc])
#     if sc == PL_UPDATE_CELLS:
#         items = msg[1]
#         p.append(len(items))
#         p += pack('<B', len(items))
#         for n, v in items:
#             p += ez(n)+pack('<f', v)
#             if n not in _cols:
#                 _cols.append(n)
#     elif sc == PL_UPDATE_ROW:
#         vals = msg[1][:len(_cols)]
#         p.append(len(vals))
#         for v in vals:
#             p += pack('<f', v)
#     elif sc == PL_DEFINE:
#         names = msg[1]
#         p.append(len(names))
#         for n in names:
#             p += ez(n)
#             if n not in _cols:
#                 _cols.append(n)
#     return bytes(p)

# Debug encoding/decoding ---------------------------------------


def ed(msg):
    sc = msg[0]
    r = msg[1:]
    p = bytearray([mt71, sc])
    if sc == db3:
        fn, ln = r
        p += ez(fn)+pack('<H', ln)
    elif sc == db7:
        name, val = r
        vt, enc = VARIABLE_TYPE_MAP[type(val)]
        p += ez(name)+bytes([vt])+enc(val)
    elif sc == db9:
        (err,) = r
        p += ez(err)
    return bytes(p)


def dd(data: bytes):
    if not data:
        return []
    sc = data[0]
    r = data[1:]
    if sc in (db0, db2):
        return [sc]
    if sc == db4:
        return [sc, r[0] != 0]
    if sc == db6:
        name, _ = dz(r, 0)
        return [sc, name]
    if sc == db8:
        name, idx = dz(r, 0)
        vt = r[idx]
        d = r[idx+1:]
        val = None
        if vt == vt1 and len(d) >= 4:
            val = unpack('<i', d[:4])[0]
        elif vt == vt2 and len(d) >= 4:
            val = unpack('<f', d[:4])[0]
        elif vt == vt4:
            val = d[0] != 0
        elif vt == vt3:
            val, _ = dz(d, 0)
        return [sc, name, vt, val]
    return [sc]


def tw(exp_type, exp_sub, send=None):
    # exp_type uses MT_DBG_ACK, exp_sub uses DBG_* constants
    c = 0
    while True:
        if send and c % 50 == 0:
            st(send)
        c += 1
        t, p = rt()
        if t == exp_type and isinstance(p, list) and p and p[0] == exp_sub:
            return t, p
        wait(100)


# Remove _DT class and replace with simple state/functions
_dt_i = False
_dt_h = False


def _in():
    global _dt_i, _dt_h
    if _dt_i:
        return _dt_h
    try:
        from pybricks.hubs import ThisHub
        h = ThisHub()
        if h.system.info().get('program_start_type') != 3:
            return False
        _dt_i = True
        st(ed([db1]))
        r = tw(mt70, db0)
        _dt_h = bool(r)
    except:
        _dt_i = False
        _dt_h = False
    return _dt_h


def dt_trap(file, line):
    global _dt_h
    if not (_dt_i and _dt_h):
        return
    r = tw(mt70, db2, ed([db3, file, line]))
    if not r:
        _dt_h = False
        return
    r = tw(mt70, db4)
    if not r:
        _dt_h = False
        return
    st(ed([db5]))


# Perform initial handshake
_in()

# --- External interface --------------------------------------
# dt_trap
