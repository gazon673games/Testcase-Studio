import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'
import fs from 'node:fs'
import path from 'node:path'

const projectRoot = fs.realpathSync.native(__dirname)
const rendererRoot = path.join(projectRoot, 'src')
const electronRoot = path.join(projectRoot, 'electron')
const distRoot = path.join(projectRoot, 'dist')
const distElectronRoot = path.join(projectRoot, 'dist-electron')

const aliases = {
    '@app': path.join(projectRoot, 'src/application'),
    '@core': path.join(projectRoot, 'src/core'),
    '@shared': path.join(projectRoot, 'src/shared'),
    '@providers': path.join(projectRoot, 'src/providers'),
    '@ipc': path.join(projectRoot, 'src/ipc'),
}

export default defineConfig({
    root: rendererRoot,
    server: { port: 5173, strictPort: true },
    plugins: [
        react(),
        electronRenderer(),
        electron([
            {
                entry: path.join(electronRoot, 'main.ts'),
                onstart({ startup }) {
                    startup(['.'])
                },
                vite: {
                    resolve: {
                        alias: aliases,
                    },
                    build: {
                        outDir: distElectronRoot,
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
        alias: aliases,
    },
    build: { outDir: distRoot, emptyOutDir: true },
})
