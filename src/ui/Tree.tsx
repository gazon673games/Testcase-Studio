import * as React from 'react'
import type { Folder, Step, TestCase } from '@core/domain'
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
    onOpenStep: (testId: string, stepId: string) => void
}

type ViewNode = Folder | TestCase
type ContextMenuState =
    | { x: number; y: number; targetId: string; targetIsFolder: boolean; targetName: string }
    | null
type EditingState = { id: string; value: string } | null

export function Tree(props: Props) {
    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set([props.root.id]))
    const [menu, setMenu] = React.useState<ContextMenuState>(null)
    const [editing, setEditing] = React.useState<EditingState>(null)

    React.useEffect(() => {
        setExpanded((current) => {
            if (current.has(props.root.id)) return current
            const next = new Set(current)
            next.add(props.root.id)
            return next
        })
    }, [props.root.id])

    const toggleExpanded = React.useCallback((id: string) => {
        setExpanded((current) => {
            const next = new Set(current)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    const openMenu = React.useCallback(
        (event: React.MouseEvent, id: string, targetIsFolder: boolean, targetName: string) => {
            event.preventDefault()
            event.stopPropagation()
            props.onSelect(id)
            setMenu({ x: event.clientX, y: event.clientY, targetId: id, targetIsFolder, targetName })
        },
        [props]
    )

    const closeMenu = React.useCallback(() => setMenu(null), [])

    React.useEffect(() => {
        if (!menu) return
        const onMouseDown = (event: MouseEvent) => {
            const element = document.getElementById('tree-context-menu')
            if (element && element.contains(event.target as globalThis.Node)) return
            closeMenu()
        }
        document.addEventListener('mousedown', onMouseDown)
        return () => document.removeEventListener('mousedown', onMouseDown)
    }, [menu, closeMenu])

    const commitRename = React.useCallback(() => {
        if (editing && editing.value.trim()) props.onRename(editing.id, editing.value.trim())
        setEditing(null)
    }, [editing, props])

    const cancelRename = React.useCallback(() => setEditing(null), [])

    return (
        <div style={treeShellStyle}>
            <div style={treeHeaderStyle}>
                <div style={treeHeaderEyebrowStyle}>Navigator</div>
                <div style={treeHeaderTitleStyle}>Tests</div>
            </div>

            <NodeView
                node={props.root}
                depth={0}
                selectedId={props.selectedId}
                onSelect={props.onSelect}
                onMove={props.onMove}
                onCreateFolderAt={props.onCreateFolderAt}
                onCreateTestAt={props.onCreateTestAt}
                onRename={props.onRename}
                onDelete={props.onDelete}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
                onContextOpen={openMenu}
                editing={editing}
                setEditing={setEditing}
                commitRename={commitRename}
                cancelRename={cancelRename}
                onOpenStep={props.onOpenStep}
            />

            {menu && (
                <Menu
                    x={menu.x}
                    y={menu.y}
                    isRoot={menu.targetId === props.root.id}
                    isFolder={menu.targetIsFolder}
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
    onContextOpen(event: React.MouseEvent, id: string, isFolder: boolean, name: string): void
    editing: EditingState
    setEditing(value: EditingState): void
    commitRename(): void
    cancelRename(): void
    onOpenStep(testId: string, stepId: string): void
}

function NodeView(props: NodeViewProps) {
    const {
        node,
        depth,
        selectedId,
        onSelect,
        onMove,
        expanded,
        onToggleExpanded,
        editing,
        setEditing,
        commitRename,
        cancelRename,
        onOpenStep,
    } = props

    const id = node.id
    const isDir = isFolder(node)
    const isOpen = expanded.has(id)
    const selected = id === selectedId
    const offset = 10 + depth * 14
    const isEditing = editing?.id === id
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const [hoverDrop, setHoverDrop] = React.useState(false)

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

    const itemCount = isDir ? node.children.length : node.steps.length
    const itemLabel = isDir
        ? `${itemCount} item${itemCount === 1 ? '' : 's'}`
        : `${itemCount} step${itemCount === 1 ? '' : 's'}`

    return (
        <div onContextMenu={(event) => props.onContextOpen(event, id, isDir, node.name)}>
            <div
                draggable
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => onSelect(id)}
                style={{
                    ...treeRowStyle,
                    marginLeft: offset,
                    background: selected ? '#eaf2ff' : hoverDrop ? '#f5f8ff' : 'transparent',
                    borderColor: selected ? '#bfd2f7' : hoverDrop ? '#d5e2fb' : 'transparent',
                    boxShadow: selected ? 'inset 0 0 0 1px #d7e4ff' : undefined,
                }}
                title={isDir ? 'Folder' : 'Test case'}
            >
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        onToggleExpanded(id)
                    }}
                    style={expandButtonStyle}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                    {isOpen ? 'v' : '>'}
                </button>

                <span
                    aria-hidden
                    style={{
                        ...kindBadgeStyle,
                        background: isDir ? '#eef5ff' : '#f3f5f8',
                        color: isDir ? '#2b5ca6' : '#5a6678',
                    }}
                >
                    {isDir ? 'F' : 'T'}
                </span>

                {!isEditing ? (
                    <>
                        <div style={treeTextWrapStyle}>
                            <div style={treeNameStyle}>{node.name}</div>
                            {!isDir && (
                                <div style={treeSecondaryStyle}>
                                    {summarizeStepHeadline(node.steps)}
                                </div>
                            )}
                        </div>
                        <span style={treeMetaPillStyle}>{itemLabel}</span>
                    </>
                ) : (
                    <input
                        ref={inputRef}
                        value={editing?.value ?? ''}
                        onChange={(event) => setEditing({ id, value: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename()
                            else if (event.key === 'Escape') cancelRename()
                        }}
                        onBlur={commitRename}
                        placeholder="Rename..."
                        style={renameInputStyle}
                    />
                )}
            </div>

            {isOpen && (
                isDir
                    ? node.children.map((child) => (
                        <NodeView
                            key={child.id}
                            node={child}
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
                    : <StepsList testId={id} steps={node.steps} depth={depth + 1} onOpenStep={onOpenStep} />
            )}
        </div>
    )
}

function StepsList({
    testId,
    steps,
    depth,
    onOpenStep,
}: {
    testId: string
    steps: Step[]
    depth: number
    onOpenStep: (testId: string, stepId: string) => void
}) {
    const offset = 24 + depth * 14

    return (
        <div style={{ marginLeft: offset, marginTop: 4, display: 'grid', gap: 4, paddingBottom: 6 }}>
            {steps.map((step, index) => {
                const details = [
                    step.usesShared ? 'shared' : '',
                    step.subSteps?.length ? `${step.subSteps.length} sub` : '',
                    step.attachments?.length ? `${step.attachments.length} file` : '',
                ].filter(Boolean)

                return (
                    <div
                        key={step.id}
                        style={stepRowStyle}
                        title="Double click to open in editor"
                        onDoubleClick={(event) => {
                            event.stopPropagation()
                            onOpenStep(testId, step.id)
                        }}
                    >
                        <span style={stepIndexStyle}>{index + 1}</span>
                        <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                            <div style={stepLabelStyle}>{summarizeStepLabel(step)}</div>
                            {details.length ? <div style={stepMetaStyle}>{details.join(' / ')}</div> : null}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function summarizeStepHeadline(steps: Step[]): string {
    if (!steps.length) return 'No steps yet'
    const first = summarizePlainText(steps[0].action || steps[0].text || 'Untitled step', 42)
    return steps.length === 1 ? first : `${first} +${steps.length - 1} more`
}

function summarizeStepLabel(step: Step): string {
    return summarizePlainText(step.action || step.text || 'Untitled step', 68)
}

function summarizePlainText(value: string, maxLength: number): string {
    const text = value.replace(/\s+/g, ' ').trim()
    if (!text) return 'Untitled'
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function Menu({
    x,
    y,
    isRoot,
    isFolder,
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
    onClose(): void
    onNewFolder(): void
    onNewTest(): void
    onRename(): void
    onDelete(): void
}) {
    return (
        <div
            id="tree-context-menu"
            style={menuStyle(x, y)}
            onMouseDown={(event) => event.stopPropagation()}
        >
            {isFolder && (
                <>
                    <MenuItem label="New Folder" onClick={() => { onNewFolder(); onClose() }} />
                    <MenuItem label="New Test" onClick={() => { onNewTest(); onClose() }} />
                </>
            )}
            <MenuItem label="Rename" disabled={isRoot} onClick={() => { onRename(); onClose() }} />
            <MenuItem label="Delete" disabled={isRoot} danger onClick={() => { onDelete(); onClose() }} />
        </div>
    )
}

function MenuItem({
    label,
    onClick,
    danger,
    disabled,
}: {
    label: string
    onClick(): void
    danger?: boolean
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            onClick={() => {
                if (!disabled) onClick()
            }}
            disabled={disabled}
            style={{
                ...menuItemStyle,
                color: danger ? '#a13323' : '#20354f',
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={(event) => {
                if (!disabled) event.currentTarget.style.background = '#f4f7fc'
            }}
            onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
            }}
        >
            {label}
        </button>
    )
}

const treeShellStyle: React.CSSProperties = {
    position: 'relative',
    padding: '10px 10px 14px',
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    fontSize: 13,
    color: '#22384f',
    background: '#f9fbfd',
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
    color: '#74839b',
}

const treeHeaderTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    color: '#20354f',
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
}

const expandButtonStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: '1px solid #dce3ee',
    background: '#fff',
    color: '#5f6f86',
    fontSize: 11,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
}

const kindBadgeStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
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
    color: '#75839a',
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
    background: '#f2f5f9',
    color: '#66758c',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
}

const renameInputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 60,
    border: '1px solid #8ab4f8',
    background: '#eef5ff',
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
    background: '#ffffff',
    border: '1px solid #e8edf4',
    cursor: 'pointer',
}

const stepIndexStyle: React.CSSProperties = {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: '#eef4ff',
    color: '#2c5ea8',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
}

const stepLabelStyle: React.CSSProperties = {
    color: '#334b65',
    lineHeight: 1.4,
}

const stepMetaStyle: React.CSSProperties = {
    color: '#78869b',
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
    background: '#fff',
    border: '1px solid #dbe3ee',
    borderRadius: 12,
    boxShadow: '0 14px 40px rgba(18, 35, 58, .16)',
    minWidth: 180,
    padding: 6,
    pointerEvents: 'auto',
})
