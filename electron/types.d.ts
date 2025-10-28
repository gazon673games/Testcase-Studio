export {}

declare global {
    interface Window {
        api: {
            invoke<T = unknown>(channel: string, payload?: unknown): Promise<T>
            on(channel: string, listener: (event: unknown, data: unknown) => void): void
            off(channel: string, listener: (...args: any[]) => void): void
        }
    }
}
