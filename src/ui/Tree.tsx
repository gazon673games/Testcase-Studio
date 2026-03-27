import * as React from 'react'
import type { Folder, SharedStep, Step, TestCase } from '@core/domain'
import { buildRefCatalog, renderRefsInText } from '@core/refs'
import { isFolder, mapTests } from '@core/tree'
import { translate, useUiPreferences } from './preferences'

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

type ViewNode = Folder | TestCase
type ContextMenuState =
    | { x: number; y: number; targetId: string; targetIsFolder: boolean; targetName: string }
    | null
type EditingState = { id: string; value: string } | null
type VisibleItem =
    | {
          key: string
          kind: 'folder' | 'test'
          id: string
          parentKey?: string
          depth: number
          hasChildren: boolean
          expanded: boolean
          name: string
      }
    | {
          key: string
          kind: 'step'
          id: string
          testId: string
          parentKey: string
          depth: number
          hasChildren: false
          expanded: false
          name: string
      }

type SyncStatus = 'dirty' | 'synced' | 'conflict'

const IMPORT_IMPORTED_AT_KEY = '__zephyrImport.importedAt'
const IMPORT_REMOTE_KEY_KEY = '__zephyrImport.remoteKey'
const IMPORT_CONFLICT_REMOTE_KEY = '__zephyrImport.conflictRemoteKey'
const PUBLISH_AT_KEY = '__zephyrPublish.publishedAt'
const PUBLISH_REMOTE_KEY = '__zephyrPublish.remoteKey'

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
        <div style={treeShellStyle}>
                <div style={treeHeaderStyle}>
                <div style={treeHeaderEyebrowStyle}>{t('tree.navigator')}</div>
                <div style={treeHeaderTitleStyle}>{t('tree.cases')}</div>
                <div style={treeHeaderHintStyle}>{t('tree.keyboardHint')}</div>
            </div>

            <div role="tree" aria-label={t('tree.navigator')}>
                <NodeView
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
                <Menu
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

type NodeViewProps = {
    node: ViewNode
    parentKey?: string
    depth: number
    selectedId: string | null
    focusedKey: string
    onFocusItem(key: string): void
    onTreeKeyDown(event: React.KeyboardEvent<HTMLElement>, item: VisibleItem): void
    registerRowRef(key: string, element: HTMLElement | null): void
    onSelect(id: string): void
    onMove(nodeId: string, targetFolderId: string): Promise<boolean> | boolean
    onCreateFolderAt(parentId: string): void
    onCreateTestAt(parentId: string): void
    onRename(id: string, name: string): void
    onDelete(id: string): void
    expanded: Set<string>
    onToggleExpanded(id: string): void
    onContextOpen(event: React.MouseEvent, id: string, isFolder: boolean, name: string): void
    onMenuButtonOpen(event: React.MouseEvent<HTMLButtonElement>, id: string, isFolder: boolean, name: string): void
    editing: EditingState
    setEditing(value: EditingState): void
    commitRename(): void
    cancelRename(): void
    onOpenStep(testId: string, stepId: string): void
    t(key: string, params?: Record<string, string | number>): string
    resolveDisplayText(value: string | undefined): string
    dirtyTestIds: Set<string>
}

function NodeView(props: NodeViewProps) {
    const {
        node,
        parentKey,
        depth,
        selectedId,
        focusedKey,
        onFocusItem,
        onTreeKeyDown,
        registerRowRef,
        onSelect,
        onMove,
        expanded,
        onToggleExpanded,
        editing,
        setEditing,
        commitRename,
        cancelRename,
        onOpenStep,
        t,
        resolveDisplayText,
        dirtyTestIds,
    } = props

    const id = node.id
    const key = makeNodeKey(id)
    const isDir = isFolder(node)
    const isOpen = expanded.has(id)
    const selected = id === selectedId
    const focused = key === focusedKey
    const offset = 10 + depth * 14
    const isEditing = editing?.id === id
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const [hoverDrop, setHoverDrop] = React.useState(false)
    const hasChildren = isDir ? node.children.length > 0 : node.steps.length > 0
    const itemCount = isDir ? node.children.length : node.steps.length
    const itemLabel = isDir
        ? t('tree.itemCount', { count: itemCount })
        : t('tree.stepCount', { count: itemCount })
    const syncStatus = resolveNodeSyncStatus(node, dirtyTestIds)
    const item: VisibleItem = {
        key,
        kind: isDir ? 'folder' : 'test',
        id,
        parentKey,
        depth,
        hasChildren,
        expanded: isOpen,
        name: node.name,
    }

    React.useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus()
            inputRef.current?.select()
        }
    }, [isEditing])

    const onDragStart = (event: React.DragEvent) => {
        event.dataTransfer.setData('text/x-node-id', id)
        event.dataTransfer.effectAllowed = 'move'
    }

    const onDragOver = (event: React.DragEvent) => {
        if (!isDir) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setHoverDrop(true)
    }

    const onDragLeave = () => setHoverDrop(false)

    const onDrop = async (event: React.DragEvent) => {
        if (!isDir) return
        event.preventDefault()
        const draggedId = event.dataTransfer.getData('text/x-node-id')
        if (draggedId && draggedId !== id) await onMove(draggedId, id)
        setHoverDrop(false)
    }

    return (
        <div onContextMenu={(event) => props.onContextOpen(event, id, isDir, node.name)}>
            <div
                ref={(element) => registerRowRef(key, element)}
                draggable
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={selected}
                aria-expanded={hasChildren ? isOpen : undefined}
                tabIndex={focused ? 0 : -1}
                onFocus={() => onFocusItem(key)}
                onKeyDown={isEditing ? undefined : (event) => onTreeKeyDown(event, item)}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => {
                    onFocusItem(key)
                    onSelect(id)
                }}
                style={{
                    ...treeRowStyle,
                    marginLeft: offset,
                    background: selected
                        ? 'var(--accent-bg-strong)'
                        : hoverDrop
                            ? 'var(--accent-bg)'
                            : focused
                                ? 'var(--bg-muted)'
                                : isDir
                                    ? 'var(--bg-soft)'
                                    : 'transparent',
                    borderColor: selected ? 'var(--accent-border)' : hoverDrop ? 'var(--accent-border)' : focused ? 'var(--border)' : 'transparent',
                    boxShadow: selected ? 'inset 0 0 0 1px var(--accent-border)' : focused ? 'inset 0 0 0 1px var(--border-soft)' : undefined,
                }}
                title={isDir ? t('tree.folderTitle') : t('tree.caseTitle')}
            >
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        if (hasChildren) onToggleExpanded(id)
                    }}
                    style={{
                        ...expandButtonStyle,
                        opacity: hasChildren ? 1 : 0.45,
                        cursor: hasChildren ? 'pointer' : 'default',
                    }}
                    aria-label={hasChildren ? (isOpen ? t('tree.collapse') : t('tree.expand')) : t('tree.noNestedItems')}
                    disabled={!hasChildren}
                >
                    <ChevronIcon open={isOpen} />
                </button>

                <span
                    aria-hidden
                    style={{
                        ...kindBadgeStyle,
                        background: isDir ? 'var(--accent-bg)' : 'var(--bg-muted)',
                        color: isDir ? 'var(--accent-text)' : 'var(--text-muted)',
                    }}
                >
                    {isDir ? t('tree.folder') : t('tree.case')}
                </span>

                {!isEditing ? (
                    <>
                        <div style={treeTextWrapStyle}>
                            <div style={treeNameStyle}>{node.name}</div>
                            {!isDir && (
                                <div style={treeSecondaryStyle}>
                                    {summarizeStepHeadline(node.steps, t, resolveDisplayText)}
                                </div>
                            )}
                        </div>
                        {renderSyncStatusBadge(syncStatus, t)}
                        <span style={treeMetaPillStyle}>{itemLabel}</span>
                        <button
                            type="button"
                            aria-label={t('tree.openActions', { name: node.name })}
                            aria-haspopup="menu"
                            onClick={(event) => props.onMenuButtonOpen(event, id, isDir, node.name)}
                            style={rowMenuButtonStyle}
                        >
                            ...
                        </button>
                    </>
                ) : (
                    <input
                        ref={inputRef}
                        value={editing?.value ?? ''}
                        onChange={(event) => setEditing({ id, value: event.target.value })}
                        onKeyDown={(event) => {
                            event.stopPropagation()
                            if (event.key === 'Enter') commitRename()
                            else if (event.key === 'Escape') cancelRename()
                        }}
                        onBlur={commitRename}
                        placeholder={t('tree.renamePlaceholder')}
                        style={renameInputStyle}
                    />
                )}
            </div>

            {isOpen && hasChildren && (
                isDir
                    ? (
                        <div role="group">
                            {node.children.map((child) => (
                                <NodeView
                                    key={child.id}
                                    node={child}
                                    parentKey={key}
                                    depth={depth + 1}
                                    selectedId={selectedId}
                                    focusedKey={focusedKey}
                                    onFocusItem={onFocusItem}
                                    onTreeKeyDown={onTreeKeyDown}
                                    registerRowRef={registerRowRef}
                                    onSelect={props.onSelect}
                                    onMove={props.onMove}
                                    onCreateFolderAt={props.onCreateFolderAt}
                                    onCreateTestAt={props.onCreateTestAt}
                                    onRename={props.onRename}
                                    onDelete={props.onDelete}
                                    expanded={expanded}
                                    onToggleExpanded={props.onToggleExpanded}
                                    onContextOpen={props.onContextOpen}
                                    onMenuButtonOpen={props.onMenuButtonOpen}
                                    editing={editing}
                                    setEditing={setEditing}
                                    commitRename={commitRename}
                                    cancelRename={cancelRename}
                                    onOpenStep={onOpenStep}
                                    t={t}
                                    resolveDisplayText={resolveDisplayText}
                                    dirtyTestIds={dirtyTestIds}
                                />
                            ))}
                        </div>
                    )
                    : (
                        <StepsList
                            testId={id}
                            parentKey={key}
                            steps={node.steps}
                            depth={depth + 1}
                            focusedKey={focusedKey}
                            onFocusItem={onFocusItem}
                            onTreeKeyDown={onTreeKeyDown}
                            registerRowRef={registerRowRef}
                            onOpenStep={onOpenStep}
                            t={t}
                            resolveDisplayText={resolveDisplayText}
                        />
                    )
            )}
        </div>
    )
}

function StepsList({
    testId,
    parentKey,
    steps,
    depth,
    focusedKey,
    onFocusItem,
    onTreeKeyDown,
    registerRowRef,
    onOpenStep,
    t,
    resolveDisplayText,
}: {
    testId: string
    parentKey: string
    steps: Step[]
    depth: number
    focusedKey: string
    onFocusItem(key: string): void
    onTreeKeyDown(event: React.KeyboardEvent<HTMLElement>, item: VisibleItem): void
    registerRowRef(key: string, element: HTMLElement | null): void
    onOpenStep: (testId: string, stepId: string) => void
    t: (key: string, params?: Record<string, string | number>) => string
    resolveDisplayText(value: string | undefined): string
}) {
    const offset = 24 + depth * 14

    return (
        <div role="group" style={{ marginLeft: offset, marginTop: 4, display: 'grid', gap: 4, paddingBottom: 6 }}>
            {steps.map((step, index) => {
                const details = [
                    step.usesShared ? t('tree.sharedRef') : '',
                    step.subSteps?.length ? t('tree.subCount', { count: step.subSteps.length }) : '',
                    step.attachments?.length ? t('tree.fileCount', { count: step.attachments.length }) : '',
                ].filter(Boolean)
                const key = makeStepKey(testId, step.id)
                const item: VisibleItem = {
                    key,
                    kind: 'step',
                    id: step.id,
                    testId,
                    parentKey,
                    depth,
                    hasChildren: false,
                    expanded: false,
                    name: summarizeStepLabel(step, t, resolveDisplayText),
                }
                const focused = key === focusedKey

                return (
                    <div
                        key={step.id}
                        ref={(element) => registerRowRef(key, element)}
                        role="treeitem"
                        aria-level={depth + 1}
                        tabIndex={focused ? 0 : -1}
                        style={{
                            ...stepRowStyle,
                            background: focused ? 'var(--bg-muted)' : 'var(--bg-elevated)',
                            borderColor: focused ? 'var(--accent-border)' : 'var(--border-soft)',
                            boxShadow: focused ? 'inset 0 0 0 1px var(--accent-border)' : undefined,
                        }}
                        title={t('tree.openStepTitle')}
                        onFocus={() => onFocusItem(key)}
                        onKeyDown={(event) => onTreeKeyDown(event, item)}
                        onClick={(event) => {
                            event.stopPropagation()
                            onFocusItem(key)
                            onOpenStep(testId, step.id)
                        }}
                    >
                        <span style={stepIndexStyle}>{index + 1}</span>
                        <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                            <div style={stepLabelStyle}>{summarizeStepLabel(step, t, resolveDisplayText)}</div>
                            {details.length ? <div style={stepMetaStyle}>{details.join(' / ')}</div> : null}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function summarizeStepHeadline(
    steps: Step[],
    t: (key: string, params?: Record<string, string | number>) => string = translate,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
): string {
    if (!steps.length) return t('tree.noSteps')
    const first = summarizePlainText(resolveDisplayText(buildCompositeActionText(steps[0]) || t('tree.untitledStep')), 42, t)
    return steps.length === 1 ? first : `${first} +${steps.length - 1}`
}

function summarizeStepLabel(
    step: Step,
    t: (key: string, params?: Record<string, string | number>) => string = translate,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
): string {
    return summarizePlainText(resolveDisplayText(buildCompositeActionText(step) || t('tree.untitledStep')), 68, t)
}

function buildCompositeActionText(step: Pick<Step, 'action' | 'text' | 'internal'>): string {
    const topLevel = String(step.action ?? step.text ?? '').trim()
    const blocks = (step.internal?.parts?.action ?? []).map((part) => String(part.text ?? '').trim()).filter(Boolean)
    return [topLevel, ...blocks].filter(Boolean).join('\n').trim()
}

function summarizePlainText(
    value: string,
    maxLength: number,
    t: (key: string, params?: Record<string, string | number>) => string = translate
): string {
    const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text) return t('tree.untitled')
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function toPreviewishPlainText(value: string): string {
    return String(value ?? '')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_full, alt: string, src: string) => alt || src || '')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function Menu({
    x,
    y,
    isRoot,
    isFolder,
    t,
    onClose,
    onNewFolder,
    onNewTest,
    onRename,
    onDelete,
}: {
    x: number
    y: number
    isRoot: boolean
    isFolder: boolean
    t: (key: string, params?: Record<string, string | number>) => string
    onClose(): void
    onNewFolder(): void
    onNewTest(): void
    onRename(): void
    onDelete(): void
}) {
    const firstItemRef = React.useRef<HTMLButtonElement | null>(null)

    React.useEffect(() => {
        firstItemRef.current?.focus()
    }, [])

    const { left, top } = clampMenuPosition(x, y)

    return (
        <div
            id="tree-context-menu"
            role="menu"
            aria-label={t('tree.treeActions')}
            style={menuStyle(left, top)}
            onMouseDown={(event) => event.stopPropagation()}
        >
            {isFolder && (
                <>
                    <MenuItem ref={firstItemRef} label={t('tree.newFolder')} onClick={() => { onNewFolder(); onClose() }} />
                    <MenuItem label={t('tree.newCase')} onClick={() => { onNewTest(); onClose() }} />
                </>
            )}
            {!isFolder && <MenuItem ref={firstItemRef} label={t('tree.rename')} disabled={isRoot} onClick={() => { onRename(); onClose() }} />}
            {isFolder && <MenuItem label={t('tree.rename')} disabled={isRoot} onClick={() => { onRename(); onClose() }} />}
            <MenuItem label={t('tree.delete')} disabled={isRoot} danger onClick={() => { onDelete(); onClose() }} />
        </div>
    )
}

const MenuItem = React.forwardRef<
    HTMLButtonElement,
    {
        label: string
        onClick(): void
        danger?: boolean
        disabled?: boolean
    }
>(function MenuItem({ label, onClick, danger, disabled }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            role="menuitem"
            onClick={() => {
                if (!disabled) onClick()
            }}
            disabled={disabled}
            style={{
                ...menuItemStyle,
                color: danger ? 'var(--danger-text)' : 'var(--text-strong)',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={(event) => {
                if (!disabled) event.currentTarget.style.background = 'var(--bg-muted)'
            }}
            onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
            }}
        >
            {label}
        </button>
    )
})

function flattenVisibleItems(
    root: Folder,
    expanded: Set<string>,
    t: (key: string, params?: Record<string, string | number>) => string = translate,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
) {
    const walk = (node: ViewNode, depth: number, parentKey?: string): VisibleItem[] => {
        const id = node.id
        const key = makeNodeKey(id)
        const dir = isFolder(node)
        const hasChildren = dir ? node.children.length > 0 : node.steps.length > 0
        const isOpen = expanded.has(id)
        const items: VisibleItem[] = [{
            key,
            kind: dir ? 'folder' : 'test',
            id,
            parentKey,
            depth,
            hasChildren,
            expanded: isOpen,
            name: node.name,
        }]

        if (!isOpen || !hasChildren) return items

        if (dir) {
            for (const child of node.children) items.push(...walk(child, depth + 1, key))
        } else {
            for (const step of node.steps) {
                items.push({
                    key: makeStepKey(node.id, step.id),
                    kind: 'step',
                    id: step.id,
                    testId: node.id,
                    parentKey: key,
                    depth: depth + 1,
                    hasChildren: false,
                    expanded: false,
                    name: summarizeStepLabel(step, t, resolveDisplayText),
                })
            }
        }

        return items
    }

    return walk(root, 0)
}

function resolveNodeSyncStatus(node: ViewNode, dirtyTestIds: Set<string>): SyncStatus | null {
    if (!isFolder(node)) return resolveTestSyncStatus(node, dirtyTestIds)

    let sawSynced = false
    for (const child of node.children) {
        const status = resolveNodeSyncStatus(child, dirtyTestIds)
        if (status === 'conflict') return 'conflict'
        if (status === 'dirty') return 'dirty'
        if (status === 'synced') sawSynced = true
    }
    return sawSynced ? 'synced' : null
}

function resolveTestSyncStatus(test: TestCase, dirtyTestIds: Set<string>): SyncStatus | null {
    const params = test.meta?.params ?? {}
    if (safeString(params[IMPORT_CONFLICT_REMOTE_KEY])) return 'conflict'
    if (dirtyTestIds.has(test.id)) return 'dirty'

    const linkedZephyrId =
        test.links.find((link) => link.provider === 'zephyr')?.externalId ??
        safeString(params.key) ??
        safeString(params[IMPORT_REMOTE_KEY_KEY]) ??
        safeString(params[PUBLISH_REMOTE_KEY])

    if (!linkedZephyrId) return null
    return 'synced'
}

function formatSyncStatusLabel(
    status: SyncStatus,
    t: (key: string, params?: Record<string, string | number>) => string
): string {
    return status === 'conflict' ? t('tree.sync.conflict') : t('tree.sync.synced')
}

function renderSyncStatusBadge(
    status: SyncStatus | null,
    t: (key: string, params?: Record<string, string | number>) => string
) {
    if (!status) return null
    if (status === 'dirty') {
        return (
            <span
                aria-label={t('tree.sync.dirtyTitle')}
                title={t('tree.sync.dirtyTitle')}
                style={treeDirtyIndicatorStyle}
            />
        )
    }

    return <span style={treeStatusPillStyle(status)}>{formatSyncStatusLabel(status, t)}</span>
}

function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 12 12"
            width="12"
            height="12"
            style={{
                display: 'block',
                transform: open ? 'rotate(90deg)' : 'none',
                transition: 'transform .12s ease',
            }}
        >
            <path
                d="M4 2.5L8 6L4 9.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

function parseTimestamp(value: unknown): number {
    const timestamp = Date.parse(String(value ?? '').trim())
    return Number.isFinite(timestamp) ? timestamp : 0
}

function safeString(value: unknown): string {
    const next = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
    return next || ''
}

function clampMenuPosition(x: number, y: number) {
    if (typeof window === 'undefined') return { left: x, top: y }
    const width = 188
    const height = 180
    const gutter = 12
    return {
        left: Math.max(gutter, Math.min(x, window.innerWidth - width - gutter)),
        top: Math.max(gutter, Math.min(y, window.innerHeight - height - gutter)),
    }
}

function makeNodeKey(id: string) {
    return `node:${id}`
}

function makeStepKey(testId: string, stepId: string) {
    return `step:${testId}:${stepId}`
}

const treeShellStyle: React.CSSProperties = {
    position: 'relative',
    padding: '10px 10px 14px',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    fontSize: 13,
    color: 'var(--text-strong)',
    background: 'var(--bg-soft)',
}

const treeHeaderStyle: React.CSSProperties = {
    display: 'grid',
    gap: 2,
    padding: '4px 8px 10px',
}

const treeHeaderEyebrowStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: 'var(--text-dim)',
}

const treeHeaderTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text-strong)',
}

const treeHeaderHintStyle: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: 12,
    lineHeight: 1.45,
}

const treeRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    marginBottom: 3,
    padding: '6px 8px',
    borderRadius: 12,
    border: '1px solid transparent',
    cursor: 'pointer',
    transition: 'background .08s ease, border-color .08s ease',
    outline: 'none',
}

const expandButtonStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    padding: 0,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
}

const kindBadgeStyle: React.CSSProperties = {
    minHeight: 22,
    padding: '0 8px',
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
}

const treeStatusPillStyle = (status: SyncStatus): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '0 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    ...(status === 'conflict'
        ? { background: 'var(--danger-bg)', color: 'var(--danger-text)' }
        : status === 'dirty'
            ? { background: 'var(--warning-bg)', color: 'var(--warning-text)' }
            : { background: 'var(--success-bg)', color: 'var(--success-text)' }),
})

const treeDirtyIndicatorStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: 'var(--warning-text)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--warning-text) 22%, transparent)',
    flexShrink: 0,
}

const rowMenuButtonStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
}

const treeTextWrapStyle: React.CSSProperties = {
    minWidth: 0,
    display: 'grid',
    gap: 2,
    flex: 1,
}

const treeNameStyle: React.CSSProperties = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 600,
}

const treeSecondaryStyle: React.CSSProperties = {
    color: 'var(--text-dim)',
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
}

const treeMetaPillStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '0 8px',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
}

const renameInputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 60,
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    padding: '6px 8px',
    borderRadius: 8,
    font: 'inherit',
}

const stepRowStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '24px minmax(0, 1fr)',
    gap: 8,
    alignItems: 'start',
    padding: '6px 8px',
    borderRadius: 10,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-soft)',
    cursor: 'pointer',
    outline: 'none',
}

const stepIndexStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: 'var(--accent-bg)',
    color: 'var(--accent-text)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
}

const stepLabelStyle: React.CSSProperties = {
    color: 'var(--text)',
    lineHeight: 1.4,
}

const stepMetaStyle: React.CSSProperties = {
    color: 'var(--text-dim)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '.03em',
}

const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    border: 0,
    background: 'transparent',
    borderRadius: 8,
}

const menuStyle = (x: number, y: number): React.CSSProperties => ({
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 100,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: 'var(--shadow-soft)',
    minWidth: 180,
    padding: 6,
    pointerEvents: 'auto',
})
