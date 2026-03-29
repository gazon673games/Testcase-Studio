// vite.renderer.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import path from 'node:path'

export default defineConfig({
    root: 'src',
    server: { port: 5173, strictPort: true },
    plugins: [
        react(),
        electronRenderer(),
        electron([
            {
                // MAIN → ESM
                entry: '../electron/main.ts',
                onstart({ startup }) {
                    // обязательна '.' первым аргументом!
                    startup([
                        '.',
                        '--inspect=9229',
                        '--remote-debugging-port=9223',
                        '--no-sandbox'
                    ])
                },
                vite: {
                    build: {
                        outDir: '../dist-electron',
                        target: 'node18',
                        sourcemap: true,
                        rollupOptions: {
                            output: { entryFileNames: 'main.mjs', format: 'es' },
                            external: ['electron', 'node:fs', 'node:path', 'fs', 'path', 'keytar', 'crypto', 'node:crypto'],
                        },
                    },
                },
            },
            {
                // PRELOAD → ESM (чтобы не было конфликта типов)
                entry: '../electron/preload.ts',
                vite: {
                    build: {
                        outDir: '../dist-electron',
                        target: 'node18',
                        sourcemap: true,
                        rollupOptions: {
                            output: { entryFileNames: 'preload.mjs', format: 'es' },
                            external: ['electron'],
                        },
                    },
                },
            },
        ]),
    ],
    resolve: {
        alias: {
            '@app': path.resolve(__dirname, 'src/application'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@shared': path.resolve(__dirname, 'src/shared'),
            '@providers': path.resolve(__dirname, 'src/providers'),
            '@ipc': path.resolve(__dirname, 'src/ipc'),
        },
    },
    build: { outDir: '../dist', emptyOutDir: true },
})
