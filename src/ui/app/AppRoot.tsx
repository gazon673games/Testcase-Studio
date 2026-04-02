import * as React from 'react'
import { UiKit } from '../uiKit'
import { UiPreferencesProvider, useUiPreferences } from '../preferences'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppShell } from './AppShell'

export function App() {
    return (
        <UiPreferencesProvider>
            <AppWithBoundary />
        </UiPreferencesProvider>
    )
}

function AppWithBoundary() {
    const { t } = useUiPreferences()

    return (
        <AppErrorBoundary title={t('app.unexpectedError')} actionLabel={t('app.reload')}>
            <UiKit>
                <AppShell />
            </UiKit>
        </AppErrorBoundary>
    )
}
