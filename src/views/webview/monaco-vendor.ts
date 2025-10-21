import 'monaco-editor/esm/vs/basic-languages/less/less';
import 'monaco-editor/esm/vs/basic-languages/python/python';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
// Add more languages as needed:
// import 'monaco-editor/esm/vs/basic-languages/javascript/javascript';
// import 'monaco-editor/esm/vs/basic-languages/xml/xml';
// etc.

// Make monaco available globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(window as any).monaco = monaco;

export default monaco;
