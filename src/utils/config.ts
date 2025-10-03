import * as vscode from 'vscode';
import { DeviceMetadata } from '../communication';
import { EXTENSION_KEY } from '../const';

// const CONFIG_BASEKEY = EXTENSION_KEY + '.';
export const enum ConfigKeys {
    DeviceLastConnectedName = 'lastconnected-device-name',
    DeviceEnableAutoConnectLast = 'enable-autoconnect-last-device',
    TerminalAutoClear = 'autoclear-terminal',
    ConnectionTimeout = 'connection-timeout',
    DeviceVisibilityTimeout = 'device-visibility-timeout',
    FeatureFlags = 'feature-flags',
}

export enum FeatureFlags {
    EnableAutoStartOnMagicHeader = 'enable-autostart-on-magicheader',
    LogHubOSDeviceNotification = 'log-hubos-device-notification',
    LogHubOSTunnelNotification = 'log-hubos-tunnel-notification',
    ParsePybricksAppDataForDeviceNotification = 'parse-pybricks-appdata-for-device-notification',
    PlotDataFromStdout = 'plot-data-from-stdout',
    EnableAutoConnectFirstUSBDevice = 'enable-autoconnect-first-usb-device',
    EnablePybricksDebugging = 'enable-pybricks-debugging',
}
export function getConfig<T>(key: string) {
    // use the extension section so keys are the short names from ConfigKeys
    return vscode.workspace.getConfiguration(EXTENSION_KEY).get<T>(key);
}

export async function updateConfig(key: string, value: unknown) {
    await vscode.workspace
        .getConfiguration(EXTENSION_KEY)
        .update(key, value, vscode.ConfigurationTarget.Global);
}

class Config {
    private static read<T>(key: ConfigKeys, defaultValue?: T): T {
        const value = getConfig<T>(key);
        if (value === undefined && defaultValue !== undefined) {
            return defaultValue;
        }
        return value as T;
    }
    private static async write(key: ConfigKeys, value: unknown) {
        await updateConfig(key, value);
    }
    public static getKey(key: ConfigKeys) {
        return `${EXTENSION_KEY}.${key}`;
    }

    // helper for toggling boolean flags
    private static async toggleBoolean(key: ConfigKeys, value?: boolean) {
        const current = this.read<boolean>(key) ?? false;
        const next = value === undefined ? !current : value;
        await this.write(key, next);
        return next;
    }

    public static get<T>(key: ConfigKeys, defaultValue?: T) {
        return this.read<T>(key, defaultValue);
    }
    public static async set(key: ConfigKeys, value: unknown) {
        await this.write(key, value);
    }
    public static toggle(key: ConfigKeys, value?: boolean) {
        return this.toggleBoolean(key, value);
    }

    public static encodeDeviceKey(name: string, devtype: string) {
        DeviceMetadata.generateId(name, devtype);
    }
    public static decodeDeviceKey(value: string) {
        const [devtype, name] = value ? value.split(/:(.+)/).slice(0, 2) : [];
        return { name, devtype };
    }

    static FeatureFlag = {
        get: (flag: FeatureFlags) => {
            const flags = this.read<{ [key: string]: boolean }>(
                ConfigKeys.FeatureFlags,
            );
            return flags ? !!flags[flag] : false;
        },
        toggle: async (flag: FeatureFlags, value?: boolean) => {
            const flags =
                this.read<{ [key: string]: boolean }>(ConfigKeys.FeatureFlags) || {};
            const current = !!flags[flag];
            const next = value === undefined ? !current : value;
            flags[flag] = next;
            await this.write(ConfigKeys.FeatureFlags, flags);
            return next;
        },
    };
}
export default Config;
