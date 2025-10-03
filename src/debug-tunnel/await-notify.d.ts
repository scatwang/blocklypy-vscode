declare module 'await-notify' {
    export class Subject {
        constructor();
        wait(timeout?: number): Promise<void>;
        notify(): void;
    }
}
