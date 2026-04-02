# Workspace And Sync Use Cases

## Goal

This document describes the expected product behavior for the workspace and sync flows.
It is intentionally written above the current implementation level.
The point is to define what the app should do before we lock that behavior into tests.

## Core Concepts

- Workspace: the full local tree of folders, test cases, and shared steps.
- Selection: the currently selected folder or test case in the workspace.
- Shared step: a reusable step sequence that can be referenced from test cases.
- Dirty test: a local test case with unsaved or unpublished changes.
- Import preview: a proposed set of local changes based on remote Zephyr data.
- Publish preview: a proposed set of remote changes based on local workspace data.
- Pull: refresh one local test case from its linked remote source.

## Use Case Groups

1. Workspace structure
2. Test editing
3. Shared step management
4. Persistence and recovery
5. Import from remote
6. Publish to remote
7. Pull a selected test case
8. Scope and selection queries

## 1. Workspace Structure

### Add folder

- The user can add a folder inside the currently selected folder.
- If a test case is selected, the new folder is created next to that test case, inside its parent folder.
- The new folder becomes the new selection.

### Add test case

- The user can add a test case inside the currently selected folder.
- If a test case is selected, the new test case is created inside the parent folder.
- A new test case starts with at least one editable step.
- The new test case becomes the new selection.

### Rename node

- The user can rename a folder or a test case.
- Renaming a folder must not implicitly mark unrelated test cases as dirty.
- Renaming a test case marks that test case as changed.

### Delete node

- The user can delete a folder or a test case, except for the workspace root.
- If the deleted node was selected, the selection falls back to the root workspace node.

### Move node

- The user can move folders and test cases into another folder.
- A move must not allow placing a folder inside itself or its descendants.
- A successful move keeps the moved node selected.

## 2. Test Editing

### Edit test content

- The user can edit the name, description, steps, metadata, attachments, and links of a test case.
- Any meaningful local edit marks that test case as changed.

### Edit integrations

- The user can set or clear external links, such as Zephyr and Allure identifiers.
- Clearing an external link removes it from the local test case.

## 3. Shared Step Management

### Create shared step

- The user can create an empty shared step or derive one from an existing step.
- A newly created shared step becomes visible in the shared library immediately.

### Update shared step

- The user can rename a shared step and edit its internal steps.

### Delete shared step

- Deleting a shared step removes the shared definition.
- Any test case that referenced that shared step must be updated accordingly.
- Only test cases that were actually changed by this cleanup become dirty.

### Insert shared reference

- The user can insert a shared step reference into a test case.
- The owning test case becomes dirty.

## 4. Persistence And Recovery

### Load workspace

- On startup, the app loads the last saved workspace snapshot.
- If loading fails, the app must surface an explicit error state instead of silently replacing user data.

### Save workspace

- Saving persists the current normalized workspace state.
- Saving with no loaded state is a no-op and reports failure gracefully.

### Write snapshot and publish log

- Publish flows create an auditable snapshot and a publish log.
- These artifacts describe what was attempted and what actually happened.

## 5. Import From Remote

### Build import preview

- Import preview chooses a destination folder from the current selection unless an explicit override is provided.
- If a test case is selected, the default destination is the parent folder of that test case.
- If a folder is selected, the default destination is that folder.
- The preview must describe:
  - new local tests
  - unchanged matches
  - updates
  - conflicts

### Review import conflicts

- Conflicts are reviewable before apply.
- Each conflict has an explicit strategy:
  - replace
  - skip
  - merge locally later

### Apply import

- Applying import produces a new workspace state.
- Dirty cleanup after import must be conservative:
  - clear dirty only for tests that were actually updated or created locally
  - do not clear dirty for skipped items
  - do not clear dirty for conflict drafts that were intentionally postponed

## 6. Publish To Remote

### Build publish preview

- Publish preview is based on the current selection:
  - no selection means whole workspace
  - selected folder means that folder subtree
  - selected test means only that test
- Whole-workspace publish should use the UI root label supplied by the caller, not an internal folder name leaking from storage.

### Review publish plan

- The preview must distinguish:
  - create
  - update
  - skip
  - blocked
- Attachment uploads and deletions must be visible before publish.

### Publish preview

- Publishing applies only items marked for publish.
- A publish operation writes a snapshot and a log.
- Dirty cleanup after publish must be conservative:
  - clear dirty only for tests that were successfully created or updated remotely
  - do not clear dirty for skipped items
  - do not clear dirty for blocked items
  - do not clear dirty for failed items

## 7. Pull A Selected Test Case

### Pull selected case

- Pull works only when a test case is selected.
- Pull from a folder selection is rejected.
- Pull from an unlinked test case is rejected.
- If multiple external links exist, Zephyr is preferred over fallback providers.
- Pull updates the local test case from the remote payload and clears dirty for that test case only.

## 8. Scope And Selection Queries

### Import destination query

- The import destination shown in the UI must match the actual folder used for import.

### Publish selection query

- The publish selection shown in the UI must match the actual set of tests sent to preview/publish.
- Root-level selection labels must use the caller-facing root label.

## Suggested Test Split

Instead of one large spec file, future behavior tests should be split by user-facing scenario:

- `workspace.structure.spec.ts`
- `workspace.selection.spec.ts`
- `workspace.persistence.spec.ts`
- `workspace.pull.spec.ts`
- `workspace.import.preview.spec.ts`
- `workspace.import.apply.spec.ts`
- `workspace.publish.preview.spec.ts`
- `workspace.publish.apply.spec.ts`

## Immediate Red Rules To Lock In First

These are the best first TDD targets because they are concrete and currently easy to reason about:

1. Whole-workspace publish uses the caller-facing root label.
2. Import apply clears dirty only for tests that were actually updated or created.
3. Publish apply clears dirty only for tests that were actually published successfully.
4. Pull prefers Zephyr when a test has multiple remote links.
