import * as React from 'react'
import { apiClient } from '@ipc/client'
import type { AtlassianSettings } from '@core/settings'
import type { AppInfo, AppUpdateCheckResult } from '@shared/appUpdates'
import { svgUrlToPngBuffer } from '../assets/icons/svgToPng'

export function useSettingsModalState(open: boolean) {
    const [loading, setLoading] = React.useState(true)
    const [login, setLogin] = React.useState('')
    const [baseUrl, setBaseUrl] = React.useState('')
    const [secret, setSecret] = React.useState('')
    const [hasSecret, setHasSecret] = React.useState(false)
    const [saved, setSaved] = React.useState<'idle' | 'ok' | 'err'>('idle')
    const [appInfo, setAppInfo] = React.useState<AppInfo | null>(null)
    const [updateInfo, setUpdateInfo] = React.useState<AppUpdateCheckResult | null>(null)
    const [updateError, setUpdateError] = React.useState<string | null>(null)
    const [checkingUpdates, setCheckingUpdates] = React.useState(false)
    const [windowIconDataUrl, setWindowIconDataUrl] = React.useState<string | null>(null)
    const [iconStatus, setIconStatus] = React.useState<'idle' | 'applying' | 'applied'>('idle')
    const loginRef = React.useRef<HTMLInputElement | null>(null)
    const secretRef = React.useRef<HTMLInputElement | null>(null)

    React.useEffect(() => {
        if (!open) return
        setLoading(true)
        setSaved('idle')
        setIconStatus('idle')
        setSecret('')
        setUpdateError(null)
        apiClient.loadSettings()
            .then((settings: AtlassianSettings) => {
                setLogin(settings.login ?? '')
                setBaseUrl(settings.baseUrl ?? '')
                setHasSecret(settings.hasSecret)
            })
            .finally(() => setLoading(false))
        apiClient.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null))
        apiClient.getWindowIcon().then(setWindowIconDataUrl).catch(() => setWindowIconDataUrl(null))
    }, [open])

    const save = React.useCallback(async (canSave: boolean, event?: React.FormEvent) => {
        event?.preventDefault()
        if (!canSave) return
        try {
            setLoading(true)
            const next = await apiClient.saveSettings(login.trim(), secret || undefined, baseUrl.trim())
            setHasSecret(next.hasSecret)
            setSaved('ok')
            setSecret('')
        } catch {
            setSaved('err')
        } finally {
            setLoading(false)
        }
    }, [baseUrl, login, secret])

    const checkUpdates = React.useCallback(async () => {
        try {
            setCheckingUpdates(true)
            setUpdateError(null)
            const result = await apiClient.checkForUpdates()
            setUpdateInfo(result)
        } catch (error) {
            setUpdateError(error instanceof Error ? error.message : String(error))
        } finally {
            setCheckingUpdates(false)
        }
    }, [])

    const applyIcon = React.useCallback(async (getDataUrl: () => Promise<string | null>) => {
        try {
            setIconStatus('applying')
            const dataUrl = await getDataUrl()
            if (dataUrl !== null) {
                setWindowIconDataUrl(dataUrl)
                setIconStatus('applied')
            } else {
                setIconStatus('idle')
            }
        } catch {
            setIconStatus('idle')
        }
    }, [])

    const setIconFromSvg = React.useCallback(async (svgUrl: string) => {
        await applyIcon(async () => {
            const pngBytes = await svgUrlToPngBuffer(svgUrl, 256)
            return apiClient.setWindowIcon(pngBytes)
        })
    }, [applyIcon])

    const setAntIcon = setIconFromSvg
    const setGhostIcon = setIconFromSvg

    const pickIconFile = React.useCallback(async () => {
        await applyIcon(() => apiClient.pickWindowIcon())
    }, [applyIcon])

    const resetIcon = React.useCallback(async () => {
        try {
            setIconStatus('applying')
            await apiClient.resetWindowIcon()
            setWindowIconDataUrl(null)
            setIconStatus('idle')
        } catch {
            setIconStatus('idle')
        }
    }, [])

    return {
        loading,
        login,
        baseUrl,
        secret,
        hasSecret,
        saved,
        appInfo,
        updateInfo,
        updateError,
        checkingUpdates,
        windowIconDataUrl,
        iconStatus,
        loginRef,
        secretRef,
        setLogin,
        setBaseUrl,
        setSecret,
        save,
        checkUpdates,
        setGhostIcon,
        setAntIcon,
        pickIconFile,
        resetIcon,
    }
}
