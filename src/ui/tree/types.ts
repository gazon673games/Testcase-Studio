import type * as React from 'react'
import type { Folder, TestCase } from '@core/domain'

export type ViewNode = Folder | TestCase

export type ContextMenuState =
    | { x: number; y: number; targetId: string; targetIsFolder: boolean; targetName: string }
    | null

export type EditingState = { id: string; value: string } | null

export type VisibleItem =
    | {
          key: string
          kind: 'folder' | 'test'
          id: string
          parentKey?: string
          depth: number
          hasChildren: boolean
          expanded: boolean
          name: string
      }
    | {
          key: string
          kind: 'step'
          id: string
          testId: string
          parentKey: string
          depth: number
          hasChildren: false
          expanded: false
      }

export type SyncStatus = 'dirty'

export type TreeTranslate = (key: string, params?: Record<string, string | number>) => string

export type TreeKeyboardHandler = (event: React.KeyboardEvent<HTMLElement>, item: VisibleItem) => void
