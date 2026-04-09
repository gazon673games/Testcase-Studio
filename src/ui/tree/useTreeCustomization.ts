import * as React from 'react'
import type { Folder, TestCase } from '@core/domain'
import { apiClient } from '@ipc/client'
import type { LocalTreeIconOption } from '@shared/treeIcons'
import { collectFolderAliases, collectFolderIconKeys, collectTestAliases, collectTestIconKeys } from './treeMetadata'

const TREE_ALIAS_VISIBILITY_KEY = 'workspace.treeShowAliases'

export function useTreeCustomization(root: Folder, tests: TestCase[]) {
    const [showAliases, setShowAliases] = React.useState(() => {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem(TREE_ALIAS_VISIBILITY_KEY) === 'true'
    })
    const [localTreeIcons, setLocalTreeIcons] = React.useState<LocalTreeIconOption[]>([])

    const iconByKey = React.useMemo(
        () => new Map(localTreeIcons.map((icon) => [icon.key, icon] as const)),
        [localTreeIcons]
    )
    const folderIconKeyById = React.useMemo(() => collectFolderIconKeys(root), [root])
    const folderAliasById = React.useMemo(() => collectFolderAliases(root), [root])
    const testIconKeyById = React.useMemo(() => collectTestIconKeys(tests), [tests])
    const testAliasById = React.useMemo(() => collectTestAliases(tests), [tests])
    const nodeIconKeyById = React.useMemo(() => {
        const next = new Map(folderIconKeyById)
        for (const [id, iconKey] of testIconKeyById) next.set(id, iconKey)
        return next
    }, [folderIconKeyById, testIconKeyById])
    const nodeIconById = React.useMemo(() => {
        const next = new Map<string, LocalTreeIconOption | null>()
        for (const [id, iconKey] of nodeIconKeyById) {
            next.set(id, iconKey ? (iconByKey.get(iconKey) ?? null) : null)
        }
        return next
    }, [iconByKey, nodeIconKeyById])

    const reloadLocalTreeIcons = React.useCallback(async () => {
        try {
            setLocalTreeIcons(await apiClient.listLocalTreeIcons())
        } catch {
            setLocalTreeIcons([])
        }
    }, [])

    const importLocalTreeIcon = React.useCallback(async () => {
        const imported = await apiClient.importLocalTreeIcon()
        await reloadLocalTreeIcons()
        return imported
    }, [reloadLocalTreeIcons])

    const deleteLocalTreeIcon = React.useCallback(async (iconKey: string) => {
        const deleted = await apiClient.deleteLocalTreeIcon(iconKey)
        await reloadLocalTreeIcons()
        return deleted
    }, [reloadLocalTreeIcons])

    React.useEffect(() => {
        void reloadLocalTreeIcons()
    }, [reloadLocalTreeIcons])

    React.useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(TREE_ALIAS_VISIBILITY_KEY, String(showAliases))
    }, [showAliases])

    return {
        showAliases,
        setShowAliases,
        localTreeIcons,
        folderAliasById,
        testAliasById,
        nodeIconKeyById,
        nodeIconById,
        importLocalTreeIcon,
        deleteLocalTreeIcon,
        reloadLocalTreeIcons,
    }
}
