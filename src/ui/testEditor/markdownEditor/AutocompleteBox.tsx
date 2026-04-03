import * as React from 'react'
import { createPortal } from 'react-dom'
import type { AutoItem, AutoStage } from './autocomplete'

type AutocompleteBoxProps = {
    top: number
    left: number
    stage: AutoStage
    stageLabel: string
    emptyLabel: string
    items: AutoItem[]
    index: number
    horizontalScroll: number
    onPick(item: AutoItem): void
    onClose(): void
}

export const AutocompleteBox: React.FC<AutocompleteBoxProps> = ({
    top,
    left,
    stage,
    stageLabel,
    emptyLabel,
    items,
    index,
    horizontalScroll,
    onPick,
    onClose,
}) => {
    const detailRefs = React.useRef<Record<number, HTMLDivElement | null>>({})
    const itemRefs = React.useRef<Record<number, HTMLDivElement | null>>({})
    const rootRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    React.useEffect(() => {
        const onScroll = () => onClose()
        window.addEventListener('scroll', onScroll, true)
        return () => window.removeEventListener('scroll', onScroll, true)
    }, [onClose])

    React.useEffect(() => {
        const detail = detailRefs.current[index]
        if (!detail) return
        const maxScroll = Math.max(0, detail.scrollWidth - detail.clientWidth)
        detail.scrollLeft = Math.min(horizontalScroll, maxScroll)
    }, [horizontalScroll, index, items])

    React.useEffect(() => {
        itemRefs.current[index]?.scrollIntoView({ block: 'nearest' })
    }, [index])

    React.useLayoutEffect(() => {
        if (!rootRef.current) return
        rootRef.current.style.top = `${top}px`
        rootRef.current.style.left = `${left}px`
    }, [left, top])

    const content = (
        <div
            ref={rootRef}
            className="autocomplete"
            role="listbox"
            aria-label={stageLabel}
            data-stage={stage}
        >
            <div className="autocomplete-stage">{stageLabel}</div>
            {items.length === 0 ? (
                <div className="autocomplete-empty">{emptyLabel}</div>
            ) : (
                items.map((item, itemIndex) => (
                    <div
                        key={`${item.insert}-${itemIndex}`}
                        ref={(element) => {
                            itemRefs.current[itemIndex] = element
                        }}
                        onMouseDown={(event) => {
                            event.preventDefault()
                            onPick(item)
                        }}
                        className={`autocomplete-item ${itemIndex === index ? 'active' : ''}${item.muted ? ' muted' : ''}`}
                        role="option"
                        aria-selected={itemIndex === index}
                        title={item.insert}
                    >
                        <div className="autocomplete-item-main">{item.label}</div>
                        {item.detail ? (
                            <div
                                ref={(element) => {
                                    detailRefs.current[itemIndex] = element
                                }}
                                className="autocomplete-item-detail"
                            >
                                {item.detail}
                            </div>
                        ) : null}
                    </div>
                ))
            )}
        </div>
    )

    if (typeof document === 'undefined') return content
    return createPortal(content, document.body)
}
