import * as React from 'react'
import { UiKit } from '../uiKit'
import { UiPreferencesProvider } from '../preferences'
import { getStoredLocale, translate } from '@shared/i18n'
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
    const locale = React.useMemo(() => getStoredLocale(), [])
    const title = React.useMemo(() => translate('app.unexpectedError', undefined, locale), [locale])
    const actionLabel = React.useMemo(() => translate('app.reload', undefined, locale), [locale])

    return (
        <AppErrorBoundary title={title} actionLabel={actionLabel}>
            <UiKit>
                <AppShell />
            </UiKit>
        </AppErrorBoundary>
    )
}
