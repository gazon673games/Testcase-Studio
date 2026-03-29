// vite.config.electron.cjs
const { defineConfig } = require('vite')
const electron = require('vite-plugin-electron').default
const path = require('node:path')

module.exports = defineConfig({
    build: { outDir: 'dist-electron', emptyOutDir: true },
    resolve: {
        alias: {
            '@app': path.resolve(__dirname, 'src/application'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@shared': path.resolve(__dirname, 'src/shared'),
            '@providers': path.resolve(__dirname, 'src/providers'),
            '@ipc': path.resolve(__dirname, 'src/ipc'),
        },
    },
    plugins: [
        electron([
            {
                entry: 'electron/main.ts',
                // В dev-режиме плагин сам перезапускает Electron
                onstart({ startup }) { startup() },
                vite: {
                    build: {
                        sourcemap: true,
                        outDir: 'dist-electron',
                        target: 'node18',
                        rollupOptions: {
                            output: { entryFileNames: 'main.cjs', format: 'cjs' },
                            external: ['electron','fs','path','node:path','keytar','crypto','node:crypto'],
                        },
                    },
                },
            },
            {
                entry: 'electron/preload.ts',
                vite: {
                    build: {
                        sourcemap: true,
                        outDir: 'dist-electron',
                        target: 'node18',
                        rollupOptions: {
                            output: { entryFileNames: 'preload.cjs', format: 'cjs' },
                            external: ['electron'],
                        },
                    },
                },
            },
        ]),
    ],
})
