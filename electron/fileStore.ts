import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'node:path'

export class FileStore<T extends object> {
    private filePath: string
    constructor(filename: string, private defaults: T) {
        const dir = join(app.getPath('userData'), 'storage')
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        this.filePath = join(dir, filename)
    }
    read(): T {
        try {
            const raw = readFileSync(this.filePath, 'utf-8')
            return JSON.parse(raw)
        } catch {
            this.write(this.defaults)
            return this.defaults
        }
    }
    write(data: T) {
        writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    }
}
