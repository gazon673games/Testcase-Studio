import * as React from 'react'
import type {
    ZephyrImportMode,
    ZephyrImportPreview,
    ZephyrImportStrategy,
} from '@app/sync'
import type { ImportStatusFilter } from './zephyrImportModalDerived'

export function useZephyrImportModalState() {
    const projectInputRef = React.useRef<HTMLInputElement | null>(null)
    const folderInputRef = React.useRef<HTMLInputElement | null>(null)
    const refsInputRef = React.useRef<HTMLTextAreaElement | null>(null)
    const itemRefs = React.useRef<Record<string, HTMLDivElement | null>>({})

    const [mode, setMode] = React.useState<ZephyrImportMode>('project')
    const [projectKey, setProjectKey] = React.useState('')
    const [folder, setFolder] = React.useState('')
    const [refsText, setRefsText] = React.useState('')
    const [rawQuery, setRawQuery] = React.useState('')
    const [maxResults, setMaxResults] = React.useState('100')
    const [mirrorRemoteFolders, setMirrorRemoteFolders] = React.useState(true)
    const [loading, setLoading] = React.useState(false)
    const [applying, setApplying] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const [preview, setPreview] = React.useState<ZephyrImportPreview | null>(null)
    const [strategies, setStrategies] = React.useState<Record<string, ZephyrImportStrategy>>({})
    const [statusFilter, setStatusFilter] = React.useState<ImportStatusFilter>('all')
    const [showUnchanged, setShowUnchanged] = React.useState(false)

    return {
        refs: {
            projectInputRef,
            folderInputRef,
            refsInputRef,
            itemRefs,
        },
        formState: {
            mode,
            projectKey,
            folder,
            refsText,
            rawQuery,
            maxResults,
            mirrorRemoteFolders,
        },
        formActions: {
            setMode,
            setProjectKey,
            setFolder,
            setRefsText,
            setRawQuery,
            setMaxResults,
            setMirrorRemoteFolders,
        },
        statusState: {
            loading,
            applying,
            error,
        },
        statusActions: {
            setLoading,
            setApplying,
            setError,
        },
        previewState: {
            preview,
            strategies,
            statusFilter,
            showUnchanged,
        },
        previewActions: {
            setPreview,
            setStrategies,
            setStatusFilter,
            setShowUnchanged,
        },
    }
}
