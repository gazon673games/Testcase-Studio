import React from 'react'
import type { Folder, SharedStep } from '@core/domain'
import { Tree } from '../Tree'

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
    return (
        <div className={`workspace-pane${compactWorkspace ? ' is-compact' : ''}`}>
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
            <div className="workspace-pane__content">
                <div className="workspace-pane__scroll">{rightPane}</div>
                {syncCenter}
            </div>
        </div>
    )
}
