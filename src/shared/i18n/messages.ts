import { appMessages } from './catalog/app'
import { attachmentsMessages } from './catalog/attachments'
import { confirmMessages } from './catalog/confirm'
import { defaultsMessages } from './catalog/defaults'
import { detailsMessages } from './catalog/details'
import { editorMessages } from './catalog/editor'
import { importMessages } from './catalog/import'
import { includedCasesMessages } from './catalog/includedCases'
import { markdownMessages } from './catalog/markdown'
import { overviewMessages } from './catalog/overview'
import { paramsMessages } from './catalog/params'
import { previewMessages } from './catalog/preview'
import { publishMessages } from './catalog/publish'
import { refsMessages } from './catalog/refs'
import { settingsMessages } from './catalog/settings'
import { sharedMessages } from './catalog/shared'
import { stepsMessages } from './catalog/steps'
import { syncMessages } from './catalog/sync'
import { toastMessages } from './catalog/toast'
import { toolbarMessages } from './catalog/toolbar'
import { treeMessages } from './catalog/tree'

const catalogs = [
    appMessages,
    attachmentsMessages,
    confirmMessages,
    defaultsMessages,
    detailsMessages,
    editorMessages,
    importMessages,
    includedCasesMessages,
    markdownMessages,
    overviewMessages,
    paramsMessages,
    previewMessages,
    publishMessages,
    refsMessages,
    settingsMessages,
    sharedMessages,
    stepsMessages,
    syncMessages,
    toastMessages,
    toolbarMessages,
    treeMessages,
] as const

export const messages = {
    ru: Object.assign({}, ...catalogs.map((catalog) => catalog.ru)),
    en: Object.assign({}, ...catalogs.map((catalog) => catalog.en)),
} as const
