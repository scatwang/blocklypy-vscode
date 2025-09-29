import os from 'os';
import path from 'path';
import * as vscode from 'vscode';

export function getActiveFileFolder(): vscode.Uri {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (workspaceFolder) return workspaceFolder;

    const activeFile = vscode.window.activeTextEditor?.document.uri;
    if (activeFile) {
        const activeFileFolderUri = vscode.Uri.file(path.dirname(activeFile.fsPath));
        return activeFileFolderUri;
    }

    return vscode.Uri.file(os.tmpdir());
}

export function getDateTimeString(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    const second = pad(date.getSeconds());
    return `${year}${month}${day}-${hour}${minute}${second}`;
}
