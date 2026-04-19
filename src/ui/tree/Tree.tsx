import * as React from 'react'
import type { Folder, SharedStep } from '@core/domain'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { isFolder, mapTests } from '@core/tree'
import { useUiPreferences } from '../preferences'
import type { ViewNode } from './types'

function buildFolderTestCounts(node: ViewNode): Map<string, number> {
    const map = new Map<string, number>()
    function visit(n: ViewNode): number {
        if (!isFolder(n)) return 1
        let total = 0
        for (const child of n.children) total += visit(child)
        map.set(n.id, total)
        return total
    }
    visit(node)
    return map
}
import './Tree.css'
import { TreeAliasModal } from './TreeAliasModal'
import { TreeIconPickerModal } from './TreeIconPickerModal'
import { TreeMenu } from './TreeMenu'
import { TreeNodeView } from './TreeNodeView'
import type { ContextMenuState, EditingState, VisibleItem } from './types'
import { collectAncestorFolderIds } from './treeMetadata'
import { useTreeCustomization } from './useTreeCustomization'
import { buildTreeViewState, makeNodeKey, toPreviewishPlainText } from './utils'

type Props = {
    root: Folder
    sharedSteps: SharedStep[]
    dirtyTestIds: Set<string>
    selectedId: string | null
    onSelect: (id: string) => void
    onMove: (nodeId: string, targetFolderId: string) => Promise<boolean> | boolean
    onCreateFolderAt: (parentId: string) => void
    onCreateTestAt: (parentId: string) => void
    onRename: (id: string, newName: string) => void
    onDelete: (id: string) => void
    onSetNodeAlias: (nodeId: string, alias: string | null) => void
    onSetNodeIcon: (nodeId: string, iconKey: string | null) => void
    onOpenStep: (testId: string, stepId: string) => void
}

export function Tree(props: Props) {
    const { t } = useUiPreferences()
    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set([props.root.id]))
    const [menu, setMenu] = React.useState<ContextMenuState>(null)
    const [editing, setEditing] = React.useState<EditingState>(null)
    const [aliasEditorTarget, setAliasEditorTarget] = React.useState<{
        id: string
        name: string
        kind: 'folder' | 'test'
        alias: string
    } | null>(null)
    const [iconPickerTarget, setIconPickerTarget] = React.useState<{
        id: string
        name: string
        kind: 'folder' | 'test'
        selectedKey: string | null
    } | null>(null)
    const rowRefs = React.useRef<Record<string, HTMLElement | null>>({})
    const registerRowRef = React.useCallback((key: string, element: HTMLElement | null) => {
        rowRefs.current[key] = element
    }, [])
    const selectedKey = makeNodeKey(props.selectedId ?? props.root.id)
    const [focusedKey, setFocusedKey] = React.useState(selectedKey)
    const allTests = React.useMemo(() => mapTests(props.root), [props.root])
    const folderTestCounts = React.useMemo(() => buildFolderTestCounts(props.root), [props.root])
    const {
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
    } = useTreeCustomization(props.root, allTests)
    const refCatalog = React.useMemo(() => buildRefCatalog(allTests, props.sharedSteps), [allTests, props.sharedSteps])
    const resolveDisplayText = React.useCallback(
        (value: string | undefined) => toPreviewishPlainText(renderRefsInText(String(value ?? ''), refCatalog, { mode: 'plain' })),
        [refCatalog]
    )

    React.useEffect(() => {
        setExpanded((current) => {
            if (current.has(props.root.id)) return current
            const next = new Set(current)
            next.add(props.root.id)
            return next
        })
    }, [props.root.id])

    const treeViewState = React.useMemo(
        () => buildTreeViewState(props.root, expanded, props.dirtyTestIds, t, resolveDisplayText),
        [expanded, props.dirtyTestIds, props.root, resolveDisplayText, t]
    )
    const { visibleItems, visibleIndexByKey, syncStatusById, testHeadlineById, stepLabelByKey } = treeViewState

    React.useEffect(() => {
        setFocusedKey(selectedKey)
    }, [selectedKey])

    React.useEffect(() => {
        const targetId = props.selectedId
        if (!targetId) return
        const ancestors = collectAncestorFolderIds(props.root, targetId)
        if (!ancestors.length) return
        setExpanded((current) => {
            const next = new Set(current)
            let changed = false
            for (const id of ancestors) {
                if (next.has(id)) continue
                next.add(id)
                changed = true
            }
            return changed ? next : current
        })
    }, [props.root, props.selectedId])

    React.useEffect(() => {
        if (!visibleItems.length) return
        if (visibleIndexByKey.has(focusedKey)) return
        setFocusedKey(visibleIndexByKey.has(selectedKey) ? selectedKey : visibleItems[0].key)
    }, [focusedKey, selectedKey, visibleIndexByKey, visibleItems])

    React.useEffect(() => {
        if (editing) return
        rowRefs.current[focusedKey]?.focus()
    }, [editing, focusedKey])

    const toggleExpanded = React.useCallback((id: string) => {
        setExpanded((current) => {
            const next = new Set(current)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    const openMenuAt = React.useCallback(
        (x: number, y: number, id: string, targetIsFolder: boolean, targetName: string) => {
            props.onSelect(id)
            setFocusedKey(makeNodeKey(id))
            setMenu({
                x,
                y,
                targetId: id,
                targetIsFolder,
                targetName,
                targetAlias: targetIsFolder ? (folderAliasById.get(id) ?? null) : (testAliasById.get(id) ?? null),
                targetIconKey: nodeIconKeyById.get(id) ?? null,
            })
        },
        [folderAliasById, nodeIconKeyById, props, testAliasById]
    )

    const openMenu = React.useCallback(
        (event: React.MouseEvent, id: string, targetIsFolder: boolean, targetName: string) => {
            event.preventDefault()
            event.stopPropagation()
            openMenuAt(event.clientX, event.clientY, id, targetIsFolder, targetName)
        },
        [openMenuAt]
    )

    const openMenuFromButton = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>, id: string, targetIsFolder: boolean, targetName: string) => {
            event.preventDefault()
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            openMenuAt(rect.left, rect.bottom + 6, id, targetIsFolder, targetName)
        },
        [openMenuAt]
    )

    const closeMenu = React.useCallback(() => setMenu(null), [])
    const requestAliasEdit = React.useCallback((targetId: string, targetName: string, currentAlias?: string | null) => {
        closeMenu()
        setAliasEditorTarget({
            id: targetId,
            name: targetName,
            kind: folderAliasById.has(targetId) ? 'folder' : 'test',
            alias: currentAlias ?? '',
        })
    }, [closeMenu, folderAliasById])

    React.useEffect(() => {
        if (!menu) return
        const onMouseDown = (event: MouseEvent) => {
            const element = document.getElementById('tree-context-menu')
            if (element && element.contains(event.target as globalThis.Node)) return
            closeMenu()
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMenu()
        }
        document.addEventListener('mousedown', onMouseDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onMouseDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [menu, closeMenu])

    const commitRename = React.useCallback(() => {
        if (editing && editing.value.trim()) props.onRename(editing.id, editing.value.trim())
        setEditing(null)
    }, [editing, props])

    const cancelRename = React.useCallback(() => setEditing(null), [])

    const onTreeKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLElement>, item: VisibleItem) => {
            const currentIndex = visibleIndexByKey.get(item.key) ?? -1
            if (currentIndex === -1) return

            const moveFocusTo = (index: number) => {
                const next = visibleItems[index]
                if (next) setFocusedKey(next.key)
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault()
                moveFocusTo(Math.min(currentIndex + 1, visibleItems.length - 1))
                return
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault()
                moveFocusTo(Math.max(currentIndex - 1, 0))
                return
            }

            if (event.key === 'Home') {
                event.preventDefault()
                moveFocusTo(0)
                return
            }

            if (event.key === 'End') {
                event.preventDefault()
                moveFocusTo(visibleItems.length - 1)
                return
            }

            if (event.key === 'ArrowRight') {
                if (item.kind === 'step' || !item.hasChildren) return
                event.preventDefault()
                if (!item.expanded) {
                    toggleExpanded(item.id)
                    return
                }
                const next = visibleItems[currentIndex + 1]
                if (next?.parentKey === item.key) setFocusedKey(next.key)
                return
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault()
                if (item.kind !== 'step' && item.hasChildren && item.expanded) {
                    toggleExpanded(item.id)
                    return
                }
                if (item.parentKey) setFocusedKey(item.parentKey)
                return
            }

            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                if (item.kind === 'step') props.onOpenStep(item.testId, item.id)
                else props.onSelect(item.id)
                return
            }

            if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
                if (item.kind === 'step') return
                event.preventDefault()
                const rect = rowRefs.current[item.key]?.getBoundingClientRect()
                if (!rect) return
                openMenuAt(rect.left + 20, rect.bottom + 6, item.id, item.kind === 'folder', item.name)
                return
            }

            if (event.key === 'F2' && item.kind !== 'step') {
                event.preventDefault()
                setEditing({ id: item.id, value: item.name })
            }
        },
        [openMenuAt, props, toggleExpanded, visibleIndexByKey, visibleItems]
    )

    return (
        <div className="tree-shell">
            <div className="tree-header">
                <div className="tree-header__eyebrow">{t('tree.navigator')}</div>
                <div className="tree-header__title">{t('tree.cases')}</div>
                <div className="tree-header__hint">{t('tree.keyboardHint')}</div>
                <label className="tree-header__toggle">
                    <input
                        type="checkbox"
                        checked={showAliases}
                        onChange={(event) => setShowAliases(event.target.checked)}
                    />
                    <span>{t('tree.showAliases')}</span>
                </label>
            </div>

            <div role="tree" aria-label={t('tree.navigator')}>
                <TreeNodeView
                    node={props.root}
                    depth={0}
                    selectedId={props.selectedId}
                    focusedKey={focusedKey}
                    onFocusItem={setFocusedKey}
                    onTreeKeyDown={onTreeKeyDown}
                    registerRowRef={registerRowRef}
                    onSelect={props.onSelect}
                    onMove={props.onMove}
                    onCreateFolderAt={props.onCreateFolderAt}
                    onCreateTestAt={props.onCreateTestAt}
                    onRename={props.onRename}
                    onDelete={props.onDelete}
                    aliasMode={showAliases}
                    expanded={expanded}
                    onToggleExpanded={toggleExpanded}
                    onContextOpen={openMenu}
                    onMenuButtonOpen={openMenuFromButton}
                    editing={editing}
                    setEditing={setEditing}
                    commitRename={commitRename}
                    cancelRename={cancelRename}
                    onOpenStep={props.onOpenStep}
                    t={t}
                    syncStatusById={syncStatusById}
                    testHeadlineById={testHeadlineById}
                    stepLabelByKey={stepLabelByKey}
                    nodeIconById={nodeIconById}
                    folderTestCounts={folderTestCounts}
                />
            </div>

            {menu && (
                <TreeMenu
                    x={menu.x}
                    y={menu.y}
                    isRoot={menu.targetId === props.root.id}
                    isFolder={menu.targetIsFolder}
                    t={t}
                    onClose={closeMenu}
                    onNewFolder={() => props.onCreateFolderAt(menu.targetId)}
                    onNewTest={() => props.onCreateTestAt(menu.targetId)}
                    onRename={() => {
                        setEditing({ id: menu.targetId, value: menu.targetName })
                        closeMenu()
                    }}
                    onDelete={() => props.onDelete(menu.targetId)}
                    hasAlias={Boolean(menu.targetAlias)}
                    onSetAlias={() => requestAliasEdit(menu.targetId, menu.targetName, menu.targetAlias)}
                    onClearAlias={() => props.onSetNodeAlias(menu.targetId, null)}
                    canChangeIcon
                    hasCustomIcon={Boolean(menu.targetIconKey)}
                    onChangeIcon={() => {
                        void reloadLocalTreeIcons()
                        setIconPickerTarget({
                            id: menu.targetId,
                            name: menu.targetName,
                            kind: menu.targetIsFolder ? 'folder' : 'test',
                            selectedKey: menu.targetIconKey ?? null,
                        })
                    }}
                    onClearIcon={() => props.onSetNodeIcon(menu.targetId, null)}
                />
            )}
            <TreeIconPickerModal
                open={!!iconPickerTarget}
                itemName={iconPickerTarget?.name ?? ''}
                itemKind={iconPickerTarget?.kind ?? 'test'}
                icons={localTreeIcons}
                selectedKey={iconPickerTarget?.selectedKey ?? null}
                t={t}
                onClose={() => setIconPickerTarget(null)}
                onImport={importLocalTreeIcon}
                onDelete={deleteLocalTreeIcon}
                onApply={(iconKey) => {
                    if (iconPickerTarget) props.onSetNodeIcon(iconPickerTarget.id, iconKey)
                    setIconPickerTarget(null)
                }}
            />
            <TreeAliasModal
                open={!!aliasEditorTarget}
                itemName={aliasEditorTarget?.name ?? ''}
                itemKind={aliasEditorTarget?.kind ?? 'test'}
                alias={aliasEditorTarget?.alias ?? ''}
                t={t}
                onClose={() => setAliasEditorTarget(null)}
                onApply={(alias) => {
                    if (aliasEditorTarget) void props.onSetNodeAlias(aliasEditorTarget.id, alias)
                    setAliasEditorTarget(null)
                }}
            />
        </div>
    )
}
