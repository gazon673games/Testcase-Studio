import type { ZephyrImportRequest } from './types'
import { dedupeRefs, escapeQueryValue } from './shared'

export function buildZephyrImportQuery(request: ZephyrImportRequest): string {
    const override = String(request.rawQuery ?? '').trim()
    if (override) return override

    if (request.mode === 'project') {
        const projectKey = String(request.projectKey ?? '').trim()
        return projectKey ? `projectKey = "${escapeQueryValue(projectKey)}"` : ''
    }

    if (request.mode === 'folder') {
        const clauses: string[] = []
        const projectKey = String(request.projectKey ?? '').trim()
        const folder = String(request.folder ?? '').trim()
        if (projectKey) clauses.push(`projectKey = "${escapeQueryValue(projectKey)}"`)
        if (folder) clauses.push(`folder = "${escapeQueryValue(folder)}"`)
        return clauses.join(' AND ')
    }

    const refs = dedupeRefs(request.refs ?? [])
    return refs.length ? `key IN (${refs.map((ref) => `"${escapeQueryValue(ref)}"`).join(', ')})` : ''
}
