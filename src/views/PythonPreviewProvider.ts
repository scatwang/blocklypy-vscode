import { convertProjectToPython } from 'blocklypy';
import * as vscode from 'vscode';
import { EXTENSION_KEY } from '../const';
import GraphvizLoader from '../utils/graphviz-helper';
import { collectPythonModules } from '../utils/python-module-collector';
import {
    CustomEditorProviderBase,
    DocumentState,
} from './helpers/CustomEditorProviderBase';
import { getScriptUri } from './utils';

const PYTHONPREVIEW_VIEW_ID = EXTENSION_KEY + '-pythonPreview';
const PYTHONPREVIEW_WEBVIEW_NAME = 'PythonPreviewWebview';

export class PythonPreviewProvider
    extends CustomEditorProviderBase<DocumentState<string>>
    implements vscode.CustomReadonlyEditorProvider
{
    public static get Get(): PythonPreviewProvider | undefined {
        const provider = PythonPreviewProvider.getProviderByType(
            PythonPreviewProvider.prototype.constructor,
        );
        return provider as PythonPreviewProvider | undefined;
    }

    public static get TypeKey() {
        return PYTHONPREVIEW_VIEW_ID;
    }

    /**
     *
     * @param uri Encodes a file URI into a custom URI for the Python preview, adding a "Graph: " prefix to the filename for display
     * @returns The custom URI
     */
    public static encodeUri(uri: vscode.Uri) {
        const filename = uri.path.split('/').pop() || uri.path;
        const customUri = uri.with({
            path: 'Graph: ' + filename,
            fragment: uri.path,
        });
        return customUri;
    }

    /**
     * Decode a custom URI back into a file URI
     * @param uri The custom URI to decode
     * @returns The original file URI
     */
    public static decodeUri(uri: vscode.Uri) {
        return uri.with({
            path: uri.fragment,
            fragment: '',
        });
    }

    protected createDocumentState(
        document: vscode.CustomDocument,
    ): DocumentState<string> {
        return {
            document,
            content: undefined,
            dirty: false,
            uriLastModified: 0,
            panel: undefined,
        };
    }

    protected async refreshWebviewAsync(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _forced = false,
    ) {
        try {
            const state = this.documents.get(document.uri);
            if (!state) return;

            // Collect all modules and generate the dependency graph
            const modules = await collectPythonModules(
                PythonPreviewProvider.decodeUri(document.uri),
            );
            const encoder = new TextEncoder();
            const files = modules.map((m) => ({
                name: m.path.split('/').pop()!, // Use only the filename
                buffer: encoder.encode(m.content).buffer,
            }));
            const result = await convertProjectToPython(files, {});
            const dependencygraph = result.dependencygraph;
            state.content = '';

            if (dependencygraph) {
                const graphviz = await GraphvizLoader();
                if (dependencygraph) {
                    state.content = (await graphviz?.dot(dependencygraph)) ?? '';
                }
            }

            await this.setContentAsync(state.content, webviewPanel);

            // Set up file change monitoring (re-do every time to catch new imports)
            await this.monitorFileChanges(
                document,
                webviewPanel,
                () =>
                    this.refreshWebviewAsync(document, webviewPanel).catch(
                        console.error,
                    ),
                new Set<string>(modules.map((m) => m.path)),
            );
        } catch (error) {
            console.error('Error in refreshWebview:', error);
        }
    }

    protected async activateWithoutRefresh(
        _document: vscode.CustomDocument,
        _webviewPanel: vscode.WebviewPanel,
    ) {
        // do nothing
    }

    private async setContentAsync(content: string, webviewPanel: vscode.WebviewPanel) {
        await webviewPanel.webview.postMessage({
            command: 'setContent',
            content,
        });
    }

    protected getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string {
        const scriptUri = getScriptUri(
            this.context,
            webviewPanel,
            PYTHONPREVIEW_WEBVIEW_NAME,
        );
        // const scriptUri = webviewPanel.webview.asWebviewUri(
        //     vscode.Uri.joinPath(
        //         this.context.extensionUri,
        //         'dist',
        //         'PythonPreviewWebview.js',
        //     ),
        // );
        return `
            <!DOCTYPE html>
            <html>
            <head>
            <meta charset="UTF-8">
            <style>
            html, body, #graph-container {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
            }
            #graph-container svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            </style>
            <body>
                <div id="graph-container"></div>
                <script>
                (function(){
                    const vscode = acquireVsCodeApi();
                    vscode.postMessage({ command: 'webviewReady' });
                })();
                </script>
                <script defer src="${String(scriptUri)}"></script>
            </body>
            </html>
        `;
    }
}
