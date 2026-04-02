import path from 'node:path'
import { roots } from './config.mjs'
import { analyzeFile } from './analyze-file.mjs'
import { printCompactReport, printDetailedReport } from './format.mjs'
import { classifyFileZone, listSourceFiles } from './paths.mjs'
import { buildReport } from './report.mjs'

function parseArgs(argv) {
    const topIndex = argv.indexOf('--top')
    const topValue = topIndex === -1 ? null : Number(argv[topIndex + 1])

    return {
        top: Number.isFinite(topValue) && topValue > 0 ? topValue : 10,
        json: argv.includes('--json'),
        details: argv.includes('--details'),
        zone: (() => {
            const zoneIndex = argv.indexOf('--zone')
            return zoneIndex === -1 ? null : argv[zoneIndex + 1]
        })(),
    }
}

export function runReadabilityAudit(argv = process.argv.slice(2)) {
    const root = process.cwd()
    const options = parseArgs(argv)

    const files = roots
        .flatMap((dir) => listSourceFiles(root, path.join(root, dir)))
        .filter((file) => !options.zone || classifyFileZone(root, file) === options.zone)
        .sort()

    const results = files.map((file) => analyzeFile(root, file))
    const report = buildReport(results, options.top)

    if (options.json) {
        console.log(JSON.stringify(report, null, 2))
        return
    }

    printCompactReport(report)
    if (options.details) {
        printDetailedReport(report)
    }
}
