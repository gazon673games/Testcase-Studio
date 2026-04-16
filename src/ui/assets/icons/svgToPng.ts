export async function svgUrlToPngBuffer(svgUrl: string, size: number): Promise<ArrayBuffer> {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load SVG'))
        img.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')
    ctx.drawImage(img, 0, 0, size, size)
    return new Promise<ArrayBuffer>((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? blob.arrayBuffer().then(resolve) : reject(new Error('canvas.toBlob failed'))),
            'image/png'
        )
    )
}
