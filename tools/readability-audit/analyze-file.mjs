import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import {
    allowedShortNames,
    forbiddenImports,
    genericNames,
    hookWeights,
} from './config.mjs'
import { classifyFileZone, classifyImportZone, normalizePath } from './paths.mjs'

function collectBindingNames(name, out) {
    if (!name) return

    if (ts.isIdentifier(name)) {
        out.push(name.text)
        return
    }

    if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
        for (const element of name.elements) {
            if (ts.isBindingElement(element)) collectBindingNames(element.name, out)
        }
    }
}

export function analyzeFile(root, filePath) {
    const sourceText = fs.readFileSync(filePath, 'utf8')
    const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )

    const declaredNames = []
    const imports = []
    const hookCounts = {}
    let jsxCount = 0

    function visit(node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            imports.push(node.moduleSpecifier.text)
        }

        if (ts.isVariableDeclaration(node)) collectBindingNames(node.name, declaredNames)
        if (ts.isParameter(node)) collectBindingNames(node.name, declaredNames)

        if (
            (ts.isFunctionDeclaration(node) ||
                ts.isClassDeclaration(node) ||
                ts.isInterfaceDeclaration(node) ||
                ts.isTypeAliasDeclaration(node) ||
                ts.isEnumDeclaration(node)) &&
            node.name
        ) {
            declaredNames.push(node.name.text)
        }

        if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
            jsxCount += 1
        }

        if (ts.isCallExpression(node)) {
            let name = null
            if (ts.isIdentifier(node.expression)) name = node.expression.text
            else if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)) {
                name = node.expression.name.text
            }

            if (name && hookWeights.has(name)) {
                hookCounts[name] = (hookCounts[name] || 0) + 1
            }
        }

        ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    const handlerCount = declaredNames.filter((name) => /^handle[A-Z]/.test(name)).length
    const genericCount = declaredNames.filter((name) => genericNames.has(name)).length
    const shortCount = declaredNames.filter((name) => name.length <= 2 && !allowedShortNames.has(name)).length
    const anyCount = (sourceText.match(/\bas any\b|:\s*any\b|<any>/g) || []).length

    const logicalLines = sourceText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
            (line) =>
                line &&
                !line.startsWith('//') &&
                !line.startsWith('*') &&
                !line.startsWith('/*') &&
                !line.startsWith('*/')
        ).length

    const fileZone = classifyFileZone(root, filePath)
    const importZones = imports.map((specifier) => classifyImportZone(root, filePath, specifier))
    const nonExternalImportZones = [
        ...new Set(importZones.filter((zone) => zone !== 'external' && zone !== 'unknown')),
    ]
    const externalZoneCount = [...new Set(nonExternalImportZones.filter((zone) => zone !== fileZone))].length
    const violatedZones = nonExternalImportZones.filter((zone) => forbiddenImports[fileZone]?.has(zone) ?? false)

    const hookScore = Object.entries(hookCounts).reduce(
        (sum, [name, count]) => sum + (hookWeights.get(name) || 0) * count,
        0
    )

    const namingScore = Math.min(
        100,
        genericCount * 8 +
            shortCount * 5 +
            anyCount * 18 +
            (declaredNames.length ? ((genericCount + shortCount) / declaredNames.length) * 25 : 0)
    )
    const mixingScore = Math.min(
        100,
        Math.max(0, logicalLines - 80) / 3 +
            Math.min(25, hookScore) +
            Math.min(18, handlerCount * 2) +
            Math.max(0, nonExternalImportZones.length - 2) * 7 +
            Math.max(0, jsxCount - 20) / 4
    )
    const architectureScore = Math.min(
        100,
        violatedZones.length * 45 +
            Math.max(0, externalZoneCount - 2) * 10 +
            Math.max(0, nonExternalImportZones.length - 4) * 6
    )

    return {
        file: normalizePath(path.relative(root, filePath)),
        zone: fileZone,
        logicalLines,
        namingScore: Number(namingScore.toFixed(1)),
        mixingScore: Number(mixingScore.toFixed(1)),
        architectureScore: Number(architectureScore.toFixed(1)),
        totalScore: Number((namingScore * 0.4 + mixingScore * 0.4 + architectureScore * 0.2).toFixed(1)),
        declaredNames: declaredNames.length,
        genericCount,
        shortCount,
        anyCount,
        handlerCount,
        hookScore,
        jsxCount,
        importZones: nonExternalImportZones,
        forbiddenImports: violatedZones,
    }
}
