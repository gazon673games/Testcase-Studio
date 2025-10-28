import { v4 as uuid } from 'uuid'
import type { ITestProvider, ProviderTest } from './types'
import type { Attachment, Step, TestCase } from '@core/domain'

type DB = Record<string, ProviderTest>

const inMemory: DB = {}

function clone<T>(x: T): T {
    return JSON.parse(JSON.stringify(x))
}

export class ZephyrMockProvider implements ITestProvider {
    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const hit = inMemory[externalId]
        if (!hit) {
            // seed a synthetic test if it doesn't exist
            const seeded: ProviderTest = {
                id: externalId,
                name: `Mock Zephyr Test ${externalId.slice(0, 6)}`,
                description: 'Seeded from Zephyr mock',
                steps: [
                    { id: uuid(), text: 'Open app' },
                    { id: uuid(), text: 'Click Login', expected: 'Dashboard appears' }
                ],
                attachments: [],
                updatedAt: new Date().toISOString()
            }
            inMemory[externalId] = seeded
            return clone(seeded)
        }
        return clone(hit)
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        const externalId = payload.id || uuid()
        const record: ProviderTest = { ...clone(payload), id: externalId, updatedAt: new Date().toISOString() }
        inMemory[externalId] = record
        return { externalId }
    }

    async attach(externalId: string, attachment: Attachment): Promise<void> {
        const hit = inMemory[externalId]
        if (!hit) throw new Error('Zephyr: test not found')
        hit.attachments.push(attachment)
        hit.updatedAt = new Date().toISOString()
    }

    async deleteAttachment(externalId: string, attachmentId: string): Promise<void> {
        const hit = inMemory[externalId]
        if (!hit) throw new Error('Zephyr: test not found')
        hit.attachments = hit.attachments.filter(a => a.id !== attachmentId)
        hit.updatedAt = new Date().toISOString()
    }
}
