// providers/zephyr.mock.ts
import type { ITestProvider, ProviderTest, ProviderStep } from './types'

function stripHtml(html: string | undefined | null): string {
    if (!html) return ''
    return String(html)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|h\d)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

/**
 * Простая мока Zephyr. Понимает:
 *  - "PROD-T6079"
 *  - "6079" → нормализуется к "PROD-T6079"
 */
export class ZephyrMockProvider implements ITestProvider {
    private normalizeKey(id: string): string {
        const t = (id || '').trim()
        return /^\d+$/.test(t) ? `PROD-T${t}` : t.toUpperCase()
    }

    async getTestDetails(externalId: string): Promise<ProviderTest> {
        const key = this.normalizeKey(externalId)

        // Демоданные для PROD-T6079
        if (key === 'PROD-T6079') {
            const zephyrRaw = {
                owner: 'JIRAUSER146660',
                updatedBy: 'JIRAUSER146660',
                customFields: {
                    'Assigned to': '712020:7968aa2a-89b7-4818-aadc-ace219324120',
                    Automation: 'Automated',
                    'Test Type': 'Regression',
                },
                keyNumber: 6079,
                updatedOn: '2025-09-10T08:45:09.839Z',
                priority: 'High',
                majorVersion: 1,
                createdOn: '2025-08-16T03:26:42.544Z',
                component: 'Core',
                projectKey: 'PROD',
                folder:
                    '/CORE/[New] Core /[New] Хранилище договоров/CNTS E-03.01 Добавить документы к договору',
                latestVersion: true,
                createdBy: 'JIRAUSER144920',
                testScript: {
                    id: 169624,
                    type: 'STEP_BY_STEP',
                    steps: [
                        {
                            testData:
                                'где <em><br /><em> {{ms-insurance-contract-storage}}</em> </em>- URL ms-insurance-contract-storage тестируемого стенда<br /><em>{{policyId}}</em><em> </em>-policyId - id договора из предусловий<br /><em>{{fileId}}</em><em>- </em>id файла из предусловий',
                            expectedResult:
                                '<strong>Статус код = 201</strong><br />Получен ответ вида<br /><br /><em>{</em><br /><em>    "requestId": "44425b1d-7f2a-4963-b74e-26950514ce45",<br /> "flkReport": {<br /> "requestId": "44425b1d-7f2a-4963-b74e-26950514ce45",<br /> "mismatches": []<br />    }, </em><br /><em>   "id": "e9ef3684-1b41-4abe-821d-c5c33d1598a1"<br />}</em>',
                            index: 1,
                            description:
                                '<strong>Выполнить POST запрос на добавление файла к договору</strong><br /><br /><em> </em><em>{{ms-insurance-contract-storage}}/api/v1/internal/contracts/{{policyId}}/documents</em><br /><br /><strong>Тело запроса</strong><br /><br /><em>{</em><br /><em>"requestId":"{{$guid}}",<br /></em><em><em> "fileStorageId": "{{fileId}}",<br /> "type": "MEMO"</em><br />}</em>',
                            id: 1725861,
                        },
                        {
                            testData: '',
                            expectedResult:
                                '<strong>Получена связка договора с файлом</strong><br /><br />Запись в БД<br />  <em>{<br />"document": [<br />    {<br />        "id" : "e9ef3684-1b41-4abe-821d-c5c33d1598a1",<br />        "contract_id" : "921b3577-1af2-4864-bb76-d84d008d92d8",<br />        "file_storage_id" : "fa067b79-04e7-47a1-88a7-ad6e1af13624",<br />        "type" : "MEMO"<br />    }<br />]}<br /><br /></em><br /><br /><br />',
                            index: 2,
                            description:
                                '<strong>Проверить создание связки договора с файлом </strong><br /><br />Атрибуты связки должны соответствовать:<ol><li>contract_id - id договора из предусловий</li><li>file_storage_id- id файла из предусловий</li></ol>Для этого в БД ms-insurance-contract-storage в таблице document выполнить SELECT-запрос вида <br /><br /><em>SELECT x.* FROM public."document" x<br />WHERE id =\'</em><em><em>{{id}}\'</em></em><br /><br />где <em>{{id}}</em> - id связки, полученный в теле ответа шага 2',
                            id: 1725862,
                        },
                        {
                            testCaseKey: 'PROD-T6078',
                            index: 0,
                            id: 1740651,
                        },
                    ],
                },
                issueLinks: ['PROD-23172'],
                name: '[CNTS E-03.01] Добавить файл к договору',
                lastTestResultStatus: 'Pass',
                parameters: { variables: [], entries: [] },
                key: 'PROD-T6079',
                status: 'Actual',
            }

            // Маппим Zephyr → ProviderTest
            const steps: ProviderStep[] = (zephyrRaw.testScript?.steps ?? [])
                .filter((s: any) => s && (s.description || s.testData || s.expectedResult))
                .sort((a: any, b: any) => (a.index ?? 0) - (b.index ?? 0))
                .map((s: any) => ({
                    action: stripHtml(s.description || ''),
                    data: stripHtml(s.testData || ''),
                    expected: stripHtml(s.expectedResult || ''),
                    text: stripHtml(s.description || ''), // добавь
                }))

            const result: ProviderTest = {
                id: zephyrRaw.key,
                name: zephyrRaw.name,
                description: undefined, // Zephyr в примере не даёт отдельного description
                steps,
                attachments: [],
                updatedAt: zephyrRaw.updatedOn, // нормализуем поле
            }
            return result
        }

        // Значение «по умолчанию» для неизвестных ключей:
        return {
            id: key,
            name: `Unknown Zephyr test ${key}`,
            description: 'No data in mock',
            steps: [],
            attachments: [],
            updatedAt: new Date().toISOString(), // ⚠️ именно updatedAt, не updatedOn
        }
    }

    async upsertTest(payload: ProviderTest): Promise<{ externalId: string }> {
        // эмулируем сохранение: если есть id — вернём его, иначе сгенерим
        const generated = `PROD-T${Math.floor(1000 + Math.random() * 9000)}`
        return { externalId: payload.id || generated }
    }

    async attach(_externalId: string, _attachment: any): Promise<void> {
        // no-op в моке
    }

    async deleteAttachment(_externalId: string, _attachmentId: string): Promise<void> {
        // no-op в моке
    }
}
