import * as vscode from 'vscode';

import { ConnectionManager } from '../communication/connection-manager';
import { hasState, onStateChange, StateChangeEvent, StateProp } from '../logic/state';
import {
    IRuntimeVariableType,
    PybricksTunnelDebugkRuntime,
} from './pybricks-tunnel-runtime';

type HubDebugMessage =
    | {
          type: 'start';
      }
    | {
          type: 'trap';
          payload: {
              filename: string;
              line: number;
              variables: Map<string, IRuntimeVariableType>;
          };
      };

class DebugTunnel {
    static _runtime: PybricksTunnelDebugkRuntime | undefined;
    static _state_isTrapped: boolean = false;

    static async onHubMessage(message: HubDebugMessage) {
        // Handle messages received from the hub

        // scenario 1. no debugger connected -> send exit and close session
        if (!this._runtime) {
            await this.sendToHub('exit\n');
            return;
        }

        // scenario 2. debugger connected -> handle message
        switch (message.type) {
            case 'start':
                await this.sendToHub('ack\n');
                this._state_isTrapped = false;
                break;
            case 'trap':
                // const vars = Object.entries(message.payload.variables);
                this._state_isTrapped = true;
                // debug callback to indicate we are at a breakpoint/trap
                this._runtime.onHubUpdateVariables(message.payload.variables);
                this._runtime.onHubTrapped(message.payload.line);
                break;
        }
    }

    public static registerRuntime(value: PybricksTunnelDebugkRuntime) {
        this._runtime = value;
    }

    public static async deregisterRuntime() {
        if (this._runtime) {
            this._runtime.endSession();
            // this._runtime.dispose();
            this._runtime = undefined;
        }
        if (this._state_isTrapped) {
            await this.sendToHub('exit\n');
            this._state_isTrapped = false;
        }
    }

    public static async performContinueAfterTrap() {
        if (!this._state_isTrapped) return;
        this._state_isTrapped = false;
        await this.sendToHub('ack\n');
    }

    public static async performSetVariable(
        varName: string,
        value: IRuntimeVariableType,
    ) {
        if (!this._state_isTrapped) return;
        let valueStr: string;
        if (typeof value === 'string') {
            valueStr = `'${value.replace(/'/g, "\\'")}'`; // escape single quotes
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            valueStr = value.toString();
        } else {
            console.warn(
                `Unsupported variable type for setting variable: ${typeof value}`,
            );
            return;
        }
        await this.sendToHub(`set ${varName} ${valueStr}\n`);

        //TODO: await response and check for ack or error
    }

    private static async sendToHub(message: string) {
        // Send message to the hub
        // Implementation depends on how the hub communication is set up
        await ConnectionManager.client?.sendTerminalUserInputAsync(message);
    }

    public static canStartSession(): boolean {
        return hasState(StateProp.Connected) === true;
    }
}

function registerDebugTunnel(context: vscode.ExtensionContext) {
    const handleStateChange = async (event: StateChangeEvent) => {
        if (
            (event.prop === StateProp.Connected && !event.value) ||
            (event.prop === StateProp.Running && !event.value)
        ) {
            // if disconnected, clear runtime
            await DebugTunnel.deregisterRuntime();
        }
    };
    context.subscriptions.push(onStateChange(handleStateChange));
}

export { DebugTunnel, HubDebugMessage, registerDebugTunnel };
