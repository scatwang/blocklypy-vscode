import * as vscode from 'vscode';
import { ConnectionState, DeviceMetadata } from '.';
import { connectDeviceAsync } from '../commands/connect-device';
import { delay } from '../extension';
import { showWarning } from '../extension/diagnostics';
import { TreeDP } from '../extension/tree-commands';
import { hasState, setState, StateProp } from '../logic/state';
import Config, { ConfigKeys, FeatureFlags } from '../utils/config';
import {
    BaseLayer,
    ConnectionStateChangeEvent,
    DeviceChangeEvent,
} from './layers/base-layer';
import { BLELayer } from './layers/ble-layer';
import { USBLayer } from './layers/usb-layer';

export const CONNECTION_TIMEOUT_DEFAULT = 15000;
export const RSSI_REFRESH_WHILE_CONNECTED_INTERVAL = 5000;
export const DEVICE_VISIBILITY_WAIT_TIMEOUT = 15000;

export class ConnectionManager {
    private static busy = false;
    private static layers: BaseLayer[] = [];
    private static _deviceChange = new vscode.EventEmitter<DeviceChangeEvent>();

    public static get allDevices() {
        const devices: {
            id: string;
            name: string;
            deviceType: string;
            metadata: DeviceMetadata;
        }[] = [];
        for (const layer of this.layers) {
            for (const [name, metadata] of layer.allDevices.entries()) {
                devices.push({
                    id: metadata.id,
                    name,
                    deviceType: metadata.deviceType,
                    metadata,
                });
            }
        }
        return devices;
    }

    public static get client() {
        return BaseLayer.ActiveClient;
    }

    public static async initialize() {
        // Initialization code here

        for (const layerCtor of [BLELayer, USBLayer]) {
            try {
                const instance = new layerCtor(
                    (event) => ConnectionManager.handleStateChange(event),
                    (event) => ConnectionManager.handleDeviceChange(event),
                );
                await instance.initialize();
                this.layers.push(instance);
                console.log(`Successfully initialized ${layerCtor.name}.`);
            } catch (e) {
                console.error(`Failed to initialize ${layerCtor.name}:`, e);
            }
        }

        await delay(500); // wait a bit for layers to settle
        await ConnectionManager.autoConnectLastDevice();
    }

    public static async connect(id: string, devtype: string) {
        if (this.busy) throw new Error('Connection manager is busy, try again later');
        this.busy = true;
        try {
            for (const layer of this.layers) {
                if (layer.supportsDevtype(devtype)) {
                    await layer.connect(id, devtype);
                    return;
                }
            }
        } catch (error) {
            showWarning(`Failed to connect to device ${id}. Error: ${String(error)}`);
        } finally {
            this.busy = false;
        }
    }

    public static async disconnect() {
        if (this.busy) throw new Error('Connection manager is busy, try again later');
        this.busy = true;
        try {
            if (BaseLayer.ActiveClient?.connected) {
                await BaseLayer.ActiveClient?.parent?.disconnect();
            }
        } catch (error) {
            showWarning(`Failed to disconnect from device: ${String(error)}`);
        } finally {
            this.busy = false;
        }
    }

    public static finalize() {
        this.stopScanning();
    }

    private static handleStateChange(event: ConnectionStateChangeEvent) {
        if (event.client === this.client && event.client !== undefined) {
            setState(
                StateProp.Connected,
                event.state === ConnectionState.Connected &&
                    event.client.connected === true,
            );
            setState(StateProp.Connecting, event.state === ConnectionState.Connecting);

            // when connected, stop scanning
            if (event.state === ConnectionState.Connected) {
                this.stopScanning();
            }
        } else if (event.client !== undefined) {
            console.log(
                `Ignoring state change from non-active client: ${event.client?.id} (${event.state})`,
            );
            return;
        }

        TreeDP.refresh();
    }

    private static handleDeviceChange(event: DeviceChangeEvent) {
        ConnectionManager._deviceChange.fire(event);

        // Auto-connect to any USB device if configured
        if (
            !this.busy &&
            Config.FeatureFlag.get(FeatureFlags.EnableAutoConnectFirstUSBDevice) &&
            !(hasState(StateProp.Connected) || hasState(StateProp.Connecting))
        ) {
            // TODO: fired twice!?!? check why
            setTimeout(() => {
                console.log('Auto-connecting to USB device:', event.metadata);
                const metadata = event.metadata;
                void this.connect(metadata.id, metadata.deviceType).catch(
                    console.error,
                );
            }, 100);
        }
    }

    public static async startScanning() {
        setState(StateProp.Scanning, true);

        await Promise.all(
            this.layers.map(async (layer) => {
                if (!layer.ready) return;
                await layer.startScanning();
            }),
        );

        TreeDP.refresh();
    }

    public static stopScanning() {
        this.layers.forEach((layer) => layer.stopScanning());
        setState(StateProp.Scanning, false);
        TreeDP.refresh();
    }

    public static waitForReadyPromise(): Promise<void[]> {
        // Wait for any layer to be ready using Promise.race
        const readyPromises = this.layers
            .map((layer) => layer.waitForReadyPromise?.())
            .filter(Boolean);
        return Promise.all<void>(readyPromises);
    }

    public static async waitTillDeviceAppearsAsync(
        id: string,
        devtype: string,
        timeout: number,
    ): Promise<void> {
        const targetlayer = this.layers.find((l) => l.supportsDevtype(devtype));

        if (targetlayer)
            await targetlayer.waitTillDeviceAppearsAsync(id, devtype, timeout);
    }

    public static onDeviceChange(
        fn: (event: DeviceChangeEvent) => void,
    ): vscode.Disposable {
        return this._deviceChange.event(fn);
    }

    public static async autoConnectLastDevice() {
        await ConnectionManager.waitForReadyPromise();
        // await Device.startScanning();

        // autoconnect to last connected device
        if (!Config.get<boolean>(ConfigKeys.DeviceEnableAutoConnectLast)) return;
        const id = Config.get<string>(ConfigKeys.DeviceLastConnectedName);
        if (!id) return;

        const { devtype } = Config.decodeDeviceKey(id);

        await ConnectionManager.waitTillDeviceAppearsAsync(
            id,
            devtype,
            DEVICE_VISIBILITY_WAIT_TIMEOUT,
        );
        if (!hasState(StateProp.Connected) && !hasState(StateProp.Connecting))
            await connectDeviceAsync(id, devtype);
    }
}

