import * as React from 'react'
import type { TreeTranslate } from './types'
import { clampMenuPosition } from './utils'

type TreeMenuProps = {
    x: number
    y: number
    isRoot: boolean
    isFolder: boolean
    t: TreeTranslate
    onClose(): void
    onNewFolder(): void
    onNewTest(): void
    onRename(): void
    onDelete(): void
}

export function TreeMenu({
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
}: TreeMenuProps) {
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
            className="tree-menu"
            style={{ left, top }}
            onMouseDown={(event) => event.stopPropagation()}
        >
            {isFolder && (
                <>
                    <TreeMenuItem ref={firstItemRef} label={t('tree.newFolder')} onClick={() => { onNewFolder(); onClose() }} />
                    <TreeMenuItem label={t('tree.newCase')} onClick={() => { onNewTest(); onClose() }} />
                </>
            )}
            {!isFolder && <TreeMenuItem ref={firstItemRef} label={t('tree.rename')} disabled={isRoot} onClick={() => { onRename(); onClose() }} />}
            {isFolder && <TreeMenuItem label={t('tree.rename')} disabled={isRoot} onClick={() => { onRename(); onClose() }} />}
            <TreeMenuItem label={t('tree.delete')} disabled={isRoot} danger onClick={() => { onDelete(); onClose() }} />
        </div>
    )
}

const TreeMenuItem = React.forwardRef<
    HTMLButtonElement,
    {
        label: string
        onClick(): void
        danger?: boolean
        disabled?: boolean
    }
>(function TreeMenuItem({ label, onClick, danger, disabled }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            role="menuitem"
            onClick={() => {
                if (!disabled) onClick()
            }}
            disabled={disabled}
            className={[
                'tree-menu__item',
                danger ? 'is-danger' : '',
                disabled ? 'is-disabled' : '',
            ].filter(Boolean).join(' ')}
        >
            {label}
        </button>
    )
})
