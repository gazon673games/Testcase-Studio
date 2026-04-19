export const HTML_ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export const JSON_VALUE_END_CHARS = new Set(['"', '}', ']', 'e', 'E', 'l'])
export const JSON_VALUE_START_CHARS = new Set(['"', '{', '[', '-', 't', 'f', 'n'])
