import * as vscode from 'vscode';
import { StartMode } from '../communication/clients/base-client';
import { PybricksBleClient } from '../communication/clients/pybricks-ble-client';
import { ConnectionManager } from '../communication/connection-manager';
import { hasState, onStateChange, StateProp } from '../logic/state';
import { waitForCondition } from '../utils';

const KERNEL_ID = 'blocklypy-micropython';
const KERNEL_LABEL = 'MicroPython on LEGO Hub';
const REPL_START = 'REPL: start';
const REPL_END = 'REPL: end';
const REPL_END2 = '>>>';

// Track REPL state per connected client session so we don't restart it every cell
let replActive = false;
let replClientId: string | undefined = undefined;
let executionCounter = 1;

export function registerMicroPythonNotebookController(
    context: vscode.ExtensionContext,
) {
    const controller = vscode.notebooks.createNotebookController(
        KERNEL_ID,
        'jupyter-notebook',
        KERNEL_LABEL,
    );
    controller.supportedLanguages = ['python'];
    controller.supportsExecutionOrder = true;

    controller.executeHandler = async (cells, _notebook, _controller) => {
        for (const cell of cells) {
            await executeCell(controller, cell);
        }
    };

    controller.interruptHandler = async (_notebook) => {
        const client = ConnectionManager.client as PybricksBleClient | undefined;
        if (!client) {
            return;
        }
        try {
            await client.sendTerminalUserInputAsync('\x03'); // Ctrl-C
        } catch {
            // ignore
            replActive = false;
        }
    };

    context.subscriptions.push(controller);

    context.subscriptions.push(
        onStateChange(() => {
            if (!hasState(StateProp.Running)) {
                replActive = false;
                executionCounter = 1;
            }
        }),
    );
}

async function executeCell(
    controller: vscode.NotebookController,
    cell: vscode.NotebookCell,
) {
    const exec = controller.createNotebookCellExecution(cell);
    exec.executionOrder = executionCounter++;
    exec.start(Date.now());
    exec.clearOutput();

    const client = ConnectionManager.client as PybricksBleClient | undefined;
    if (!client || !client.connected) {
        await exec.appendOutput(
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.stderr(
                    'No device connected. Use the extension to connect a device and try again.',
                ),
            ]),
        );
        return exec.end(false, Date.now());
    }

    // Ensure REPL is running only once per client session
    if (!replActive || replClientId !== client.id) {
        try {
            await client.action_start(StartMode.REPL);
            replActive = true;
            replClientId = client.id;
        } catch (e) {
            await exec.appendOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.stderr(
                        `Failed to start REPL: ${String(e)}`,
                    ),
                ]),
            );
            replActive = false;
            return exec.end(false, Date.now());
        }
    }

    // Stream stdout to cell
    const disposables: vscode.Disposable[] = [];
    // let lastChunkAt = Date.now();
    let isOutputStarted = false;
    let isOutputEnded = false;
    const stdoutHandler = client.onStdout((chunk) => {
        // lastChunkAt = Date.now();

        const lines = chunk.split(/\r?\n/);
        for (const line of lines) {
            if (line === REPL_START) {
                isOutputStarted = true;
                continue;
            }
            if (line === REPL_END || line.trim() === REPL_END2) {
                isOutputEnded = true;
                break;
            }
            if (!isOutputStarted) {
                continue;
            }
            exec.appendOutput(
                new vscode.NotebookCellOutput([
                    vscode.NotebookCellOutputItem.stdout(line),
                ]),
            );
        }
    });
    disposables.push(stdoutHandler);

    try {
        const code = `print('${REPL_START}')\r\n${cell.document.getText()}\r\nprint('${REPL_END}')\r\n`;

        await client.sendCodeToRepl(code);

        await waitForCondition(() => isOutputEnded, 10 * 1000);
        exec.end(true, Date.now());
    } catch (e) {
        await exec.appendOutput(
            new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.stderr(String(e)),
            ]),
        );
        exec.end(false, Date.now());
    } finally {
        disposables.forEach((d) => {
            d.dispose();
        });
        // If the client disconnected between runs, reset our REPL session tracking
        if (!client.connected) {
            replActive = false;
            replClientId = undefined;
        }
    }
}
