import * as vscode from 'vscode';
import { ConnectionState, DeviceMetadata } from '.';
import { connectDeviceAsync } from '../commands/connect-device';
import { MILLISECONDS_IN_SECOND } from '../const';
import Config, { ConfigKeys, FeatureFlags } from '../extension/config';
import { logDebug } from '../extension/debug-channel';
import { showWarning } from '../extension/diagnostics';
import { RefreshTree } from '../extension/tree-commands';
import { hasState, setState, StateProp } from '../logic/state';
import { setLastDeviceNotificationPayloads } from '../user-hooks/device-notification-hook';
import { sleep } from '../utils';
import {
    BaseLayer,
    ConnectionStateChangeEvent,
    DeviceChangeEvent,
    LayerKind,
} from './layers/base-layer';

export const CONNECTION_TIMEOUT_SEC_DEFAULT = 15;
export const RSSI_REFRESH_WHILE_CONNECTED_INTERVAL_MS = 5 * MILLISECONDS_IN_SECOND;
export const DEVICE_VISIBILITY_WAIT_TIMEOUT_MS = 15 * MILLISECONDS_IN_SECOND;
const IDLE_CHECK_INTERVAL_MS = 10 * MILLISECONDS_IN_SECOND;

export class ConnectionManager {
    private static busy = false;
    private static layers: BaseLayer[] = [];
    private static _deviceChange = new vscode.EventEmitter<DeviceChangeEvent>();
    private static idleTimer: NodeJS.Timeout | undefined = undefined;
    private static lastActivityTime: number = 0;
    private static _initialized = false;

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

    public static get initialized() {
        return this._initialized;
    }

    public static async initialize(
        layerTypes: (typeof BaseLayer)[] = [],
    ): Promise<void> {
        // Initialization code here
        this._initialized = true;

        // Construct all instances first
        const instances = layerTypes.map(
            (layerCtor) =>
                new layerCtor(
                    (event) => ConnectionManager.handleStateChange(event),
                    (event) => ConnectionManager.handleDeviceChange(event),
                ),
        );

        // Initialize in parallel and only keep successful ones
        const results = await Promise.allSettled(
            instances.map((instance) => instance.initialize()),
        );
        results.forEach((res, idx) => {
            const inst = instances[idx];
            if (res.status === 'fulfilled') {
                this.layers.push(inst);
                console.debug(`Successfully initialized ${inst.descriptor.kind}.`);
            } else {
                console.error(
                    `Failed to initialize ${layerTypes[idx]?.name}:`,
                    res.reason,
                );
            }
        });

        // Start scanning if not already connected
        if (
            !(
                hasState(StateProp.Connected) ||
                hasState(StateProp.Connecting) ||
                hasState(StateProp.Scanning)
            )
        ) {
            await this.startScanning();
        }

        await sleep(500); // wait a bit for layers to settle
        return ConnectionManager.autoConnectOnInit();
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

    public static async connectManuallyOnLayer(layerid?: string) {
        if (this.busy) throw new Error('Connection manager is busy, try again later');

        if (hasState(StateProp.Connected)) {
            await ConnectionManager.disconnect();
        }

        this.busy = true;
        try {
            const targetLayer = this.layers.find(
                (layer) => layer.descriptor.id === layerid,
            );
            await targetLayer?.manualConnect();
        } finally {
            this.busy = false;
        }
    }

    public static finalize() {
        this.stopScanning();

        this.layers.forEach((layer) => {
            void layer.finalize();
        });
        this.layers = [];
        this._deviceChange.dispose();
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
                setLastDeviceNotificationPayloads(undefined);
            }
        } else if (event.client !== undefined) {
            console.debug(
                `Ignoring state change from non-active client: ${event.client?.id} (${event.state})`,
            );
            return;
        }

        RefreshTree();
    }

    private static handleDeviceChange(event: DeviceChangeEvent) {
        ConnectionManager._deviceChange.fire(event);
    }

    public static get canScan(): boolean {
        return this.layers.some((layer) => layer.descriptor.canScan);
    }
    public static getLayers(canScan: boolean) {
        return this.layers.filter((layer) => layer.descriptor.canScan === canScan);
    }

    public static async startScanning() {
        if (!this.layers.some((layer) => layer.descriptor.canScan)) {
            return;
        }

        // Avoid redundant state churn
        if (hasState(StateProp.Scanning)) {
            RefreshTree();
            return;
        }

        const tasks = this.getLayers(true).map(async (layer) => {
            if (!layer.ready) throw new Error('Layer not ready');
            await layer.startScanning();
            return true;
        });
        const results = await Promise.allSettled(tasks);
        const startedAny = results.some((r) => r.status === 'fulfilled');
        setState(StateProp.Scanning, startedAny);

        RefreshTree();
    }

    public static stopScanning() {
        if (!hasState(StateProp.Scanning)) {
            return;
        }
        this.getLayers(true).forEach((layer) => layer.stopScanning());
        setState(StateProp.Scanning, false);
        RefreshTree();
    }

    public static waitForReadyPromise(): Promise<void[]> {
        // Wait for all layers that expose a ready promise
        const readyPromises = this.layers
            .map((layer) => layer.waitForReadyPromise?.())
            .filter(Boolean);
        return Promise.all<void>(readyPromises);
    }

    public static async waitTillAnyDeviceAppearsAsync(
        ids: string[],
        timeout: number,
    ): Promise<string | undefined> {
        // const targetlayer = this.layers.find((l) => l.supportsDevtype(devtype));

        // if (targetlayer)
        //     await targetlayer.waitTillDeviceAppearsAsync(id, devtype, timeout);
        const promises = this.layers.map((layer) =>
            layer.waitTillAnyDeviceAppearsAsync(ids, timeout),
        );

        if (promises.length === 0) return undefined;

        // Resolve with the first fulfilled promise, ignore individual rejections,
        // and reject if all promises reject.
        return new Promise<string | undefined>((resolve, reject) => {
            const errors: unknown[] = [];
            let rejected = 0;

            for (const p of promises) {
                p.then((id) => resolve(id)).catch((err) => {
                    errors.push(err);
                    rejected++;
                    if (rejected === promises.length) {
                        reject(new AggregateError(errors, 'Device not available.'));
                    }
                });
            }
        });
    }

    public static onDeviceChange(
        fn: (event: DeviceChangeEvent) => void,
    ): vscode.Disposable {
        return this._deviceChange.event(fn);
    }

    // Idle disconnect management - disconnect device after specified idle timeout (idle = connected, but no prgram running)
    public static startIdleTimer() {
        this.stopIdleTimer();

        const idleSeconds = Config.get<number>(ConfigKeys.IdleDisconnectTimeoutSec, 0);
        if (idleSeconds <= 0) {
            return; // Idle disconnect is disabled
        }

        this.lastActivityTime = Date.now();
        const checkInterval = IDLE_CHECK_INTERVAL_MS; // Check every 10 seconds

        this.idleTimer = setInterval(() => {
            const idleMillis = Date.now() - this.lastActivityTime;
            const idleTimeoutMillis = idleSeconds * MILLISECONDS_IN_SECOND;

            if (idleMillis >= idleTimeoutMillis) {
                console.debug(
                    `Disconnecting device due to ${idleSeconds} seconds of inactivity.`,
                );
                this.stopIdleTimer();
                void this.disconnect().then(() => {
                    logDebug(
                        `Device disconnected after ${idleSeconds} seconds of inactivity.`,
                    );
                });
            }
        }, checkInterval);
    }

    public static stopIdleTimer() {
        if (this.idleTimer) {
            clearInterval(this.idleTimer);
            this.idleTimer = undefined;
        }
    }

    // public static resetIdleTimer() {
    //     if (this.idleTimer) {
    //         this.lastActivityTime = Date.now();
    //     }
    // }

    public static async autoConnectOnInit() {
        await ConnectionManager.waitForReadyPromise();
        // await Device.startScanning();

        const autoconnectIds: string[] = [];

        if (Config.FeatureFlag.get(FeatureFlags.AutoConnectFirstUSBDevice)) {
            // autoconnect to first USB device
            // find usb layer
            const usbLayer = this.layers.find(
                (layer) => layer.descriptor.kind === LayerKind.USB,
            );
            if (usbLayer) autoconnectIds.push(usbLayer.descriptor.kind!); // connect to any device of
        }

        if (
            Config.get<boolean>(ConfigKeys.DeviceAutoConnectLast) &&
            Config.get<string>(ConfigKeys.DeviceLastConnectedName)
        ) {
            // autoconnect to last connected device
            const id = Config.get<string>(ConfigKeys.DeviceLastConnectedName);
            // const { devtype } = Config.decodeDeviceKey(id);
            autoconnectIds.push(id);
        }

        if (autoconnectIds.length === 0) return;

        const id = await ConnectionManager.waitTillAnyDeviceAppearsAsync(
            autoconnectIds,
            DEVICE_VISIBILITY_WAIT_TIMEOUT_MS,
        );
        if (id && !hasState(StateProp.Connected) && !hasState(StateProp.Connecting)) {
            const { devtype } = Config.decodeDeviceKey(id);
            await connectDeviceAsync(id, devtype);
        }
    }
}
