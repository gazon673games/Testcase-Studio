import { IpcSyncEngine, createSyncText, type SyncService } from '@app/sync'
import { apiClient } from '@ipc/client'
import type { MessageKey } from '../preferences'

type AppTranslate = (key: MessageKey, params?: Record<string, string | number>) => string

export type AppServices = {
    sync: SyncService
    defaults: {
        rootLabel: string
        newFolder: string
        newCase: string
        firstStep: string
        sharedStep: string
    }
}

export function createAppServices(t: AppTranslate): AppServices {
    return {
        sync: new IpcSyncEngine(apiClient, createSyncText(t)),
        defaults: {
            rootLabel: t('defaults.root'),
            newFolder: t('defaults.newFolder'),
            newCase: t('defaults.newCase'),
            firstStep: t('defaults.firstStep'),
            sharedStep: t('defaults.sharedStep'),
        },
    }
}
