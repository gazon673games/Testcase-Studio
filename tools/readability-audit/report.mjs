export function average(items, key) {
    return Number((items.reduce((sum, item) => sum + item[key], 0) / items.length).toFixed(1))
}

export function bucket(items, key) {
    const counts = { low: 0, medium: 0, high: 0 }

    for (const item of items) {
        const score = item[key]
        if (score >= 45) counts.high += 1
        else if (score >= 20) counts.medium += 1
        else counts.low += 1
    }

    return counts
}

export function topBy(items, key, limit) {
    return [...items].sort((left, right) => right[key] - left[key]).slice(0, limit)
}

export function summarizeByZone(items) {
    const grouped = {}

    for (const item of items) {
        grouped[item.zone] ??= { count: 0, naming: 0, mixing: 0, architecture: 0 }
        grouped[item.zone].count += 1
        grouped[item.zone].naming += item.namingScore
        grouped[item.zone].mixing += item.mixingScore
        grouped[item.zone].architecture += item.architectureScore
    }

    for (const zone of Object.keys(grouped)) {
        const group = grouped[zone]
        group.naming = Number((group.naming / group.count).toFixed(1))
        group.mixing = Number((group.mixing / group.count).toFixed(1))
        group.architecture = Number((group.architecture / group.count).toFixed(1))
    }

    return grouped
}

export function buildReport(results, top) {
    return {
        analyzedFiles: results.length,
        averages: {
            naming: average(results, 'namingScore'),
            mixing: average(results, 'mixingScore'),
            architecture: average(results, 'architectureScore'),
            total: average(results, 'totalScore'),
        },
        buckets: {
            naming: bucket(results, 'namingScore'),
            mixing: bucket(results, 'mixingScore'),
            architecture: bucket(results, 'architectureScore'),
        },
        byZone: summarizeByZone(results),
        topTotal: topBy(results, 'totalScore', top),
        topNaming: topBy(results, 'namingScore', top),
        topMixing: topBy(results, 'mixingScore', top),
        topArchitecture: topBy(results, 'architectureScore', top),
    }
}
