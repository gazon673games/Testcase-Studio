import { describe, expect, it } from 'vitest'
import {
    compareVersions,
    normalizeReleaseVersion,
    parseGitHubRepositoryFullName,
    pickReleaseAsset,
} from './appUpdates'

describe('app update helpers', () => {
    it('compares semantic versions with leading v', () => {
        expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
        expect(compareVersions('v1.2.0', '1.1.9')).toBe(1)
        expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0)
    })

    it('normalizes release tag versions', () => {
        expect(normalizeReleaseVersion('v1.2.3')).toBe('1.2.3')
        expect(normalizeReleaseVersion('1.2.3')).toBe('1.2.3')
    })

    it('parses github repository full name', () => {
        expect(parseGitHubRepositoryFullName('https://github.com/gazon673games/Testcase-Studio.git')).toBe(
            'gazon673games/Testcase-Studio'
        )
    })

    it('picks the most suitable asset for current platform', () => {
        const assets = [
            { name: 'Testcase Studio-1.0.0-portable-x64.exe', browser_download_url: 'portable' },
            { name: 'Testcase Studio-1.0.0-setup-x64.exe', browser_download_url: 'setup' },
            { name: 'Testcase Studio-1.0.0-windows-arm64.exe', browser_download_url: 'arm' },
        ]

        expect(pickReleaseAsset(assets, 'win32', 'x64')?.browser_download_url).toBe('setup')
        expect(pickReleaseAsset(assets, 'win32', 'arm64')?.browser_download_url).toBe('arm')
    })
})
