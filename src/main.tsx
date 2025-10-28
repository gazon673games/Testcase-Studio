import React from 'react'
import { createRoot } from 'react-dom/client'
import { useAppState } from './ui/useAppState'
import { Tree } from './ui/Tree'
import { Toolbar } from './ui/Toolbar'
import { isFolder, findNode } from '@core/tree'
import { SettingsModal } from './ui/Settings'
import { UiKit, useToast } from './ui/UiKit'

const TestEditor = React.lazy(() => import('./ui/TestEditor').then(m => ({ default: m.TestEditor })))
import type { TestEditorHandle } from './ui/TestEditor'

function AppShell() {
    const a = useAppState()
    const [settingsOpen, setSettingsOpen] = React.useState(false)
    const editorRef = React.useRef<TestEditorHandle | null>(null)
    const { push } = useToast()

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toLowerCase().includes('mac')
            const cmd = isMac ? e.metaKey : e.ctrlKey
            if (cmd && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave() }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSave = React.useCallback(async () => {
        editorRef.current?.commit?.()
        await a.save()
        push({ kind: 'success', text: 'Изменения сохранены', ttl: 2200 })
    }, [a, push])

    const selectWithCommit = React.useCallback((id: string) => {
        editorRef.current?.commit?.()
        a.select(id)
    }, [a])

    if (!a.state) {
        return <div style={{ padding: 16, fontFamily: 'system-ui' }}><h1>Loading…</h1></div>
    }

    const selected = a.selectedId ? findNode(a.state.root, a.selectedId) : null
    const allTests = a.mapAllTests()
    const rightPane = !selected || isFolder(selected as any)
        ? <EmptyPanel />
        : <React.Suspense fallback={<div style={{ padding: 16 }}>Loading editor…</div>}>
            <TestEditor
                ref={editorRef}
                test={selected as any}
                onChange={(p: any) => a.updateTest((selected as any).id, p)}
                focusStepId={a.focusStepId}
                allTests={allTests}
            />
        </React.Suspense>

    return (
        <div style={{ height:'100vh', display:'flex', flexDirection:'column', fontFamily:'system-ui' }}>
            <Toolbar
                onAddFolder={a.addFolder} onAddTest={a.addTest} onDelete={a.removeSelected}
                onSave={handleSave} onPull={a.pull} onPush={a.push} onSyncAll={a.syncAll}
                onOpenSettings={() => setSettingsOpen(true)}
            />
            <div style={{flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr', minHeight: 0}}>
                <div style={{borderRight: '1px solid #eee', overflow: 'auto'}}>
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
                <div style={{overflow: 'auto'}}>
                    {rightPane}
                </div>
            </div>
            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)}/>
        </div>
    )
}

function App() {
    return (
        <UiKit>
            <AppShell/>
        </UiKit>
    )
}

function EmptyPanel() {
    return <div style={{padding: 16, color: '#666'}}>Выберите тест в дереве, чтобы редактировать.</div>
}

createRoot(document.getElementById('root')!).render(<App/>)
