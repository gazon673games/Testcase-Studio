export function getFocusable(container: HTMLElement | null): HTMLElement[] {
    if (!container) return []
    const selector = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.hasAttribute('hidden') && element.tabIndex !== -1
    )
}

export function joinClasses(...parts: Array<string | undefined | false>): string {
    return parts.filter(Boolean).join(' ')
}
