import React from 'react'
import type { Folder, SharedStep } from '@core/domain'
import { Tree } from '../../tree/Tree'

type WorkspacePaneProps = {
    compactWorkspace: boolean
    root: Folder
    sharedSteps: SharedStep[]
    dirtyTestIds: Set<string>
    selectedId: string | null
    onSelect(id: string): void
    onMove(sourceId: string, targetFolderId: string): Promise<boolean> | boolean
    onCreateFolderAt(parentId: string): void
    onCreateTestAt(parentId: string): void
    onRename(id: string, name: string): void
    onDelete(id: string): void
    onOpenStep(testId: string, stepId: string): void
    rightPane: React.ReactNode
    syncCenter: React.ReactNode
}

export function WorkspacePane({
    compactWorkspace,
    root,
    sharedSteps,
    dirtyTestIds,
    selectedId,
    onSelect,
    onMove,
    onCreateFolderAt,
    onCreateTestAt,
    onRename,
    onDelete,
    onOpenStep,
    rightPane,
    syncCenter,
}: WorkspacePaneProps) {
    const [treeWidth, setTreeWidth] = React.useState<number>(() => {
        if (typeof window === 'undefined') return 320
        const stored = Number(window.localStorage.getItem('workspace.treeWidth') ?? '')
        return Number.isFinite(stored) && stored >= 220 ? stored : 320
    })
    const [resizing, setResizing] = React.useState(false)

    React.useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem('workspace.treeWidth', String(treeWidth))
    }, [treeWidth])

    React.useEffect(() => {
        if (!resizing || compactWorkspace) return

        const onPointerMove = (event: PointerEvent) => {
            const nextWidth = Math.min(640, Math.max(220, event.clientX))
            setTreeWidth(nextWidth)
        }
        const stop = () => setResizing(false)

        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', stop)
        window.addEventListener('pointercancel', stop)

        return () => {
            window.removeEventListener('pointermove', onPointerMove)
            window.removeEventListener('pointerup', stop)
            window.removeEventListener('pointercancel', stop)
        }
    }, [compactWorkspace, resizing])

    return (
        <div
            className={`workspace-pane${compactWorkspace ? ' is-compact' : ''}${resizing ? ' is-resizing' : ''}`}
            style={compactWorkspace ? undefined : ({ ['--workspace-tree-width' as string]: `${treeWidth}px` })}
        >
            <div className="workspace-pane__tree">
                <Tree
                    root={root}
                    sharedSteps={sharedSteps}
                    dirtyTestIds={dirtyTestIds}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMove={onMove}
                    onCreateFolderAt={onCreateFolderAt}
                    onCreateTestAt={onCreateTestAt}
                    onRename={onRename}
                    onDelete={onDelete}
                    onOpenStep={onOpenStep}
                />
            </div>
            {!compactWorkspace && (
                <div
                    className="workspace-pane__resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize workspace tree"
                    onPointerDown={(event) => {
                        event.preventDefault()
                        setResizing(true)
                    }}
                />
            )}
            <div className="workspace-pane__content">
                <div className="workspace-pane__scroll">{rightPane}</div>
                {syncCenter}
            </div>
        </div>
    )
}
