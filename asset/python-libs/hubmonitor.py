"""
HubCentral utility script monitoring connected devices and sending
device notification messages.

This script encodes battery, IMU, and connected device data into
device notification messages and sends them using the AppData interface.
Follows the HubOS3 device notification message format.

Encodes and sends device notification messages via AIPP protocol.
"""

from ustruct import pack
from pybricks.hubs import ThisHub
from pybricks.parameters import Side, Port
from pybricks.tools import wait, AppData
from pybricks.iodevices import PUPDevice

# DeviceMonitor feature
portchars = ['A', 'B', 'C', 'D', 'E', 'F']


class DeviceMonitor:
    def __init__(self, hub, appdata):
        self.hub = hub
        self.ports = [getattr(Port, p, None) for p in portchars]
        pl = len(portchars)
        self.devs = [None]*pl
        self.infos = [None]*pl
        self.detect = [-60]*pl
        self.i = 0
        self.appdata = appdata

    def enc_bat(self, l): return pack('<BB', 0x00, l)

    def enc_imu(self, fu, yf, y, pi, r, ax, ay, az, gx, gy, gz): return pack(
        '<BBBhhhhhhhhh', 0x01, int(fu), yf, y, pi, r, ax, ay, az, gx, gy, gz)

    def enc_motor(self, p, t, ap, po, sp, pos): return pack(
        '<BBBhhbi', 0x0a, p, t, ap, po, sp, pos)

    def enc_force(self, p, v, pr): return pack(
        '<BBBB', 0x0b, p, v, 1 if pr else 0)

    def enc_color(self, p, c, r, g, b): return pack(
        '<BBBHHH', 0x0c, p, c, r, g, b)

    def enc_dist(self, p, d): return pack('<BBh', 0x0d, p, d)

    def enc_devnotif(self, pl): d = b''.join(
        pl); return pack('<BH', 0x3c, len(d))+d

    def get_dev_payload(self, pi, dev, info):
        did = info.get("id")
        try:
            if did in (48, 49, 65, 75, 76, 38):
                abs_pos = dev.read(2)[0]
                power = dev.read(0)[0]
                speed = dev.read(1)[0]
                position = dev.read(3)[0] if len(
                    dev.info().get("modes", [])) > 3 else abs_pos
                return self.enc_motor(pi, did, abs_pos, power, speed, int(position))
            if did == 63:
                f = dev.read(0)[0]
                p = bool(dev.read(1)[0])
                return self.enc_force(pi, f, p)
            if did == 62:
                return self.enc_dist(pi, dev.read(0)[0])
            if did == 61:
                c = dev.read(0)[0]
                rgb = dev.read(3)
                r, g, b = (rgb if len(rgb) == 3 else (0, 0, 0))
                return self.enc_color(pi, c, r, g, b)
            if did == 37:
                c = dev.read(0)[0]
                d = dev.read(1)[0]
                return self.enc_color(pi, c, 0, 0, 0)+self.enc_dist(pi, d)
        except:
            pass
        return None

    def bat_payload(self):
        v = self.hub.battery.voltage()
        p = min(100, max(0, int((v-6000)/(8300-6000)*100)))
        return self.enc_bat(p)

    def imu_payload(self):
        up = self.hub.imu.up()
        face_map = {Side.TOP: 0, Side.BOTTOM: 1, Side.LEFT: 2,
                    Side.RIGHT: 3, Side.FRONT: 4, Side.BACK: 5}
        face_up = up == Side.TOP
        yf = face_map.get(up, 0)
        y = int(self.hub.imu.heading())
        pi, ro = map(int, self.hub.imu.tilt())
        ax, ay, az = map(int, self.hub.imu.acceleration())
        gx, gy, gz = map(int, self.hub.imu.angular_velocity())
        return self.enc_imu(face_up, yf, y, pi, ro, ax, ay, az, gx, gy, gz)

    def loop_check(self, interval_ms=30):
        while True:
            self.i += 1
            payloads = [self.bat_payload(), self.imu_payload()]
            for idx, port in enumerate(self.ports):
                try:
                    if self.devs[idx] is None and self.i > self.detect[idx]+60:
                        d = PUPDevice(port)
                        self.devs[idx] = d
                        self.infos[idx] = d.info()
                    d = self.devs[idx]
                    info = self.infos[idx]
                    if d and info:
                        p = self.get_dev_payload(idx, d, info)
                        if p:
                            payloads.append(p)
                except:
                    self.devs[idx] = None
                    self.infos[idx] = None
                    self.detect[idx] = self.i
            msg = self.enc_devnotif(payloads)
            aipp_send(msg, self.appdata)
            wait(interval_ms)

# AIPP module


def aipp_send(data, appdata):
    mtu = 17
    data += bytes([sum(data) & 0xFF])
    total = len(data)
    for i in range(0, total, mtu):
        chunk = (b'\xfe' if i == 0 else b'\xff') + \
            data[i:i+mtu]+(b'\x00' if (i+mtu) >= total else b'\xff')
        appdata.write_bytes(chunk)
        wait(5)


DeviceMonitor(ThisHub(), AppData("")).loop_check(50)
