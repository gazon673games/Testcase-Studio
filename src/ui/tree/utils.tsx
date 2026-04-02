import * as React from 'react'
import type { Folder, Step, TestCase } from '@core/domain'
import { isFolder } from '@core/tree'
import { translate } from '../preferences'
import type { SyncStatus, TreeTranslate, ViewNode, VisibleItem } from './types'

export type TreeViewState = {
    visibleItems: VisibleItem[]
    visibleIndexByKey: Map<string, number>
    syncStatusById: Map<string, SyncStatus>
    testHeadlineById: Map<string, string>
    stepLabelByKey: Map<string, string>
}

export function summarizeStepHeadline(
    steps: Step[],
    t: TreeTranslate = translate,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
): string {
    if (!steps.length) return t('tree.noSteps')
    const first = summarizePlainText(resolveDisplayText(buildCompositeActionText(steps[0]) || t('tree.untitledStep')), 42, t)
    return steps.length === 1 ? first : `${first} +${steps.length - 1}`
}

export function summarizeStepLabel(
    step: Step,
    t: TreeTranslate = translate,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
): string {
    return summarizePlainText(resolveDisplayText(buildCompositeActionText(step) || t('tree.untitledStep')), 68, t)
}

export function buildCompositeActionText(step: Pick<Step, 'action' | 'text' | 'internal'>): string {
    const topLevel = String(step.action ?? step.text ?? '').trim()
    const blocks = (step.internal?.parts?.action ?? []).map((part) => String(part.text ?? '').trim()).filter(Boolean)
    return [topLevel, ...blocks].filter(Boolean).join('\n').trim()
}

export function summarizePlainText(
    value: string,
    maxLength: number,
    t: TreeTranslate = translate
): string {
    const text = value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text) return t('tree.untitled')
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

export function toPreviewishPlainText(value: string): string {
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

export function flattenVisibleItems(
    root: Folder,
    expanded: Set<string>
) {
    const items: VisibleItem[] = []

    const walk = (node: ViewNode, depth: number, parentKey?: string) => {
        const id = node.id
        const key = makeNodeKey(id)
        const dir = isFolder(node)
        const hasChildren = dir ? node.children.length > 0 : node.steps.length > 0
        const isOpen = expanded.has(id)
        items.push({
            key,
            kind: dir ? 'folder' : 'test',
            id,
            parentKey,
            depth,
            hasChildren,
            expanded: isOpen,
            name: node.name,
        })

        if (!isOpen || !hasChildren) return

        if (dir) {
            for (const child of node.children) walk(child, depth + 1, key)
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
                })
            }
        }
    }

    walk(root, 0)
    return items
}

export function buildTreeViewState(
    root: Folder,
    expanded: Set<string>,
    dirtyTestIds: Set<string>,
    t: TreeTranslate = translate,
    resolveDisplayText: (value: string | undefined) => string = (value) => String(value ?? '')
): TreeViewState {
    const visibleItems: VisibleItem[] = []
    const visibleIndexByKey = new Map<string, number>()
    const syncStatusById = new Map<string, SyncStatus>()
    const testHeadlineById = new Map<string, string>()
    const stepLabelByKey = new Map<string, string>()

    const pushVisibleItem = (item: VisibleItem) => {
        visibleIndexByKey.set(item.key, visibleItems.length)
        visibleItems.push(item)
    }

    const walkSyncOnly = (node: ViewNode): SyncStatus | null => {
        if (!isFolder(node)) {
            const status = dirtyTestIds.has(node.id) ? 'dirty' : null
            if (status) syncStatusById.set(node.id, status)
            return status
        }

        let status: SyncStatus | null = null
        for (const child of node.children) {
            if (walkSyncOnly(child) === 'dirty') status = 'dirty'
        }

        if (status) syncStatusById.set(node.id, status)
        return status
    }

    const walkVisible = (node: ViewNode, depth: number, parentKey?: string): SyncStatus | null => {
        const id = node.id
        const key = makeNodeKey(id)
        const dir = isFolder(node)
        const hasChildren = dir ? node.children.length > 0 : node.steps.length > 0
        const isOpen = expanded.has(id)

        pushVisibleItem({
            key,
            kind: dir ? 'folder' : 'test',
            id,
            parentKey,
            depth,
            hasChildren,
            expanded: isOpen,
            name: node.name,
        })

        if (!dir) {
            testHeadlineById.set(id, summarizeStepHeadline(node.steps, t, resolveDisplayText))

            const status = dirtyTestIds.has(id) ? 'dirty' : null
            if (status) syncStatusById.set(id, status)

            if (isOpen && hasChildren) {
                node.steps.forEach((step) => {
                    const stepKey = makeStepKey(id, step.id)
                    pushVisibleItem({
                        key: stepKey,
                        kind: 'step',
                        id: step.id,
                        testId: id,
                        parentKey: key,
                        depth: depth + 1,
                        hasChildren: false,
                        expanded: false,
                    })
                    stepLabelByKey.set(stepKey, summarizeStepLabel(step, t, resolveDisplayText))
                })
            }

            return status
        }

        let status: SyncStatus | null = null

        if (isOpen && hasChildren) {
            for (const child of node.children) {
                if (walkVisible(child, depth + 1, key) === 'dirty') status = 'dirty'
            }
        } else {
            for (const child of node.children) {
                if (walkSyncOnly(child) === 'dirty') status = 'dirty'
            }
        }

        if (status) syncStatusById.set(id, status)
        return status
    }

    walkVisible(root, 0)

    return {
        visibleItems,
        visibleIndexByKey,
        syncStatusById,
        testHeadlineById,
        stepLabelByKey,
    }
}

export function buildNodeSyncStatusIndex(root: Folder, dirtyTestIds: Set<string>) {
    const statusById = new Map<string, SyncStatus>()

    const walk = (node: ViewNode): SyncStatus | null => {
        if (!isFolder(node)) {
            const status = dirtyTestIds.has(node.id) ? 'dirty' : null
            if (status) statusById.set(node.id, status)
            return status
        }

        let status: SyncStatus | null = null
        for (const child of node.children) {
            if (walk(child) === 'dirty') status = 'dirty'
        }

        if (status) statusById.set(node.id, status)
        return status
    }

    walk(root)
    return statusById
}

export function renderSyncStatusBadge(status: SyncStatus | null, t: TreeTranslate) {
    if (!status) return null
    if (status === 'dirty') {
        return (
            <span
                aria-label={t('tree.sync.dirtyTitle')}
                title={t('tree.sync.dirtyTitle')}
                className="tree-dirty-indicator"
            />
        )
    }
    return null
}

export function ChevronIcon({ open }: { open: boolean }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 12 12"
            width="12"
            height="12"
            className={`tree-chevron${open ? ' is-open' : ''}`}
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

export function clampMenuPosition(x: number, y: number) {
    if (typeof window === 'undefined') return { left: x, top: y }
    const width = 188
    const height = 180
    const gutter = 12
    return {
        left: Math.max(gutter, Math.min(x, window.innerWidth - width - gutter)),
        top: Math.max(gutter, Math.min(y, window.innerHeight - height - gutter)),
    }
}

export function makeNodeKey(id: string) {
    return `node:${id}`
}

export function makeStepKey(testId: string, stepId: string) {
    return `step:${testId}:${stepId}`
}
