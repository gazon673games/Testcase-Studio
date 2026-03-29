import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    resolve: {
        alias: {
            '@app': path.resolve(__dirname, 'src/application'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@shared': path.resolve(__dirname, 'src/shared'),
            '@providers': path.resolve(__dirname, 'src/providers'),
            '@ipc': path.resolve(__dirname, 'src/ipc'),
        },
    },
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
})
