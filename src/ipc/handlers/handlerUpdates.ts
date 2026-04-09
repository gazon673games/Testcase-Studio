import { app } from 'electron'
import packageJson from '../../../package.json'
import type { AppInfo, AppUpdateCheckResult, ReleaseAssetInfo } from '@shared/appUpdates'
import {
    compareVersions,
    normalizeReleaseVersion,
    parseGitHubRepositoryFullName,
    pickReleaseAsset,
} from '@shared/appUpdates'
import { fetchWithContext, readJsonResponse } from './handlerNetwork'

type GitHubReleaseResponse = {
    tag_name?: string
    name?: string
    html_url?: string
    body?: string
    published_at?: string
    assets?: Array<ReleaseAssetInfo>
}

function getRepositoryUrl() {
    const repository = packageJson.repository
    if (!repository) return null
    if (typeof repository === 'string') return repository
    return repository.url ?? null
}

export function getAppInfoInMain(): AppInfo {
    return {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged,
    }
}

export async function checkForUpdatesInMain(): Promise<AppUpdateCheckResult> {
    const appInfo = getAppInfoInMain()
    const repo = parseGitHubRepositoryFullName(getRepositoryUrl())
    if (!repo) throw new Error('GitHub repository is not configured for update checks')

    // We intentionally use a lightweight GitHub Releases check instead of electron-updater for now.
    // If we later need in-app download/install or differential updates, revisit electron-updater
    // together with latest*.yml and blockmap publishing.

    const response = await fetchWithContext(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': `Testcase-Studio/${appInfo.version}`,
            },
        },
        'GitHub update check'
    )

    const release = await readJsonResponse<GitHubReleaseResponse>(response, 'GitHub update check')
    const latestTag = String(release.tag_name ?? '').trim() || null
    const latestVersion = normalizeReleaseVersion(latestTag || release.name || '')
    const asset = pickReleaseAsset(release.assets ?? [], appInfo.platform, appInfo.arch)
    const releaseUrl = String(release.html_url ?? '').trim() || null

    return {
        ...appInfo,
        latestVersion: latestVersion || null,
        latestTag,
        releaseName: String(release.name ?? '').trim() || null,
        releaseUrl,
        downloadName: asset?.name ?? null,
        downloadUrl: asset?.browser_download_url ?? releaseUrl,
        publishedAt: String(release.published_at ?? '').trim() || null,
        releaseNotes: String(release.body ?? '').trim() || null,
        updateAvailable: latestVersion ? compareVersions(appInfo.version, latestVersion) < 0 : false,
    }
}
