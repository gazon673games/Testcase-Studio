export {}

declare global {
    type ElectronApiListener = (event: unknown, data: unknown) => void

    interface Window {
        api: {
            invoke<T = unknown>(channel: string, payload?: unknown): Promise<T>
            on(channel: string, listener: ElectronApiListener): () => void
            off(channel: string, listener: ElectronApiListener): void
        }
    }
}
