type Translate = (key: string, params?: Record<string, string | number>) => string

type MarkdownEditorToolbarProps = {
    visible: boolean
    preview: boolean
    t: Translate
    onWrap(before: string, after: string): void
    onInsertPrefix(prefix: string): void
    onTogglePreview?: () => void
}

export function MarkdownEditorToolbar({
    visible,
    preview,
    t,
    onWrap,
    onInsertPrefix,
    onTogglePreview,
}: MarkdownEditorToolbarProps) {
    if (!visible || preview) return null

    return (
        <div className="md-toolbar" onMouseDown={(event) => event.preventDefault()}>
            <button type="button" className="md-btn" title={t('markdown.bold')} onClick={() => onWrap('**', '**')}>B</button>
            <button type="button" className="md-btn" title={t('markdown.italic')} onClick={() => onWrap('*', '*')}><i>I</i></button>
            <button type="button" className="md-btn" title={t('markdown.underline')} onClick={() => onWrap('__', '__')}><u>U</u></button>
            <div className="divider" />
            <button type="button" className="md-btn" title={t('markdown.bulletedList')} onClick={() => onInsertPrefix('-')}>*</button>
            <button type="button" className="md-btn" title={t('markdown.numberedList')} onClick={() => onInsertPrefix('1.')}>1.</button>
            <div className="divider" />
            <button type="button" className="md-btn" title={t('markdown.code')} onClick={() => onWrap('`', '`')}>{'</>'}</button>
            <button type="button" className="md-btn" title={t('markdown.link')} onClick={() => onWrap('[', '](url)')}>{t('markdown.link')}</button>
            <button type="button" className="md-btn" title={t('markdown.image')} onClick={() => onWrap('![', '](image.png)')}>{t('markdown.image')}</button>
            {typeof onTogglePreview === 'function' && (
                <>
                    <div className="divider" />
                    <button type="button" className="md-btn" title={t('markdown.togglePreview')} onClick={onTogglePreview}>
                        {t('markdown.togglePreview')}
                    </button>
                </>
            )}
        </div>
    )
}
