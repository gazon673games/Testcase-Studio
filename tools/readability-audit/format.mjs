export function formatTable(rows, columns) {
    const widths = columns.map((column) =>
        Math.max(column.label.length, ...rows.map((row) => String(row[column.key]).length))
    )

    const header = columns
        .map((column, index) => String(column.label).padEnd(widths[index]))
        .join('  ')
    const separator = widths.map((width) => '-'.repeat(width)).join('  ')
    const body = rows.map((row) =>
        columns
            .map((column, index) => String(row[column.key]).padEnd(widths[index]))
            .join('  ')
    )

    return [header, separator, ...body].join('\n')
}

export function toPrintableRows(items) {
    return items.map((item) => ({
        total: item.totalScore,
        naming: item.namingScore,
        mixing: item.mixingScore,
        arch: item.architectureScore,
        zone: item.zone,
        lines: item.logicalLines,
        file: item.file,
    }))
}

export function printCompactReport(report) {
    console.log(`Readability audit for ${report.analyzedFiles} files`)
    console.log(
        `Averages: naming ${report.averages.naming}, mixing ${report.averages.mixing}, architecture ${report.averages.architecture}, total ${report.averages.total}`
    )
    console.log('')
    console.log('Buckets:')
    console.log(
        `  naming low/medium/high: ${report.buckets.naming.low}/${report.buckets.naming.medium}/${report.buckets.naming.high}`
    )
    console.log(
        `  mixing low/medium/high: ${report.buckets.mixing.low}/${report.buckets.mixing.medium}/${report.buckets.mixing.high}`
    )
    console.log(
        `  architecture low/medium/high: ${report.buckets.architecture.low}/${report.buckets.architecture.medium}/${report.buckets.architecture.high}`
    )
    console.log('')
    console.log('Top files by total readability debt:')
    console.log(
        formatTable(toPrintableRows(report.topTotal), [
            { key: 'total', label: 'Total' },
            { key: 'naming', label: 'Naming' },
            { key: 'mixing', label: 'Mixing' },
            { key: 'arch', label: 'Arch' },
            { key: 'zone', label: 'Zone' },
            { key: 'lines', label: 'Lines' },
            { key: 'file', label: 'File' },
        ])
    )
}

export function printDetailedReport(report) {
    console.log('')
    console.log('Top files by naming debt:')
    console.log(
        formatTable(toPrintableRows(report.topNaming), [
            { key: 'naming', label: 'Naming' },
            { key: 'total', label: 'Total' },
            { key: 'zone', label: 'Zone' },
            { key: 'lines', label: 'Lines' },
            { key: 'file', label: 'File' },
        ])
    )
    console.log('')
    console.log('Top files by mixing debt:')
    console.log(
        formatTable(toPrintableRows(report.topMixing), [
            { key: 'mixing', label: 'Mixing' },
            { key: 'total', label: 'Total' },
            { key: 'zone', label: 'Zone' },
            { key: 'lines', label: 'Lines' },
            { key: 'file', label: 'File' },
        ])
    )
    console.log('')
    console.log('Top files by architecture debt:')
    console.log(
        formatTable(toPrintableRows(report.topArchitecture), [
            { key: 'arch', label: 'Arch' },
            { key: 'total', label: 'Total' },
            { key: 'zone', label: 'Zone' },
            { key: 'lines', label: 'Lines' },
            { key: 'file', label: 'File' },
        ])
    )
}
