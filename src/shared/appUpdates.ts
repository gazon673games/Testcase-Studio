export type AppInfo = {
    version: string
    platform: string
    arch: string
    isPackaged: boolean
}

export type ReleaseAssetInfo = {
    name: string
    browser_download_url: string
}

export type AppUpdateCheckResult = AppInfo & {
    latestVersion: string | null
    latestTag: string | null
    releaseName: string | null
    releaseUrl: string | null
    downloadName: string | null
    downloadUrl: string | null
    publishedAt: string | null
    releaseNotes: string | null
    updateAvailable: boolean
}

function parseVersionParts(input: string) {
    const normalized = String(input ?? '').trim().replace(/^[^\d]*/, '')
    const core = normalized.split('-')[0]?.split('+')[0] ?? ''
    if (!core) return []
    return core
        .split('.')
        .map((part) => Number.parseInt(part, 10))
        .map((part) => (Number.isFinite(part) ? part : 0))
}

export function compareVersions(left: string, right: string) {
    const a = parseVersionParts(left)
    const b = parseVersionParts(right)
    const length = Math.max(a.length, b.length)
    for (let index = 0; index < length; index += 1) {
        const leftPart = a[index] ?? 0
        const rightPart = b[index] ?? 0
        if (leftPart < rightPart) return -1
        if (leftPart > rightPart) return 1
    }
    return 0
}

export function normalizeReleaseVersion(input: string | null | undefined) {
    const value = String(input ?? '').trim()
    if (!value) return ''
    return value.replace(/^v/i, '')
}

export function parseGitHubRepositoryFullName(repositoryUrl: string | null | undefined) {
    const value = String(repositoryUrl ?? '').trim()
    if (!value) return null
    const normalized = value.replace(/\.git$/i, '')
    const match = normalized.match(/github\.com[/:]([^/]+)\/([^/]+)$/i)
    if (!match) return null
    return `${match[1]}/${match[2]}`
}

export function pickReleaseAsset(
    assets: ReleaseAssetInfo[],
    platform: string,
    arch: string
) {
    const names = assets.map((asset) => asset.name.toLowerCase())
    const indexOfFirst = (patterns: string[]) => {
        for (const pattern of patterns) {
            const index = names.findIndex((name) => name.includes(pattern))
            if (index >= 0) return index
        }
        return -1
    }

    const wanted = (() => {
        if (platform === 'win32') {
            return arch === 'arm64'
                ? ['setup-arm64.exe', 'portable-arm64.exe', 'windows-arm64.exe']
                : ['setup-x64.exe', 'portable-x64.exe', 'windows-x64.exe']
        }
        if (platform === 'darwin') {
            return arch === 'arm64'
                ? ['mac-arm64.dmg', 'mac-arm64.zip']
                : ['mac-x64.dmg', 'mac-x64.zip']
        }
        if (platform === 'linux') {
            return arch === 'arm64'
                ? ['linux-arm64.appimage', 'linux-arm64.tar.gz']
                : ['linux-x86_64.appimage', 'linux-x64.appimage', 'linux-x64.tar.gz']
        }
        return []
    })()

    const bestIndex = indexOfFirst(wanted)
    if (bestIndex >= 0) return assets[bestIndex]
    return assets[0] ?? null
}
