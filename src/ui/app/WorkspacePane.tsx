import React from 'react'
import type { Folder } from '@core/domain'
import { Tree } from '../Tree'

type SharedStepListItem = { id: string; name: string }

type WorkspacePaneProps = {
    compactWorkspace: boolean
    root: Folder
    sharedSteps: SharedStepListItem[]
    dirtyTestIds: Set<string>
    selectedId: string | null
    onSelect(id: string): void
    onMove(sourceId: string, targetFolderId: string): void
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
    return (
        <div
            style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: compactWorkspace ? '1fr' : 'minmax(260px, 320px) 1fr',
                gridTemplateRows: compactWorkspace ? 'minmax(210px, 34vh) 1fr' : undefined,
                minHeight: 0,
            }}
        >
            <div
                style={{
                    borderRight: compactWorkspace ? 'none' : '1px solid var(--border)',
                    borderBottom: compactWorkspace ? '1px solid var(--border)' : 'none',
                    overflow: 'auto',
                    background: 'var(--bg-soft)',
                }}
            >
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
            <div
                style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--bg)',
                }}
            >
                <div style={{ height: '100%', overflow: 'auto' }}>{rightPane}</div>
                {syncCenter}
            </div>
        </div>
    )
}
