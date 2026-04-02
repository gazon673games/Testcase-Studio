import * as React from 'react'
import { isFolder } from '@core/tree'
import type { EditingState, TreeKeyboardHandler, TreeTranslate, ViewNode } from './types'
import { ChevronIcon, makeNodeKey, renderSyncStatusBadge, summarizeStepHeadline } from './utils'
import { TreeStepsList } from './TreeStepsList'

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
    resolveDisplayText(value: string | undefined): string
    syncStatusById: Map<string, 'dirty'>
}

export function TreeNodeView(props: TreeNodeViewProps) {
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
        syncStatusById,
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
    const syncStatus = syncStatusById.get(id) ?? null
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
                title={isDir ? t('tree.folderTitle') : t('tree.caseTitle')}
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
                    aria-hidden
                    className={`tree-kind-badge ${isDir ? 'tree-kind-badge--folder' : 'tree-kind-badge--test'}`}
                >
                    {isDir ? t('tree.folder') : t('tree.case')}
                </span>

                {!isEditing ? (
                    <>
                        <div className="tree-text-wrap">
                            <div className="tree-name">{node.name}</div>
                            {!isDir && (
                                <div className="tree-secondary">
                                    {summarizeStepHeadline(node.steps, t, resolveDisplayText)}
                                </div>
                            )}
                        </div>
                        {renderSyncStatusBadge(syncStatus, t)}
                        <span className="tree-meta-pill">{itemLabel}</span>
                        <button
                            type="button"
                            aria-label={t('tree.openActions', { name: node.name })}
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
                                    syncStatusById={syncStatusById}
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
                            resolveDisplayText={resolveDisplayText}
                        />
                    )
            )}
        </div>
    )
}
