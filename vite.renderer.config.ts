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
                entry: '../electron/main.ts',
                onstart({ startup }) {
                    startup(['.'])
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
