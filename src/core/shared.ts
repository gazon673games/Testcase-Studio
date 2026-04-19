import type { SharedStep, Step } from './domain'

export function materializeSharedSteps(steps: Step[], sharedLibrary: SharedStep[]): Step[] {
    const byId = new Map(sharedLibrary.map(s => [s.id, s] as const))
    const out: Step[] = []
    for (const st of steps) {
        if (st.usesShared) {
            const lib = byId.get(st.usesShared)
            if (lib) {
                // Clone shared-library steps before inserting them.
                out.push(...lib.steps.map(x => ({ ...x })))
                continue
            }
        }
        out.push({ ...st })
    }
    return out
}
