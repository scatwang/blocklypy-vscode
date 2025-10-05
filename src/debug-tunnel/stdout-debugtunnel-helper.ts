import { DebugTunnel } from './debug-tunnel';
import { IRuntimeVariableType } from './runtime';

export const DEBUG_COMMAND_PREFIX = 'debug:';
/**
 * Parse a line from stdout for plot commands and handle them for Debug Tunnel.
 * @param line A line from stdout
 * @returns void
 *
 * Examples:
 * ```
 * debug: start
 * debug: trap ['dap2test.py', 2, {}]
 * debug: trap ['dap2test.py', 11, {'x': 1, 'strval': 'alma', 'y': 42}]
 */

export async function parseDebugTunnelCommand(line: string) {
    if (!DebugTunnel.isDebugging()) return;

    if (!line.startsWith(DEBUG_COMMAND_PREFIX)) return;
    const line1 = line.substring(DEBUG_COMMAND_PREFIX.length).trim();

    // --- start command ---
    // e.g. "start"
    if (/^start$/.test(line1)) {
        await DebugTunnel.onHubMessage({ type: 'start' });
    }

    // --- trap command ---
    // e.g. "trap ['dap2test.py', 2, {x: 1, strval: 'alma', y: 42}]"
    else if (line1.startsWith('trap')) {
        const match = line1.match(
            /^trap\s*\[\s*'([^']+)'\s*,\s*(\d+)\s*,\s*(\{.*\})\s*\]\s*$/,
        );
        if (match) {
            const filename = match[1];
            const lineNo = parseInt(match[2], 10);
            const vars = match[3]
                .replace(/^\{|\}$/g, '') // remove curly braces
                .split(',')
                .map((v) => v.trim())
                .filter((v) => v.length > 0) // filter out empty strings
                .reduce((acc, pair) => {
                    let [key, value] = pair.split(':').map((s) => s.trim());

                    // unescape key if it's quoted
                    if (/^'.*'$/.test(key)) {
                        key = key.slice(1, -1);
                    }

                    // Try to parse value as number, boolean, or keep as string
                    let parsed: IRuntimeVariableType = value;
                    if (/^[-+]?\d*\.?\d+$/.test(value)) {
                        parsed = Number(value);
                    } else if (value === 'true' || value === 'false') {
                        parsed = Boolean(value);
                    } else if (/^'.*'$/.test(value)) {
                        parsed = value.slice(1, -1);
                    }
                    acc.set(key, parsed);
                    return acc;
                }, new Map<string, IRuntimeVariableType>());

            await DebugTunnel.onHubMessage({
                type: 'trap',
                payload: {
                    filename: filename,
                    line: lineNo,
                    variables: vars,
                },
            });
        }
    }
}
