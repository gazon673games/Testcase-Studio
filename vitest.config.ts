import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@core': path.resolve(__dirname, 'src/core'),
            '@providers': path.resolve(__dirname, 'src/providers'),
            '@ipc': path.resolve(__dirname, 'src/ipc'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
})
