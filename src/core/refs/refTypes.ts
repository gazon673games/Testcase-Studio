import type { SharedStep, TestCase } from '../domain'

export type RefOwnerType = 'test' | 'shared'
export type RefKind = 'action' | 'data' | 'expected'

export type RefOwner =
    | { ownerType: 'test'; owner: TestCase }
    | { ownerType: 'shared'; owner: SharedStep }

export interface RefCatalog {
    testsById: Map<string, TestCase>
    testsByName: Map<string, TestCase[]>
    sharedById: Map<string, SharedStep>
    sharedByName: Map<string, SharedStep[]>
}

export interface ParsedWikiRef {
    raw: string
    body: string
    image: boolean
    ownerType?: RefOwnerType
    ownerId?: string
    ownerName?: string
    stepId?: string
    stepIndex?: number
    kind: RefKind
    partId?: string
    canonical: boolean
}

export interface ResolvedWikiRef {
    raw: string
    body: string
    image: boolean
    ok: boolean
    canonical: boolean
    ownerType?: RefOwnerType
    ownerId?: string
    ownerName?: string
    stepId?: string
    kind: RefKind
    partId?: string
    preview: string
    label: string
    brokenReason?: string
    brokenReasonCode?: 'source-ambiguous' | 'source-missing' | 'step-missing' | 'part-missing' | 'field-empty' | 'cycle-detected'
}

export type ResolveRefsMode = 'plain' | 'html'

export interface ResolveRefsInTextOptions {
    mode?: ResolveRefsMode
}

export interface SharedUsage {
    id: string
    ownerType: RefOwnerType
    ownerId: string
    ownerName: string
    sourceStepId?: string
    sourceLabel: string
    kind: 'usesShared' | 'ref'
    raw?: string
}
