# Workspace Test Layers

This document tracks how independent the workspace tests are from the current code structure.

## Target

We want most workspace tests to describe product rules and observable outcomes.

Good tests should depend on:
- workspace state shapes
- use-case inputs and outputs
- user-facing business rules

They should avoid depending on:
- exact helper calls
- exact port wiring
- internal function boundaries
- implementation-only details like clones, loops, or intermediate objects

## Layers

### 1. Spec-like

These tests describe business behavior through inputs and outputs.

Current files:
- `src/application/workspace/workspace.structure.test.ts`
- `src/application/workspace/workspace.selection.test.ts`
- `src/application/workspace/workspace.editing.test.ts`
- `src/application/workspace/workspace.shared-steps.test.ts`
- `src/application/workspace/workspace.import.apply.test.ts`
- `src/application/workspace/workspace.publish.apply.test.ts`

### 2. Boundary-coupled

These tests still verify behavior through the current use-case ports or adapters.
They are useful, but they are closer to contract tests than to pure business specifications.

Current files:
- `src/application/workspace/workspace.import.preview.test.ts`
- `src/application/workspace/workspace.publish.preview.test.ts`
- `src/application/workspace/workspace.pull.test.ts`
- `src/application/workspace/workspace.persistence.test.ts`
- `src/application/workspace/workspace.load.test.ts`

### 3. Implementation-coupled

This layer should stay as small as possible.

At the moment, the workspace use-case files above do not need this label, but some tests in other areas of the repo may still fall into it.

## First migration wave

The first safe step is to move the boundary-coupled tests away from direct spy assertions when possible.

Done:
- `workspace.import.preview.test.ts` now asserts the returned preview request instead of checking a mock call shape
- `workspace.publish.preview.test.ts` now asserts the returned preview selection instead of checking a mock call shape
- `workspace.pull.test.ts` now asserts the pulled result and updated state instead of checking the chosen link through a mock call assertion

## Next migration wave

The next candidates are:
- `workspace.persistence.test.ts`
- `workspace.load.test.ts`

These are still tied to the current `store` and `@ipc/client` adapters.
To make them more spec-like, we will first need a cleaner boundary around persistence and load behavior.
