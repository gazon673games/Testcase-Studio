import * as React from 'react'
import type { ZephyrImportPreview, ZephyrPublishPreview } from '@app/sync'
import { buildExport } from '@core/export'
import { findNode, isFolder } from '@core/tree'
import type { useAppState } from '../../state/useAppState'
import type { useToast } from '../../uiKit'
import type { TestEditorHandle } from '../../testEditor/TestEditor'

type AppStateApi = ReturnType<typeof useAppState>
type ToastPush = ReturnType<typeof useToast>['push']
type Translate = (key: any, params?: Record<string, string | number>) => string

type UseAppShellActionsOptions = {
    app: AppStateApi
    editorRef: React.MutableRefObject<TestEditorHandle | null>
    push: ToastPush
    t: Translate
    closeSyncCenter(): void
}

export function useAppShellActions({
    app,
    editorRef,
    push,
    t,
    closeSyncCenter,
}: UseAppShellActionsOptions) {
    const handleSave = React.useCallback(async () => {
        const committed = editorRef.current?.commit?.() ?? false
        const shouldAnnounceSave = committed || app.saveState !== 'saved'

        try {
            const saved = await app.save()
            if (saved && shouldAnnounceSave) {
                push({ kind: 'success', text: t('toast.changesSaved'), ttl: 2200 })
            }
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.saveFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 3500,
            })
        }
    }, [app, editorRef, push, t])

    const handleExport = React.useCallback(async () => {
        editorRef.current?.commit?.()

        if (!app.state || !app.selectedId) {
            push({ kind: 'error', text: t('toast.selectCaseBeforeExport'), ttl: 2500 })
            return
        }

        const node = findNode(app.state.root, app.selectedId)
        if (!node || isFolder(node)) {
            push({ kind: 'error', text: t('toast.exportOnlyForCase'), ttl: 2500 })
            return
        }

        try {
            const exported = buildExport(node, app.state)
            const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = `test-${node.name || node.id}.json`
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            URL.revokeObjectURL(url)

            push({ kind: 'success', text: t('toast.caseExported'), ttl: 2500 })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.exportFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 3500,
            })
        }
    }, [app, editorRef, push, t])

    const handleApplyImport = React.useCallback(async (preview: ZephyrImportPreview) => {
        closeSyncCenter()
        const result = await app.applyZephyrImport(preview)
        push({
            kind: 'success',
            text: t('toast.importApplied', {
                created: result.created,
                updated: result.updated,
                skipped: result.skipped,
                drafts: result.drafts,
                unchanged: result.unchanged,
            }),
            ttl: 0,
        })
        return result
    }, [app, closeSyncCenter, push, t])

    const handleApplyPublish = React.useCallback(async (preview: ZephyrPublishPreview) => {
        closeSyncCenter()
        const result = await app.publishZephyr(preview)
        const firstFailure = result.logItems.find((item) => item.status === 'failed' || item.status === 'blocked')
        const failureHint = firstFailure
            ? `\n- ${firstFailure.testName}: ${firstFailure.error ?? firstFailure.reason ?? 'Unknown error'}`
            : ''
        push({
            kind: result.failed ? 'error' : 'success',
            text: t('toast.publishFinished', {
                created: result.created,
                updated: result.updated,
                skipped: result.skipped,
                failed: result.failed,
                blocked: result.blocked,
                snapshotPath: result.snapshotPath || '-',
                logPath: result.logPath || '-',
            }) + failureHint,
            ttl: 0,
        })
        return result
    }, [app, closeSyncCenter, push, t])

    const handlePull = React.useCallback(async () => {
        try {
            const result = await app.pull()
            if (result.status === 'ok') {
                push({
                    kind: 'success',
                    text: t('toast.pullSuccess', { externalId: result.externalId || 'Zephyr' }),
                    ttl: 0,
                })
                return
            }

            push({
                kind: 'error',
                text: t(result.status === 'no-link' ? 'toast.pullNoLink' : 'toast.pullNoSelection'),
                ttl: 0,
            })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.pullFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 0,
            })
        }
    }, [app, push, t])

    const handlePush = React.useCallback(async () => {
        try {
            editorRef.current?.commit?.()
            const result = await app.push()
            if (!result || result.status !== 'ok') {
                push({
                    kind: 'error',
                    text: t('toast.pushNoSelection'),
                    ttl: 0,
                })
                return
            }

            const firstFailure = result.result.logItems.find((item) => item.status === 'failed' || item.status === 'blocked')
            const failureHint = firstFailure
                ? `\n- ${firstFailure.testName}: ${firstFailure.error ?? firstFailure.reason ?? 'Unknown error'}`
                : ''
            push({
                kind: result.result.failed || result.result.blocked ? 'error' : 'success',
                text: t('toast.publishFinished', {
                    created: result.result.created,
                    updated: result.result.updated,
                    skipped: result.result.skipped,
                    failed: result.result.failed,
                    blocked: result.result.blocked,
                    snapshotPath: result.snapshotPath || '-',
                    logPath: result.logPath || '-',
                }) + failureHint,
                ttl: 0,
            })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.pushFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 0,
            })
        }
    }, [app, push, t])

    const handleQuickSync = React.useCallback(async () => {
        try {
            const result = await app.syncAll()
            push({
                kind: 'success',
                text: t('toast.quickSyncSuccess', { count: result.count }),
                ttl: 0,
            })
        } catch (error) {
            push({
                kind: 'error',
                text: t('toast.quickSyncFailed', {
                    message: error instanceof Error ? error.message : String(error),
                }),
                ttl: 0,
            })
        }
    }, [app, push, t])

    const selectWithCommit = React.useCallback((id: string) => {
        app.select(id)
    }, [app])

    return {
        handleSave,
        handleExport,
        handleApplyImport,
        handleApplyPublish,
        handlePull,
        handlePush,
        handleQuickSync,
        selectWithCommit,
    }
}
