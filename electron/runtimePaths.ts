import { app } from 'electron'
import path from 'node:path'

export function getAppDataRoot() {
    if (!app.isPackaged) return process.cwd()

    const portableDir = String(process.env.PORTABLE_EXECUTABLE_DIR ?? '').trim()
    if (portableDir) return portableDir

    return app.getPath('userData')
}

export function getWorkspaceDir() {
    return path.resolve(path.join(getAppDataRoot(), 'tests_repo'))
}
