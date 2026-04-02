import { normalizeRootState, type RootState } from '../src/core/domain'
import { readRepoState } from './repo/repoRead'
import { syncFolderNode, writeSharedStepsFile } from './repo/repoWrite'
import { ensureDir, getRepoDir, joinInside, ROOT_DIR, type RepoIndex } from './repo/repoShared'
import { writePublishLogFile, writeStateSnapshotFile } from './repo/repoArtifacts'

let repoIndexCache: RepoIndex | null = null

async function ensureRepoIndex(baseDir: string, rootDir: string) {
    if (repoIndexCache && repoIndexCache.baseDir === baseDir && repoIndexCache.rootDir === rootDir) {
        return repoIndexCache
    }

    const { index } = await readRepoState(baseDir)
    repoIndexCache = index
    return index
}

export async function loadFromFs(): Promise<RootState> {
    const repoDir = getRepoDir()
    const { state, index } = await readRepoState(repoDir)
    repoIndexCache = index
    return state
}

export async function saveToFs(state: RootState) {
    const normalizedState = normalizeRootState(state)
    const repoDir = getRepoDir()
    const rootDir = joinInside(repoDir, ROOT_DIR)

    await ensureDir(rootDir)

    const repoIndex = await ensureRepoIndex(repoDir, rootDir)
    await syncFolderNode(repoIndex, normalizedState.root, null, null)
    await writeSharedStepsFile(repoIndex, normalizedState.sharedSteps)

    repoIndexCache = repoIndex
}

export async function writeStateSnapshot(
    state: RootState,
    kind = 'snapshot',
    meta?: Record<string, unknown>
): Promise<string> {
    return writeStateSnapshotFile(state, kind, meta)
}

export async function writePublishLog(payload: Record<string, unknown>): Promise<string> {
    return writePublishLogFile(payload)
}
