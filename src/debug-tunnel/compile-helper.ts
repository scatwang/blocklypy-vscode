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
    for (let lineno = 0; lineno < lines.length; lineno++) {
        let line = lines[lineno];
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
                lineno + 1,
                `locals()`,
                vars?.map((v) => `${v}=${v}`).join(', '),
            ]
                .filter(Boolean)
                .join(', ')})`;
            line = `${indentation}${line_pre}; ${line}`;
        }
        linesOut.push(line);
    }

    module.content = linesOut.join('\n');
    //return { code: linesOut.join('\n'), breakpoints };
}
