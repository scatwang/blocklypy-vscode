import { CompileModule } from '../logic/compile';

export const DEBUG_CODE_COMMAND_PREFIX = 'debug';

export function checkLineForBreakpoint(line: string) {
    return line.match(
        new RegExp(
            `^[^#]*#\\s*${DEBUG_CODE_COMMAND_PREFIX}\\s*(?:\\(([^)]*)\\))?\\s*$`,
        ),
    );
    // TODO: later handle print('#debug') too
}

export function transformCodeForDebugTunnel(module: CompileModule) {
    const lines = module.content.split('\n');
    const linesOut: string[] = [];
    for (let lineno = 0; lineno < lines.length; lineno++) {
        const line = lines[lineno];
        //-- match #breakpoint or #breakpoint(var1, var2, ...)
        const match = checkLineForBreakpoint(line);
        if (match) {
            const vars = match[1]
                ?.split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            const indentation = line.match(/^\s*/)?.[0] ?? '';
            linesOut.push(
                `${indentation}import dap_base; dap_base.debug_tunnel.trap(${[
                    "'" + module.filename + "'", // could use module name instead - '__name__',
                    lineno + 1,
                    `locals()`,
                    vars?.map((v) => `${v}=${v}`).join(', '),
                ]
                    .filter(Boolean)
                    .join(', ')})`,
            );
        }
        linesOut.push(line);
    }

    module.content = linesOut.join('\n');
    //return { code: linesOut.join('\n'), breakpoints };
}
