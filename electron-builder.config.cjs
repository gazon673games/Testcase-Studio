const fs = require('node:fs')
const path = require('node:path')

const projectRoot = fs.realpathSync.native(process.cwd())
const localIconDir = path.join(projectRoot, '.local-assets', 'icons')

function optionalIcon(name) {
    const fullPath = path.join(localIconDir, name)
    return fs.existsSync(fullPath) ? fullPath : undefined
}

const winIcon = optionalIcon('app.ico')
const macIcon = optionalIcon('app.icns')
const linuxIcon = optionalIcon('app.png')

/** @type {import('electron-builder').Configuration} */
const config = {
    appId: 'com.gazon673games.testcase-studio',
    productName: 'Testcase Studio',
    directories: {
        output: 'release',
    },
    files: [
        'dist/**',
        'dist-electron/**',
        'electron/preload.cjs',
        'package.json',
    ],
    extraMetadata: {
        main: 'dist-electron/main.mjs',
    },
    asar: true,
    npmRebuild: false,
    compression: 'normal',
    publish: [
        { provider: 'github' },
    ],
    win: {
        artifactName: '${productName}-${version}-windows-${arch}.${ext}',
        signAndEditExecutable: false,
        target: [
            { target: 'nsis', arch: ['x64', 'arm64'] },
            { target: 'portable', arch: ['x64', 'arm64'] },
        ],
        ...(winIcon ? { icon: winIcon } : {}),
    },
    nsis: {
        artifactName: '${productName}-${version}-setup-${arch}.${ext}',
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        perMachine: false,
    },
    portable: {
        artifactName: '${productName}-${version}-portable-${arch}.${ext}',
    },
    mac: {
        artifactName: '${productName}-${version}-mac-${arch}.${ext}',
        category: 'public.app-category.developer-tools',
        target: [
            { target: 'dmg', arch: ['x64', 'arm64'] },
            { target: 'zip', arch: ['x64', 'arm64'] },
        ],
        ...(macIcon ? { icon: macIcon } : {}),
    },
    linux: {
        artifactName: '${productName}-${version}-linux-${arch}.${ext}',
        category: 'Development',
        target: [
            { target: 'AppImage', arch: ['x64', 'arm64'] },
            { target: 'tar.gz', arch: ['x64', 'arm64'] },
        ],
        ...(linuxIcon ? { icon: linuxIcon } : {}),
    },
}

module.exports = config
