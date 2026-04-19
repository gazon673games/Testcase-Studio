import * as React from 'react'
import { isFolder } from '@core/tree'
import { getStoredFolderAlias, getStoredTestAlias } from '@shared/treeAliases'
import type { LocalTreeIconOption } from '@shared/treeIcons'
import type { EditingState, TreeKeyboardHandler, TreeTranslate, ViewNode } from './types'
import { ChevronIcon, makeNodeKey, renderSyncStatusBadge } from './utils'
import { TreeStepsList } from './TreeStepsList'

function FolderKindIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="tree-kind-icon__svg">
            <path
                fill="currentColor"
                d="M1.5 4.75A1.75 1.75 0 0 1 3.25 3h2.28c.4 0 .78.15 1.06.43l.78.82h5.38A1.75 1.75 0 0 1 14.5 6v5.75a1.75 1.75 0 0 1-1.75 1.75h-9.5A1.75 1.75 0 0 1 1.5 11.75z"
            />
        </svg>
    )
}

function TestKindIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="tree-kind-icon__svg">
            <path
                fill="currentColor"
                d="M4 1.5h5.75L13 4.75v8.5A1.25 1.25 0 0 1 11.75 14.5h-7.5A1.25 1.25 0 0 1 3 13.25v-10A1.25 1.25 0 0 1 4.25 2zm5.5.9V5h2.6zM5.25 7a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5zm0 2.75a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5z"
            />
        </svg>
    )
}

export type TreeNodeViewProps = {
    node: ViewNode
    parentKey?: string
    depth: number
    selectedId: string | null
    focusedKey: string
    onFocusItem(key: string): void
    onTreeKeyDown: TreeKeyboardHandler
    registerRowRef(key: string, element: HTMLElement | null): void
    onSelect(id: string): void
    onMove(nodeId: string, targetFolderId: string): Promise<boolean> | boolean
    onCreateFolderAt(parentId: string): void
    onCreateTestAt(parentId: string): void
    onRename(id: string, name: string): void
    onDelete(id: string): void
    aliasMode: boolean
    expanded: Set<string>
    onToggleExpanded(id: string): void
    onContextOpen(event: React.MouseEvent, id: string, isFolder: boolean, name: string): void
    onMenuButtonOpen(event: React.MouseEvent<HTMLButtonElement>, id: string, isFolder: boolean, name: string): void
    editing: EditingState
    setEditing(value: EditingState): void
    commitRename(): void
    cancelRename(): void
    onOpenStep(testId: string, stepId: string): void
    t: TreeTranslate
    syncStatusById: Map<string, 'dirty'>
    testHeadlineById: Map<string, string>
    stepLabelByKey: Map<string, string>
    nodeIconById: Map<string, LocalTreeIconOption | null>
    folderTestCounts: Map<string, number>
}

function TreeNodeViewInner(props: TreeNodeViewProps) {
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
        aliasMode,
        expanded,
        onToggleExpanded,
        editing,
        setEditing,
        commitRename,
        cancelRename,
        onOpenStep,
        t,
        syncStatusById,
        testHeadlineById,
        stepLabelByKey,
        nodeIconById,
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
    const storedAlias = isDir ? getStoredFolderAlias(node) : getStoredTestAlias(node.details)
    const displayName = aliasMode ? (storedAlias || node.name) : node.name
    const itemCount = isDir ? (props.folderTestCounts.get(id) ?? 0) : node.steps.length
    const itemLabel = isDir
        ? t('tree.testsCount', { count: itemCount })
        : t('tree.stepCount', { count: itemCount })
    const syncStatus = syncStatusById.get(id) ?? null
    const customNodeIcon = nodeIconById.get(id) ?? null
    const item = {
        key,
        kind: isDir ? 'folder' as const : 'test' as const,
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
                className={[
                    'tree-row',
                    isDir ? 'is-folder' : 'is-test',
                    selected ? 'is-selected' : '',
                    hoverDrop ? 'is-hover-drop' : '',
                    focused ? 'is-focused' : '',
                ].filter(Boolean).join(' ')}
                style={{ ['--tree-offset' as string]: `${offset}px` }}
                title={displayName}
            >
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        if (hasChildren) onToggleExpanded(id)
                    }}
                    className="tree-expand-button"
                    aria-label={hasChildren ? (isOpen ? t('tree.collapse') : t('tree.expand')) : t('tree.noNestedItems')}
                    disabled={!hasChildren}
                >
                    <ChevronIcon open={isOpen} />
                </button>

                <span
                    aria-hidden="true"
                    title={isDir ? t('tree.folder') : t('tree.case')}
                    className={`tree-kind-icon ${isDir ? 'tree-kind-icon--folder' : 'tree-kind-icon--test'}`}
                >
                    {customNodeIcon ? <img className="tree-kind-icon__img" src={customNodeIcon.dataUrl} alt="" /> : isDir ? <FolderKindIcon /> : <TestKindIcon />}
                </span>

                {!isEditing ? (
                    <>
                            <div className="tree-text-wrap">
                            <div className="tree-name">{displayName}</div>
                            {!isDir && (
                                <div className="tree-secondary">
                                    {testHeadlineById.get(id) ?? t('tree.noSteps')}
                                </div>
                            )}
                        </div>
                        {renderSyncStatusBadge(syncStatus, t)}
                        <span className="tree-meta-pill">{itemLabel}</span>
                        <button
                            type="button"
                            aria-label={t('tree.openActions', { name: displayName })}
                            aria-haspopup="menu"
                            onClick={(event) => props.onMenuButtonOpen(event, id, isDir, node.name)}
                            className="tree-row-menu-button"
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
                        className="tree-rename-input"
                    />
                )}
            </div>

            {isOpen && hasChildren && (
                isDir
                    ? (
                        <div role="group">
                            {node.children.map((child) => (
                                <TreeNodeView
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
                                    aliasMode={aliasMode}
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
                                    syncStatusById={syncStatusById}
                                    testHeadlineById={testHeadlineById}
                                    stepLabelByKey={stepLabelByKey}
                                    nodeIconById={nodeIconById}
                                    folderTestCounts={props.folderTestCounts}
                                />
                            ))}
                        </div>
                    )
                    : (
                        <TreeStepsList
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
                            stepLabelByKey={stepLabelByKey}
                        />
                    )
            )}
        </div>
    )
}

function areTreeNodeViewPropsEqual(prev: TreeNodeViewProps, next: TreeNodeViewProps): boolean {
    // Node data
    if (prev.node !== next.node) return false
    if (prev.parentKey !== next.parentKey) return false
    if (prev.depth !== next.depth) return false
    if (prev.aliasMode !== next.aliasMode) return false
    if (prev.t !== next.t) return false
    if (prev.folderTestCounts !== next.folderTestCounts) return false

    // Stable callbacks
    if (prev.onFocusItem !== next.onFocusItem) return false
    if (prev.onTreeKeyDown !== next.onTreeKeyDown) return false
    if (prev.registerRowRef !== next.registerRowRef) return false
    if (prev.onSelect !== next.onSelect) return false
    if (prev.onMove !== next.onMove) return false
    if (prev.onCreateFolderAt !== next.onCreateFolderAt) return false
    if (prev.onCreateTestAt !== next.onCreateTestAt) return false
    if (prev.onRename !== next.onRename) return false
    if (prev.onDelete !== next.onDelete) return false
    if (prev.onToggleExpanded !== next.onToggleExpanded) return false
    if (prev.onContextOpen !== next.onContextOpen) return false
    if (prev.onMenuButtonOpen !== next.onMenuButtonOpen) return false
    if (prev.setEditing !== next.setEditing) return false
    if (prev.commitRename !== next.commitRename) return false
    if (prev.cancelRename !== next.cancelRename) return false
    if (prev.onOpenStep !== next.onOpenStep) return false

    // Row state
    const nodeId = prev.node.id
    const nodeKey = makeNodeKey(nodeId)
    const prevIsOpen = prev.expanded.has(nodeId)
    const nextIsOpen = next.expanded.has(nodeId)

    if ((prev.selectedId === nodeId) !== (next.selectedId === nodeId)) return false
    if ((prev.focusedKey === nodeKey) !== (next.focusedKey === nodeKey)) return false
    if (prevIsOpen !== nextIsOpen) return false
    if ((prev.editing?.id === nodeId) !== (next.editing?.id === nodeId)) return false
    if (prev.editing?.id === nodeId && prev.editing.value !== next.editing?.value) return false

    // Row map entries
    if (prev.syncStatusById.get(nodeId) !== next.syncStatusById.get(nodeId)) return false
    if (prev.testHeadlineById.get(nodeId) !== next.testHeadlineById.get(nodeId)) return false
    if (prev.nodeIconById.get(nodeId) !== next.nodeIconById.get(nodeId)) return false

    // Open rows pass relevant state to rendered children.
    if (prevIsOpen) {
        if (isFolder(prev.node)) {
            if (prev.selectedId !== next.selectedId) return false
            if (prev.focusedKey !== next.focusedKey) return false
            if (prev.expanded !== next.expanded) return false
            if (prev.editing !== next.editing) return false
            if (prev.syncStatusById !== next.syncStatusById) return false
            if (prev.testHeadlineById !== next.testHeadlineById) return false
            if (prev.nodeIconById !== next.nodeIconById) return false
        } else {
            if (prev.stepLabelByKey !== next.stepLabelByKey) return false
        }
    }

    return true
}

export const TreeNodeView = React.memo(TreeNodeViewInner, areTreeNodeViewPropsEqual)
