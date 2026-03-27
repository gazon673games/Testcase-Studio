import React from 'react'
import { createRoot } from 'react-dom/client'
import { useAppState } from './ui/useAppState'
import { Tree } from './ui/Tree'
import { Toolbar } from './ui/Toolbar'
import { isFolder, findNode } from '@core/tree'
import { SettingsModal } from './ui/Settings'
import { UiKit, useToast } from './ui/UiKit'
import { buildExport } from '@core/export' // 🔹 добавили импорт

const TestEditor = React.lazy(() =>
    import('./ui/testEditor/TestEditor').then((m) => ({ default: m.TestEditor })),
)
import type { TestEditorHandle } from './ui/testEditor/TestEditor'

function AppShell() {
    const a = useAppState()
    const [settingsOpen, setSettingsOpen] = React.useState(false)
    const editorRef = React.useRef<TestEditorHandle | null>(null)
    const { push } = useToast()

    // Ctrl/Cmd+S — сохранение
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac')
            const cmd = isMac ? e.metaKey : e.ctrlKey
            if (cmd && e.key.toLowerCase() === 's') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // 💾 сохранение
    const handleSave = React.useCallback(async () => {
        editorRef.current?.commit?.()
        await a.save()
        push({ kind: 'success', text: 'Изменения сохранены', ttl: 2200 })
    }, [a, push])

    // 📤 экспорт
    const handleExport = React.useCallback(async () => {
        editorRef.current?.commit?.()

        if (!a.state || !a.selectedId) {
            push({ kind: 'error', text: 'Нет выбранного теста для экспорта', ttl: 2500 })
            return
        }

        const node = findNode(a.state.root, a.selectedId)
        if (!node || isFolder(node)) {
            push({ kind: 'error', text: 'Выбран не тест, а папка', ttl: 2500 })
            return
        }

        // 1️⃣ собираем канонический экспорт
        const exp = buildExport(node, a.state)

        // 2️⃣ создаём JSON
        const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)

        // 3️⃣ инициируем скачивание
        const link = document.createElement('a')
        link.href = url
        link.download = `test-${node.name || node.id}.json`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)

        push({ kind: 'success', text: 'Тест экспортирован в JSON', ttl: 2500 })
    }, [a, push])

    // переключение тестов с коммитом драфта
    const selectWithCommit = React.useCallback(
        (id: string) => {
            editorRef.current?.commit?.()
            a.select(id)
        },
        [a],
    )

    if (!a.state) {
        return (
            <div style={{ padding: 16, fontFamily: 'system-ui' }}>
                <h1>Loading…</h1>
            </div>
        )
    }

    const selected = a.selectedId ? findNode(a.state.root, a.selectedId) : null
    const allTests = a.mapAllTests()
    const rightPane =
        !selected || isFolder(selected as any) ? (
            <EmptyPanel />
        ) : (
            <React.Suspense fallback={<div style={{ padding: 16 }}>Loading editor…</div>}>
                <TestEditor
                    ref={editorRef}
                    test={selected as any}
                    onChange={(p: any) => a.updateTest((selected as any).id, p)}
                    focusStepId={a.focusStepId}
                    allTests={allTests}
                    sharedSteps={a.state.sharedSteps}
                    onAddSharedStep={a.addSharedStep}
                    onAddSharedStepFromStep={a.addSharedStepFromStep}
                    onUpdateSharedStep={a.updateSharedStep}
                    onDeleteSharedStep={a.deleteSharedStep}
                    onInsertSharedReference={(sharedId: string) => a.insertSharedReference((selected as any).id, sharedId)}
                    onOpenStep={a.openStep}
                    onOpenTest={a.select}
                />
            </React.Suspense>
        )

    return (
        <div
            style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'system-ui',
            }}
        >
            <Toolbar
                onAddFolder={a.addFolder}
                onAddTest={a.addTest}
                onDelete={a.removeSelected}
                onSave={handleSave}
                onPull={a.pull}
                onPush={a.push}
                onSyncAll={a.syncAll}
                onExport={handleExport} // ✅ экспорт теперь работает
                onOpenSettings={() => setSettingsOpen(true)}
            />

            <div
                style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: '320px 1fr',
                    minHeight: 0,
                }}
            >
                <div style={{ borderRight: '1px solid #eee', overflow: 'auto' }}>
                    <Tree
                        root={a.state.root}
                        selectedId={a.selectedId}
                        onSelect={selectWithCommit}
                        onMove={a.moveNode}
                        onCreateFolderAt={a.addFolderAt}
                        onCreateTestAt={a.addTestAt}
                        onRename={a.renameNode}
                        onDelete={a.deleteNodeById}
                        onOpenStep={a.openStep}
                    />
                </div>
                <div style={{ overflow: 'auto' }}>{rightPane}</div>
            </div>

            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
    )
}

function App() {
    return (
        <UiKit>
            <AppShell />
        </UiKit>
    )
}

function EmptyPanel() {
    return (
        <div style={{ padding: 16, color: '#666' }}>
            Выберите тест в дереве, чтобы редактировать.
        </div>
    )
}

createRoot(document.getElementById('root')!).render(<App />)
