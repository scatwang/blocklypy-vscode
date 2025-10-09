import { compiledModules, CompileModule } from '../logic/compile';
import { AIPP_MODULE_NAME } from '../pybricks/appdata-instrumentation-protocol';

export const DEBUG_MODULE_NAME = 'dap_aipp'; // name of the module to import in user code - file name without .py
export const DEBUG_ASSET_MODULES = [DEBUG_MODULE_NAME, AIPP_MODULE_NAME];

function canHaveBreakpoint(_path: string, _lineno: number, line: string) {
    // check if lines is empty or line starts with a comment
    return line.trim().length > 0 && !line.trim().startsWith('#');
}

export function checkLineForBreakpoint(path: string, lineno: number, line: string) {
    return !!compiledModules?.get(path)?.breakpoints?.includes(lineno);
}

/*
TODO: !!!
if not connected over ble - skip
create and exit
maybe timeout?
*/

export function transformCodeForDebugTunnel(
    module: CompileModule,
    breakpointsInput: number[] = [],
) {
    const lines = module.content.split('\n');
    const linesOut: string[] = [];
    const breakpointsCompiled = new Set<number>();
    for (let lineno0 = 0; lineno0 < lines.length; lineno0++) {
        let line = lines[lineno0];
        const lineno1 = lineno0 + 1;
        if (
            checkLineForBreakpoint(module.path, lineno1, line) ||
            (breakpointsInput.includes(lineno1) &&
                canHaveBreakpoint(module.path, lineno1, line))
        ) {
            const indentation = line.match(/^\s*/)?.[0] ?? '';
            const line_pre = `import ${DEBUG_MODULE_NAME}; ${DEBUG_MODULE_NAME}.debug_tunnel.trap('${module.filename}', ${lineno1})`;
            line = `${indentation}${line_pre}; ${line}`;
            breakpointsCompiled.add(lineno1);

            // found a breakpoint, add to breakpoints map
            if (!breakpointsInput.includes(lineno1)) breakpointsInput.push(lineno1);
        }
        linesOut.push(line);
    }

    // update module content and breakpoints
    module.content = linesOut.join('\n');
    module.breakpoints = Array.from(breakpointsCompiled).sort((a, b) => a - b);
}
