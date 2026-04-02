import fs from 'node:fs'
import path from 'node:path'
import { aliasZones, extensions } from './config.mjs'

export function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/')
}

export function classifyFileZone(root, filePath) {
    const rel = normalizePath(path.relative(root, filePath))
    if (rel.startsWith('src/core/')) return 'core'
    if (rel === 'src/core/refs.ts') return 'core'
    if (rel.startsWith('src/application/')) return 'application'
    if (rel.startsWith('src/ui/')) return 'ui'
    if (rel.startsWith('src/providers/')) return 'providers'
    if (rel.startsWith('src/ipc/')) return 'ipc'
    if (rel.startsWith('src/shared/')) return 'shared'
    if (rel.startsWith('electron/')) return 'electron'
    return 'entry'
}

export function listSourceFiles(root, directory) {
    const files = []
    if (!fs.existsSync(directory)) return files

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name)
        const rel = normalizePath(path.relative(root, fullPath))

        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name.startsWith('dist')) continue
            files.push(...listSourceFiles(root, fullPath))
            continue
        }

        const ext = path.extname(entry.name)
        if (!extensions.has(ext)) continue
        if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
        if (/\.d\.ts$/.test(entry.name)) continue
        if (rel.includes('/dist/') || rel.includes('/node_modules/')) continue

        files.push(fullPath)
    }

    return files
}

export function tryResolveRelative(fromFile, specifier) {
    const base = path.resolve(path.dirname(fromFile), specifier)
    const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        path.join(base, 'index.ts'),
        path.join(base, 'index.tsx'),
    ]

    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    }

    return null
}

export function classifyImportZone(root, fromFile, specifier) {
    if (!specifier) return 'external'

    for (const [prefix, zone] of aliasZones) {
        if (specifier.startsWith(prefix)) return zone
    }

    if (specifier.startsWith('.')) {
        const resolved = tryResolveRelative(fromFile, specifier)
        return resolved ? classifyFileZone(root, resolved) : 'unknown'
    }

    return 'external'
}
