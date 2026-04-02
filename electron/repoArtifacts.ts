import { promises as fsp } from 'fs'
import { normalizeRootState, type RootState } from '../src/core/domain'
import { PUBLISH_LOGS_DIR, SNAPSHOTS_DIR, ensureDir, getRepoDir, joinInside, safeSnapshotKind } from './repoShared'

function createTimestampLabel() {
    const now = new Date()
    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
    ].join('')
    const time = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('-')

    return `${date}-${time}`
}

export async function writeStateSnapshotFile(
    state: RootState,
    kind = 'snapshot',
    meta?: Record<string, unknown>
): Promise<string> {
    const normalizedState = normalizeRootState(state)
    const snapshotsDir = joinInside(getRepoDir(), SNAPSHOTS_DIR)
    await ensureDir(snapshotsDir)

    const snapshotPath = joinInside(
        snapshotsDir,
        `${safeSnapshotKind(kind)}-${createTimestampLabel()}.json`
    )

    await fsp.writeFile(
        snapshotPath,
        JSON.stringify(
            {
                createdAt: new Date().toISOString(),
                kind,
                meta: meta ?? {},
                state: normalizedState,
            },
            null,
            2
        ),
        'utf-8'
    )

    return snapshotPath
}

export async function writePublishLogFile(payload: Record<string, unknown>): Promise<string> {
    const publishLogsDir = joinInside(getRepoDir(), PUBLISH_LOGS_DIR)
    await ensureDir(publishLogsDir)

    const logPath = joinInside(publishLogsDir, `publish-${createTimestampLabel()}.json`)
    await fsp.writeFile(logPath, JSON.stringify(payload, null, 2), 'utf-8')

    return logPath
}
