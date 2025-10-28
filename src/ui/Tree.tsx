// src/ui/Tree.tsx
import * as React from 'react'
import type { Folder, TestCase, Step, SubStep } from '@core/domain'
import { isFolder } from '@core/tree'

type Props = {
    root: Folder
    selectedId: string | null
    onSelect: (id: string) => void
    onMove: (nodeId: string, targetFolderId: string) => Promise<boolean> | boolean
    onCreateFolderAt: (parentId: string) => void
    onCreateTestAt: (parentId: string) => void
    onRename: (id: string, newName: string) => void
    onDelete: (id: string) => void
    /** 🆕 Двойной клик по шагу в дереве */
    onOpenStep: (testId: string, stepId: string) => void
}

type ViewNode = Folder | TestCase

type CtxMenu =
    | { x: number; y: number; targetId: string; targetIsFolder: boolean; targetName: string }
    | null

type EditingState = { id: string; value: string } | null

export function Tree(p: Props) {
    // По умолчанию папки раскрыты, тесты — свёрнуты
    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set([p.root.id]))
    const toggleExpanded = React.useCallback((id: string) => {
        setExpanded(s => {
            const n = new Set(s)
            n.has(id) ? n.delete(id) : n.add(id)
            return n
        })
    }, [])

    const [menu, setMenu] = React.useState<CtxMenu>(null)
    const [editing, setEditing] = React.useState<EditingState>(null)

    const openMenu = React.useCallback(
        (e: React.MouseEvent, id: string, targetIsFolder: boolean, targetName: string) => {
            e.preventDefault(); e.stopPropagation()
            p.onSelect(id)
            setMenu({ x: e.clientX, y: e.clientY, targetId: id, targetIsFolder, targetName })
        }, [p]
    )
    const closeMenu = React.useCallback(() => setMenu(null), [])

    React.useEffect(() => {
        if (!menu) return
        const onDown = (ev: MouseEvent) => {
            const el = document.getElementById('tree-context-menu')
            if (el && el.contains(ev.target as Node)) return
            closeMenu()
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [menu, closeMenu])

    const commitRename = React.useCallback(() => {
        if (editing && editing.value.trim()) p.onRename(editing.id, editing.value.trim())
        setEditing(null)
    }, [editing, p])
    const cancelRename = React.useCallback(() => setEditing(null), [])

    return (
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, position: 'relative' }}>
            <NodeView
                node={p.root}
                depth={0}
                selectedId={p.selectedId}
                onSelect={p.onSelect}
                onMove={p.onMove}
                onCreateFolderAt={p.onCreateFolderAt}
                onCreateTestAt={p.onCreateTestAt}
                onRename={p.onRename}
                onDelete={p.onDelete}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
                onContextOpen={openMenu}
                editing={editing}
                setEditing={setEditing}
                commitRename={commitRename}
                cancelRename={cancelRename}
                onOpenStep={p.onOpenStep}
            />

            {menu && (
                <Menu
                    x={menu.x}
                    y={menu.y}
                    isRoot={menu.targetId === p.root.id}
                    isFolder={menu.targetIsFolder}
                    onClose={closeMenu}
                    onNewFolder={() => p.onCreateFolderAt(menu.targetId)}
                    onNewTest={() => p.onCreateTestAt(menu.targetId)}
                    onRename={() => { setEditing({ id: menu.targetId, value: menu.targetName }); closeMenu() }}
                    onDelete={() => p.onDelete(menu.targetId)}
                />
            )}
        </div>
    )
}

type NodeViewProps = {
    node: ViewNode
    depth: number
    selectedId: string | null
    onSelect(id: string): void
    onMove(nodeId: string, targetFolderId: string): Promise<boolean> | boolean
    onCreateFolderAt(parentId: string): void
    onCreateTestAt(parentId: string): void
    onRename(id: string, name: string): void
    onDelete(id: string): void
    expanded: Set<string>
    onToggleExpanded(id: string): void
    onContextOpen(e: React.MouseEvent, id: string, isFolder: boolean, name: string): void
    editing: EditingState
    setEditing(v: EditingState): void
    commitRename(): void
    cancelRename(): void
    onOpenStep(testId: string, stepId: string): void
}

function NodeView(props: NodeViewProps) {
    const {
        node, depth, selectedId, onSelect, onMove, expanded, onToggleExpanded,
        editing, setEditing, commitRename, cancelRename, onOpenStep
    } = props

    const id = (node as any).id as string
    const name = (node as any).name as string
    const isDir = isFolder(node)
    const isTest = !isDir
    const isOpen = expanded.has(id)
    const selected = id === selectedId
    const padding = 6 + depth * 12
    const [hoverDrop, setHoverDrop] = React.useState(false)

    const onDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/x-node-id', id)
        e.dataTransfer.effectAllowed = 'move'
    }
    const onDragOver = (e: React.DragEvent) => {
        if (!isDir) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setHoverDrop(true)
    }
    const onDragLeave = () => setHoverDrop(false)
    const onDrop = async (e: React.DragEvent) => {
        if (!isDir) return
        e.preventDefault()
        const draggedId = e.dataTransfer.getData('text/x-node-id')
        if (draggedId && draggedId !== id) await onMove(draggedId, id)
        setHoverDrop(false)
    }

    const isEditing = editing?.id === id
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    React.useEffect(() => { if (isEditing) { inputRef.current?.focus(); inputRef.current?.select() } }, [isEditing])

    const chevron = (isDir || isTest) ? (isOpen ? '▾' : '▸') : '•'
    const glyph = isDir ? '📁' : '🧪'

    return (
        <div onContextMenu={(e) => props.onContextOpen(e, id, isDir, name)}>
            <div
                draggable
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => onSelect(id)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px',
                    marginLeft: padding, borderRadius: 6, cursor: 'pointer',
                    outline: hoverDrop ? '2px dashed #8ab4f8' : undefined,
                    background: selected ? 'rgba(0,0,0,0.08)' : undefined,
                }}
                title={isDir ? 'Folder' : 'Test'}
            >
        <span
            onClick={(e) => { e.stopPropagation(); props.onToggleExpanded(id) }}
            style={{ width: 12, textAlign: 'center', userSelect: 'none' }}
        >{chevron}</span>
                <span aria-hidden>{glyph}</span>

                {!isEditing ? (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 40 }}>
            {name}
          </span>
                ) : (
                    <input
                        ref={inputRef}
                        value={editing?.value ?? ''}
                        onChange={(e) => setEditing({ id, value: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') cancelRename() }}
                        onBlur={commitRename}
                        placeholder="Введите новое имя…"
                        style={{ flex: 1, minWidth: 60, border: '1px solid #8ab4f8', background: '#eef5ff', padding: '2px 6px', borderRadius: 6 }}
                    />
                )}
            </div>

            {isOpen && (
                isDir
                    ? node.children.map((child) => (
                        <NodeView
                            key={(child as any).id}
                            node={child as any}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={props.onSelect}
                            onMove={props.onMove}
                            onCreateFolderAt={props.onCreateFolderAt}
                            onCreateTestAt={props.onCreateTestAt}
                            onRename={props.onRename}
                            onDelete={props.onDelete}
                            expanded={expanded}
                            onToggleExpanded={props.onToggleExpanded}
                            onContextOpen={props.onContextOpen}
                            editing={editing}
                            setEditing={setEditing}
                            commitRename={commitRename}
                            cancelRename={cancelRename}
                            onOpenStep={onOpenStep}
                        />
                    ))
                    : <StepsList testId={id} steps={(node as TestCase).steps} depth={depth + 1} onOpenStep={onOpenStep} />
            )}
        </div>
    )
}

/** Read-only список шагов. Двойной клик — открыть шаг в редакторе */
function StepsList({ testId, steps, depth, onOpenStep }: { testId: string; steps: Step[]; depth: number; onOpenStep: (testId: string, stepId: string) => void }) {
    const left = 6 + depth * 12
    return (
        <div style={{ marginLeft: left + 12, marginTop: 2 }}>
            {steps.map((s) => {
                const label = s.action || s.text || '(empty step)'
                const postfix = s.expected ? ` — ${s.expected}` : ''
                return (
                    <div
                        key={s.id}
                        style={{ padding: '2px 4px', borderRadius: 6, cursor: 'default' }}
                        title="Double click to open in editor"
                        onDoubleClick={(e) => { e.stopPropagation(); onOpenStep(testId, s.id) }}
                    >
                        <div>🧩 {label}{postfix}</div>
                        {s.subSteps && s.subSteps.length > 0 && (
                            <div style={{ marginLeft: 16, marginTop: 2 }}>
                                {s.subSteps.map((ss: SubStep) => (
                                    <div key={ss.id}>▪️ {ss.title || ss.text || '(substep)'}</div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

/* Контекстное меню */
function Menu({
                  x, y, isRoot, isFolder, onClose, onNewFolder, onNewTest, onRename, onDelete,
              }: {
    x: number; y: number; isRoot: boolean; isFolder: boolean
    onClose(): void; onNewFolder(): void; onNewTest(): void; onRename(): void; onDelete(): void
}) {
    return (
        <div
            id="tree-context-menu"
            style={{
                position: 'fixed', left: x, top: y, zIndex: 100, background: '#fff',
                border: '1px solid #ddd', borderRadius: 8, boxShadow: '0 6px 24px rgba(0,0,0,.15)',
                minWidth: 180, padding: 4, pointerEvents: 'auto',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {isFolder && (
                <>
                    <Item label="New Folder" onClick={() => { onNewFolder(); onClose() }} />
                    <Item label="New Test" onClick={() => { onNewTest(); onClose() }} />
                </>
            )}
            <Item label="Rename" disabled={isRoot} onClick={() => { onRename(); onClose() }} />
            <Item label="Delete" disabled={isRoot} danger onClick={() => { onDelete(); onClose() }} />
        </div>
    )
}

function Item({ label, onClick, danger, disabled }: { label: string; onClick(): void; danger?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={() => { if (!disabled) onClick() }}
            disabled={disabled}
            style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px',
                border: 0, background: 'transparent', borderRadius: 6,
                color: danger ? '#b00020' : '#111', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,.06)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
            {label}
        </button>
    )
}
