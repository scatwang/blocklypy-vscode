import { logDebug } from '../extension/debug-channel';
import { CompileModule } from '../logic/compile';

export const DEBUG_CODE_COMMAND_PREFIX = 'debug';
export const DEBUG_MODULE_NAME = 'dap_base.py';

export function checkLineForBreakpoint(line: string) {
    return line.match(
        new RegExp(
            `^[^#]*#\\s*${DEBUG_CODE_COMMAND_PREFIX}\\s*(?:\\(([^)]*)\\))?\\s*$`,
        ),
    );
}

export function transformCodeForDebugTunnel(module: CompileModule) {
    const lines = module.content.split('\n');
    const linesOut: string[] = [];
    const breakpoints = new Map<string, number[]>();
    for (let lineno0 = 0; lineno0 < lines.length; lineno0++) {
        let line = lines[lineno0];
        const lineno1 = lineno0 + 1;
        //-- match # debug or # debug(var1, var2, ...)
        const match = checkLineForBreakpoint(line);
        if (match) {
            const vars = match[1]
                ?.split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            const indentation = line.match(/^\s*/)?.[0] ?? '';
            const line_pre = `import dap_base; dap_base.debug_tunnel.trap(${[
                "'" + module.filename + "'", // could use module name instead - '__name__',
                lineno1,
                `locals()`,
                vars?.map((v) => `${v}=${v}`).join(', '),
            ]
                .filter(Boolean)
                .join(', ')})`;
            line = `${indentation}${line_pre}; ${line}`;

            // found a breakpoint, add to breakpoints map
            if (!breakpoints.has(module.filename)) breakpoints.set(module.filename, []);
            breakpoints.get(module.filename)?.push(lineno1);
        }
        linesOut.push(line);
    }

    module.content = linesOut.join('\n');
    if (breakpoints.size > 0) {
        logDebug(
            `Note: Transforing code for debug tunnel. Compiled an instrumented version of code, that might yield to side effects and different line numbers.`,
        );
    }

    return { code: module.content, breakpoints };
}
