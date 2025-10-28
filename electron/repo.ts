import { app } from 'electron'
import { promises as fsp } from 'fs'
import path from 'node:path'
import { randomUUID } from 'crypto'
import type { RootState, Folder, TestCase } from '../src/core/domain'

function getBaseDir() {
    // dev: cwd, prod: рядом с exe
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

const REPO_DIR = 'tests_repo'

function slugify(name: string) {
    return name.toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'node'
}

function isTestFolder(dirPath: string, entries: string[]) {
    return entries.includes('test.json')
}

async function ensureDir(p: string) {
    await fsp.mkdir(p, { recursive: true })
}

export async function loadFromFs(): Promise<RootState> {
    const base = path.join(getBaseDir(), REPO_DIR)
    await ensureDir(base)

    // Если пусто — создаём корень
    const rootDir = path.join(base, 'root')
    await ensureDir(rootDir)

    async function readNode(dir: string): Promise<Folder | TestCase> {
        const entries = await fsp.readdir(dir)
        if (isTestFolder(dir, entries)) {
            const raw = await fsp.readFile(path.join(dir, 'test.json'), 'utf-8')
            return JSON.parse(raw) as TestCase
        }
        // Иначе — папка
        const folder: Folder = { id: randomUUID(), name: path.basename(dir), children: [] }
        for (const name of entries) {
            const childPath = path.join(dir, name)
            const stat = await fsp.lstat(childPath)
            if (stat.isDirectory()) {
                folder.children.push(await readNode(childPath))
            }
        }
        return folder
    }

    const root = await readNode(rootDir)
    return { root: (root as Folder), sharedSteps: [] }
}

export async function saveToFs(state: RootState) {
    const base = path.join(getBaseDir(), REPO_DIR)
    await ensureDir(base)
    const rootDir = path.join(base, 'root')
    await ensureDir(rootDir)

    // Проецируем дерево на ФС:
    async function writeFolder(fsDir: string, folder: Folder) {
        // Переименовать папку если имя поменялось
        // (упрощённо: создаём целевую, перенос не делаем — для dev ок)
        await ensureDir(fsDir)

        // Собираем набор желаемых детей
        const desired = new Map<string, { node: Folder | TestCase, targetPath: string }>()
        for (const child of folder.children) {
            if ('children' in child) {
                const target = path.join(fsDir, child.name)
                desired.set(target, { node: child, targetPath: target })
            } else {
                const slug = slugify(child.name)
                const idSuffix = child.id?.slice(0, 6) ?? randomUUID().slice(0, 6)
                const target = path.join(fsDir, `${slug}__${idSuffix}`)
                desired.set(target, { node: child, targetPath: target })
            }
        }

        // Создаём/обновляем
        for (const { node, targetPath } of desired.values()) {
            if ('children' in node) {
                await writeFolder(targetPath, node)
            } else {
                await ensureDir(targetPath)
                await ensureDir(path.join(targetPath, 'attachments'))
                await fsp.writeFile(path.join(targetPath, 'test.json'), JSON.stringify(node, null, 2), 'utf-8')
            }
        }

        // Удаляем лишние каталоги (которых нет в дереве)
        const current = await fsp.readdir(fsDir)
        for (const name of current) {
            const p = path.join(fsDir, name)
            if (!(await fsp.lstat(p)).isDirectory()) continue
            if (!desired.has(p)) {
                // рекурсивное удаление
                await fsp.rm(p, { recursive: true, force: true })
            }
        }
    }

    await writeFolder(rootDir, state.root)
}
