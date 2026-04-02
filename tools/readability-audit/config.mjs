export const roots = ['src', 'electron']
export const extensions = new Set(['.ts', '.tsx'])

export const genericNames = new Set([
    'item',
    'items',
    'value',
    'values',
    'data',
    'raw',
    'obj',
    'tmp',
    'temp',
    'current',
    'next',
    'entry',
    'entries',
    'source',
    'target',
    'payload',
    'result',
    'results',
    'res',
    'input',
    'output',
])

export const allowedShortNames = new Set(['i', 'j', 'k', 'x', 'y', 'e', 't', 'id', 'ok', 'ui'])

export const hookWeights = new Map([
    ['useState', 2],
    ['useEffect', 3],
    ['useMemo', 1],
    ['useCallback', 1],
    ['useRef', 1],
    ['useReducer', 2],
])

export const aliasZones = [
    ['@app/', 'application'],
    ['@core/', 'core'],
    ['@shared/', 'shared'],
    ['@providers/', 'providers'],
    ['@ipc/', 'ipc'],
]

export const forbiddenImports = {
    core: new Set(['ui', 'providers', 'ipc', 'electron']),
    application: new Set(['ui', 'electron']),
    providers: new Set(['ui', 'electron']),
    ui: new Set(['electron', 'providers']),
    ipc: new Set(['ui']),
    electron: new Set(['ui']),
    entry: new Set(['electron']),
}
