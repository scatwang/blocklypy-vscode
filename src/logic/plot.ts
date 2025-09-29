import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'vscode';
import Config from '../utils/config';
import { getActiveFileFolder } from '../utils/files';
import { DatalogView } from '../views/DatalogView';

export const BUFFER_FLUSH_TIMEOUT = 1000; // ms
const PLOT_MAX_ROWS = 100000;

type PlotDataEvent = number[];
// type PlotBarUpdateEvent = number[];

export class PlotManager {
    private _initialized = false;
    private _logFile: fs.WriteStream | null = null;
    private _startTime: number = 0;
    private _columns: string[] | undefined = undefined;
    private _buffer: number[] | undefined = undefined;
    private _bufferTimeout: NodeJS.Timeout | null = null;
    private _lastValues: number[] | undefined = undefined;
    private _data: number[][] | undefined = undefined;

    public readonly onPlotStarted = new EventEmitter<string[]>();
    public readonly onPlotData = new EventEmitter<PlotDataEvent>();

    public static createWithCb(onCreateCb?: (path: string) => void): PlotManager {
        const pm = new PlotManager();
        pm.onPlotStarted.event((columns: string[]) => {
            // write header to file
            if (!Config.plotAutosave) return;
            pm.openLogFile();
            if (pm._logFile) {
                pm._logFile.write(columns.join(',') + '\n');
                if (onCreateCb) onCreateCb(pm._logFile.path as string);
            }
        });
        pm.onPlotData.event((row) => {
            // write to file
            if (pm._logFile) {
                pm._logFile.write(
                    row
                        .map((v) =>
                            typeof v === 'number' && !isNaN(v) ? v.toString() : '',
                        )
                        .join(',') + '\n',
                );
            }
        });

        pm.onPlotStarted.event((columns: string[]) => {
            // send to webview
            DatalogView.Instance?.setHeaders(columns, undefined).catch(console.error);
        });
        pm.onPlotData.event((row) => {
            // send to webview
            DatalogView.Instance?.addData(row).catch(console.error);
        });

        return pm;
    }

    private get delta(): number {
        const now = Date.now();
        const seconds = ((now - this._startTime) / 1000).toFixed(3);
        return Number(seconds);
    }

    public get datalogcolumns(): string[] {
        return ['timestamp', ...(this._columns ?? [])];
    }

    public get data(): number[][] {
        return this._data ? this._data : [];
    }

    public get latest(): number[] | undefined {
        return this._lastValues;
    }

    private openLogFile() {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const year = now.getFullYear();
        const month = pad(now.getMonth() + 1);
        const day = pad(now.getDate());
        const hour = pad(now.getHours());
        const minute = pad(now.getMinutes());
        const second = pad(now.getSeconds());
        const filename = `datalog-${year}${month}${day}-${hour}${minute}${second}.csv`;
        const folder = getActiveFileFolder();
        if (!folder) {
            console.error('Cannot determine folder to save datalog file.');
            return;
        }
        const filePath = path.join(folder, filename);
        this._logFile = fs.createWriteStream(filePath, { flags: 'w', flush: true });
    }

    public async closeLogFile() {
        if (this._logFile) {
            await new Promise<void>((resolve, reject) => {
                this._logFile!.end(() => {
                    this._logFile = null;
                    resolve();
                });
                this._logFile!.on('error', reject);
            });
        }
        this._columns = undefined;
        this._buffer = undefined;
        this._lastValues = undefined;
        this._startTime = 0;
        if (this._bufferTimeout) {
            clearTimeout(this._bufferTimeout);
            this._bufferTimeout = null;
        }
    }

    public get bufferComplete(): boolean {
        if (!this._initialized || !this._columns?.length || !this._buffer?.length)
            return false;
        return (
            this._buffer.length === this._columns.length &&
            this._buffer.every((v) => typeof v === 'number' && !isNaN(v))
        );
    }

    private resetBuffer(resetLastValues: boolean = false) {
        if (!this._initialized || !this._columns?.length) return;
        this._buffer = new Array(this._columns.length).fill(NaN);

        if (resetLastValues) {
            this._lastValues = new Array(this._columns.length).fill(NaN);
        }
    }

    private flushBuffer() {
        if (
            !this._initialized ||
            !this._columns?.length ||
            !this._buffer?.length ||
            !this._lastValues?.length
        )
            return;

        const hasData = this._buffer.some((v) => typeof v === 'number' && !isNaN(v));
        if (!hasData) return;

        const lineToWrite = [this.delta, ...this._buffer];
        this._data?.push(lineToWrite);
        if (this._data && this._data.length > PLOT_MAX_ROWS) {
            this._data.shift(); // keep last entries
        }

        this.onPlotData.fire(lineToWrite);

        this.resetBuffer(false);
        this._bufferTimeout = null;
    }

    public async resetPlotParser() {
        await this.closeLogFile();
        this._columns = undefined;
        this._buffer = undefined;
        this._lastValues = undefined;
        this._data = [];
        this._startTime = 0;
        if (this._bufferTimeout) {
            clearTimeout(this._bufferTimeout);
            this._bufferTimeout = null;
        }
    }

    public clear(columnsToClear?: string[]) {
        if (!this._initialized || !this._columns?.length || !this._buffer?.length)
            return;

        let allColumnsToClear = false;
        if (!columnsToClear?.length) {
            // clear all
            allColumnsToClear = true;
        } else {
            // specific columns to clear
            // if any column does not exist, ignore the paty
            // check if all existing columns are mentioned
            const allExist = this._columns.every((col) =>
                columnsToClear?.includes(col),
            );

            if (allExist) {
                allColumnsToClear = true;
            } else {
                // clear specific columns both buffer and data
                columnsToClear.forEach((col) => {
                    const idx = this._columns?.indexOf(col);
                    if (idx !== undefined && idx >= 0 && idx < this._buffer!.length) {
                        this._buffer![idx] = NaN;
                        this._data =
                            this._data?.map((row) => {
                                row[idx + 1] = NaN; // +1 because of timestamp column
                                return row;
                            }) || [];
                    }
                });
                return;
            }
        }

        if (allColumnsToClear) {
            // clear all
            this._data = [];
            this.resetBuffer(true);
            return;
        }
    }

    public start(columns_: string[]) {
        this._startTime = Date.now();
        this._columns = columns_;
        this._data = [];

        this._initialized = true;
        this.resetBuffer(true);
        this.onPlotStarted.fire(this.datalogcolumns);
    }

    public addColumns(newColumns: string[]) {
        if (!this._initialized || !this._columns?.length || !this._buffer?.length)
            return;
        if (!newColumns.length) return;

        this._columns.push(...newColumns);

        // resize buffer and last values
        this._buffer.push(...new Array<number>(newColumns.length).fill(NaN));
        this._lastValues?.push(...new Array<number>(newColumns.length).fill(NaN));

        // resize data rows
        if (this._data) {
            this._data = this._data.map((row) => [
                ...row,
                ...new Array<number>(newColumns.length).fill(NaN),
            ]);
        }

        this.onPlotStarted.fire(this.datalogcolumns);
    }

    public async stop() {
        this.flushBuffer();
        await this.closeLogFile();
    }

    public flushPlotBuffer() {
        this.flushBuffer();
    }

    public get running(): boolean {
        return (
            this._initialized &&
            !!this._columns?.length &&
            !!this._buffer?.length &&
            !!this._lastValues?.length
        );
    }

    public get columns(): string[] {
        return this._columns || [];
    }

    public getBufferAt(index: number): number {
        if (!this._initialized || !this._columns?.length || !this._buffer?.length)
            return Number.NaN;
        if (index < 0 || index >= this._buffer.length) return Number.NaN;
        return this._buffer[index];
    }

    public setBufferAt(index: number, value: number) {
        if (
            !this._initialized ||
            !this._columns?.length ||
            !this._buffer?.length ||
            !this._lastValues?.length
        )
            return;

        if (index < 0 || index >= this._buffer.length) return;
        this._buffer[index] = value;
        this._lastValues[index] = value;
    }

    public handleIncomingData(values: number[]) {
        if (
            !this._initialized ||
            !this._columns?.length ||
            !this._buffer?.length ||
            !this._lastValues?.length
        )
            return;

        // check if any values are overlapping
        for (let i = 0; i < this.columns.length; i++) {
            if (!isNaN(values[i]) && !isNaN(this.getBufferAt(i))) {
                // overlapping value, flush buffers
                this.flushPlotBuffer();
                break;
            }
        }

        // merge values to buffer
        for (let i = 0; i < Math.min(values.length, this.columns.length); i++) {
            if (typeof values[i] === 'number' && !isNaN(values[i])) {
                this.setBufferAt(i, values[i]);
            }
        }

        // check if buffer is full
        this.processPostDataReceived();
    }

    public processPostDataReceived() {
        if (!this._initialized || !this._columns?.length || !this._buffer?.length)
            return false;
        if (this.bufferComplete) {
            this.flushPlotBuffer();
        } else if (this._bufferTimeout === null) {
            this._bufferTimeout = setTimeout(() => {
                this.flushBuffer();
            }, BUFFER_FLUSH_TIMEOUT);
        }
    }
}
