import * as React from 'react'
import type { Folder, SharedStep } from '@core/domain'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { mapTests } from '@core/tree'
import { useUiPreferences } from './preferences'
import './Tree.css'
import { TreeMenu } from './tree/TreeMenu'
import { TreeNodeView } from './tree/TreeNodeView'
import type { ContextMenuState, EditingState, VisibleItem } from './tree/types'
import { flattenVisibleItems, makeNodeKey, toPreviewishPlainText } from './tree/utils'

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
    onOpenStep: (testId: string, stepId: string) => void
}

export function Tree(props: Props) {
    const { t } = useUiPreferences()
    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set([props.root.id]))
    const [menu, setMenu] = React.useState<ContextMenuState>(null)
    const [editing, setEditing] = React.useState<EditingState>(null)
    const rowRefs = React.useRef<Record<string, HTMLElement | null>>({})
    const selectedKey = makeNodeKey(props.selectedId ?? props.root.id)
    const [focusedKey, setFocusedKey] = React.useState(selectedKey)
    const refCatalog = React.useMemo(() => buildRefCatalog(mapTests(props.root), props.sharedSteps), [props.root, props.sharedSteps])
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

    const visibleItems = React.useMemo(
        () => flattenVisibleItems(props.root, expanded, t, resolveDisplayText),
        [props.root, expanded, resolveDisplayText, t]
    )
    const visibleKeys = React.useMemo(() => visibleItems.map((item) => item.key), [visibleItems])

    React.useEffect(() => {
        setFocusedKey(selectedKey)
    }, [selectedKey])

    React.useEffect(() => {
        if (!visibleKeys.length) return
        if (visibleKeys.includes(focusedKey)) return
        setFocusedKey(visibleKeys.includes(selectedKey) ? selectedKey : visibleKeys[0])
    }, [focusedKey, selectedKey, visibleKeys])

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
            setMenu({ x, y, targetId: id, targetIsFolder, targetName })
        },
        [props]
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
            const currentIndex = visibleItems.findIndex((entry) => entry.key === item.key)
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

            if (event.key === 'F2' && item.kind !== 'step' && item.id !== props.root.id) {
                event.preventDefault()
                setEditing({ id: item.id, value: item.name })
            }
        },
        [openMenuAt, props, toggleExpanded, visibleItems]
    )

    return (
        <div className="tree-shell">
            <div className="tree-header">
                <div className="tree-header__eyebrow">{t('tree.navigator')}</div>
                <div className="tree-header__title">{t('tree.cases')}</div>
                <div className="tree-header__hint">{t('tree.keyboardHint')}</div>
            </div>

            <div role="tree" aria-label={t('tree.navigator')}>
                <TreeNodeView
                    node={props.root}
                    dirtyTestIds={props.dirtyTestIds}
                    depth={0}
                    selectedId={props.selectedId}
                    focusedKey={focusedKey}
                    onFocusItem={setFocusedKey}
                    onTreeKeyDown={onTreeKeyDown}
                    registerRowRef={(key, element) => {
                        rowRefs.current[key] = element
                    }}
                    onSelect={props.onSelect}
                    onMove={props.onMove}
                    onCreateFolderAt={props.onCreateFolderAt}
                    onCreateTestAt={props.onCreateTestAt}
                    onRename={props.onRename}
                    onDelete={props.onDelete}
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
                    resolveDisplayText={resolveDisplayText}
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
                />
            )}
        </div>
    )
}
