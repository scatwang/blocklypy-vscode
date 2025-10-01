import * as vscode from 'vscode';
import { CustomEditorFileWatcherBase } from './CustomEditorFileWatcherBase';

export interface DocumentState<TContent> {
    document: vscode.CustomDocument;
    panel?: vscode.WebviewPanel;
    dirty: boolean;
    content: TContent | undefined;
    uriLastModified: number;
    refreshing?: boolean;
    webviewReady?: Promise<void>;
    webviewReadyResolver?: (() => void) | undefined;
    // optional generic message hook for subclasses
    onMessage?: (msg: unknown) => void;
}

// type ExtractContent<TState extends DocumentState<unknown>> =
//     TState extends DocumentState<infer C> ? C : unknown;

export abstract class CustomEditorProviderBase<TState extends DocumentState<unknown>>
    extends CustomEditorFileWatcherBase
    implements vscode.CustomReadonlyEditorProvider
{
    private static providerByType = new Map<
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        Function,
        CustomEditorProviderBase<DocumentState<unknown>>
    >();
    protected documents = new Map<vscode.Uri | undefined, TState>();
    protected activeUri?: vscode.Uri;

    constructor(protected readonly context: vscode.ExtensionContext) {
        super();

        const providerType = this.constructor as new (
            context: vscode.ExtensionContext,
        ) => CustomEditorProviderBase<DocumentState<unknown>>;
        CustomEditorProviderBase.providerByType.set(providerType, this);
    }

    public static register(
        context: vscode.ExtensionContext,
        providerCreator: new (
            context: vscode.ExtensionContext,
        ) => CustomEditorProviderBase<DocumentState<unknown>>,
        providerKey: string,
    ): vscode.Disposable {
        const provider = new providerCreator(context);
        return vscode.window.registerCustomEditorProvider(providerKey, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    public static getProviderByType(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        providerType: Function,
    ): CustomEditorProviderBase<DocumentState<unknown>> | undefined {
        return this.providerByType.get(providerType);
    }

    openCustomDocument(
        uri: vscode.Uri,
        _openContext: { backupId?: string },
        _token: vscode.CancellationToken,
    ): vscode.CustomDocument {
        const document: vscode.CustomDocument = {
            uri,
            dispose: () => {
                this.documents.delete(uri);
                if (this.activeUri === uri) {
                    this.activeUri = undefined;
                }
            },
        };

        const state = this.createDocumentState(document);
        this.documents.set(uri, state);
        this.activeUri = uri;
        return document;
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this.activeUri = document.uri;

        const state = this.documents.get(document.uri);
        if (!state) throw new Error('Document state not found');
        state.panel = webviewPanel;

        // create ready promise and register onDidReceiveMessage BEFORE assigning html
        state.webviewReady = new Promise<void>((resolve) => {
            state.webviewReadyResolver = resolve;
        });

        // register message handler early so the webview can't race past us
        const msgDisposable = webviewPanel.webview.onDidReceiveMessage((msg) => {
            try {
                if ((msg as { command?: string })?.command === 'webviewReady') {
                    state.webviewReadyResolver?.();
                }
                state.onMessage?.(msg);
            } catch (e) {
                console.error('Error in webview message handler:', e);
            }
        });
        this.context.subscriptions.push(msgDisposable);

        webviewPanel.onDidChangeViewState(
            async (_e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
                const state = this.documents.get(document.uri);
                if (webviewPanel.active) {
                    this.activeUri = document.uri;
                    if (state?.dirty) {
                        await this.refreshWebviewAsync(document, webviewPanel, true);
                        // setContextContentAvailability is called in refreshWebview
                    } else {
                        await this.activateWithoutRefresh(document, webviewPanel);
                    }
                } else if (this.activeUri === document.uri) {
                    this.activeUri = undefined;
                }
            },
        );

        webviewPanel.onDidDispose(() => {
            this.documents.delete(document.uri);
            if (this.activeUri === document.uri) {
                this.activeUri = undefined;
            }
            msgDisposable.dispose();
        });

        webviewPanel.webview.options = { enableScripts: true };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel);

        // intentionally not awaited
        setTimeout(() => {
            void this.safeRefreshWebviewAsync(document, webviewPanel, true).catch(
                console.error,
            );
        }, 0);

        return;
    }

    protected async safeRefreshWebviewAsync(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        forced?: boolean,
    ): Promise<void> {
        const state = this.documents.get(document.uri);
        if (!state) return;
        if (state.refreshing) return; // already running, skip re-entrant refresh
        state.refreshing = true;
        try {
            await this.refreshWebviewAsync(document, webviewPanel, forced);
        } finally {
            state.refreshing = false;
        }
    }

    protected async waitForWebviewReady(
        state: DocumentState<unknown>,
        timeoutMs: number = 2000,
    ): Promise<boolean> {
        if (!state.webviewReady) return false;
        try {
            const ready = await Promise.race([
                state.webviewReady.then(() => true),
                new Promise<boolean>((resolve) =>
                    setTimeout(() => resolve(false), timeoutMs),
                ),
            ]);
            return ready;
        } catch {
            return false;
        }
    }

    protected abstract createDocumentState(document: vscode.CustomDocument): TState;
    protected abstract getHtmlForWebview(webviewPanel: vscode.WebviewPanel): string;
    protected abstract refreshWebviewAsync(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        forced?: boolean,
    ): Promise<void>;
    protected abstract activateWithoutRefresh(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
    ): Promise<void>;

    public get ActiveUri(): vscode.Uri | undefined {
        return this.activeUri;
    }

    protected disposeAll() {
        for (const state of this.documents.values()) {
            state.panel?.dispose();
        }
        this.documents.clear();
    }
}
