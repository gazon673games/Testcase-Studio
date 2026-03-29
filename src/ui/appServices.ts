import { SyncEngine, createSyncText } from '@app/sync'
import { AllureStubProvider } from '@providers/allure.stub'
import { ZephyrHttpProvider } from '@providers/zephyr.http'
import type { MessageKey } from './preferences'

type AppTranslate = (key: MessageKey, params?: Record<string, string | number>) => string

export type AppServices = {
    sync: SyncEngine
    defaults: {
        rootLabel: string
        newFolder: string
        newCase: string
        firstStep: string
        sharedStep: string
    }
}

export function createAppServices(t: AppTranslate): AppServices {
    const providers = {
        zephyr: new ZephyrHttpProvider(),
        allure: new AllureStubProvider(),
    }

    return {
        sync: new SyncEngine(providers, createSyncText(t)),
        defaults: {
            rootLabel: t('defaults.root'),
            newFolder: t('defaults.newFolder'),
            newCase: t('defaults.newCase'),
            firstStep: t('defaults.firstStep'),
            sharedStep: t('defaults.sharedStep'),
        },
    }
}
