# Algorithms in Testcase Studio

This document inventories algorithmic code, its complexity, known problems, and improvement options.

---

## 1. Tree traversal (`src/core/tree.ts`)

The workspace tree is a recursive `Folder → children[]` structure. All algorithms below operate on this tree.

### `walkFolders(root, visit)` — iterative DFS

Uses an explicit stack (`foldersToVisit`) to walk all folders. Short-circuits early when `visit()` returns `true`.

| Operation | Time | Space |
|-----------|------|-------|
| Full walk | O(F) | O(D) |

Where **F** = total folders, **D** = max folder nesting depth.

**Note:** children are pushed in reverse order (`index` down to 0) so the leftmost subtree is visited first — consistent with display order.

---

### `findNode(root, id)` — O(N)

Scans all nodes until the target is found. Every read from the UI (selected test, expand state, dirty indicators) calls this.

**Problem:** called multiple times per render cycle through `getSelectedNode`, `getPublishSelection`, `getImportDestination`. For a workspace with thousands of tests, this stacks up.

**Options to improve:**
- **Map index** — maintain a `Map<ID, Node>` alongside the tree. Lookups drop to O(1) at the cost of keeping the map in sync on every mutation. Most practical win.
- **Immer + structural sharing** — already using `structuredClone` on mutations; adding Immer would give structural sharing and make cache invalidation trivial.
- **Flat list** — store tests in a flat `Map<ID, TestCase>` and a separate `Map<ID, FolderMeta>` for the tree shape. Eliminates all tree walks for node access; complicates move/delete slightly.

---

### `isAncestor(root, ancestorId, descendantId)` — O(N·D)

Walks up via repeated `findParentFolder` calls (each O(N)) until it reaches the ancestor or root. Called during `moveNode` to prevent dropping a folder into its own subtree.

**Problem:** each `findParentFolder` is an independent O(N) walk, so the full call is O(N·D).

**Options to improve:**
- With a **parent pointer map** (`Map<ID, ID>`) the walk becomes O(D) — just follow parent pointers upward.
- With the flat structure above, ancestor check is a loop over the path from descendant to root: O(D).

---

### `moveNode(root, nodeId, targetFolderId)` — O(N)

Custom recursive walk (`walk()`) that simultaneously finds the source node, source parent, and target folder in a single pass. Returns `false` if target is inside the moved subtree.

Complexity: **O(N)** where N = total nodes (folders + tests).

This is already well-optimised for a single-pass approach. No structural issue here.

---

### `mapTests(root)` — O(N)

Collects all `TestCase` leaves into a flat array. Used by `getAllTests`, publish selection, and dirty-count computations.

**Problem:** called on every dirty-badge re-render and for publish preview. Result is never cached.

**Options to improve:**
- Cache the result in the store and invalidate only on mutations that change the test set (add/delete/move). A simple `Set<ID>` cache of dirty IDs avoids the full walk for badge counts.

---

## 2. Included-case resolution (`src/application/workspace/core/includedCases.ts`)

`collectIncludedCaseCandidates` and `resolveIncludedCaseDecisions` walk all tests to find steps that reference shared steps.

| Operation | Time |
|-----------|------|
| Collect candidates | O(N · S) |
| Resolve decisions | O(N · S) |

Where **N** = test count, **S** = avg steps per test.

**Problem:** runs synchronously on every shared-step edit even for workspaces with hundreds of tests.

**Options to improve:**
- Build a reverse index: `Map<sharedStepId, Set<testId>>` updated on mutations. Makes candidate collection O(1) for a given shared step.

---

## 3. SVG → PNG conversion (`src/ui/assets/icons/svgToPng.ts`)

Runs in the renderer via an offscreen `<canvas>`. Not performance-critical (called once on icon set).

No issues. No optimisation needed.

---

## 4. Zephyr publish diff (`src/infrastructure/sync/`)

Diff computation for publish preview happens inside the sync service. Out of scope here — lives in infrastructure and is driven by the Zephyr API contract.

---

## Cross-language rewrite feasibility

| Area | Rewrite benefit | Risk | Verdict |
|------|----------------|------|---------|
| `tree.ts` in Rust (via WASM) | ~10–50× faster traversal for huge trees | Large integration surface; no async Electron IPC from WASM without bridge | Not worth it below ~100 k nodes |
| `includedCases.ts` in Rust (WASM) | Significant for 10 k+ tests | Same bridge overhead, kills the indexing win for small workspaces | Not yet |
| SVG→PNG in Rust | Marginal — canvas is fast enough | High effort, no gain | No |

**Practical recommendation:** implement the `Map<ID, Node>` index in `tree.ts` first. It's ~30 lines of TypeScript, zero risk, and eliminates the most frequent O(N) hot paths without any language switch.
