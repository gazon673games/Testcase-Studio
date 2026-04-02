# Testcase Studio

Testcase Studio is a desktop app for working with manual test cases locally and syncing them with Zephyr Scale.

It is built as an Electron app with a React UI and a local filesystem workspace, so you can keep a structured test repository on your machine instead of editing everything directly in a browser.

## What the app is for

The app is useful when you want to:

- keep test cases in a local folder tree
- edit cases and steps in a desktop editor
- reuse shared steps
- attach files on case and step level
- import cases from Zephyr with a preview
- publish local changes back to Zephyr with a preview

This project is focused on a practical QA workflow, not on being a full test management platform.

## How it works

The app has two main parts:

- `src/` contains the React interface, editor logic, domain model, and sync workflows
- `electron/` contains the Electron main process, preload bridge, secure settings, and local file repository

Workspace data is stored on disk in `tests_repo/`.

In development mode:

- the renderer runs through Vite on `http://localhost:5173`
- Electron opens a desktop window and loads that renderer
- the app reads and writes local workspace data in the repository folder

Saved secrets are handled through the desktop integration layer, not stored in plain UI state.

## Workspace layout

The local workspace is file-based and lives in:

```text
tests_repo/
```

Important files and folders:

- `tests_repo/root/` - folder tree with your local test cases
- `tests_repo/shared_steps.json` - shared step library
- `tests_repo/.snapshots/` - saved workspace snapshots
- `tests_repo/.publish-logs/` - publish logs

In dev mode this folder is created in the project root.

## First run flow

1. Install dependencies.
2. Start the app in dev mode.
3. Electron opens the desktop window.
4. The app creates `tests_repo/` if it does not exist yet.
5. You can start creating folders, test cases, shared steps, and attachments.
6. If you want Zephyr sync, open settings inside the app and enter your base URL, login, and token/password.

The app autosaves workspace changes, so you normally do not need to manually export files after every edit.

## Zephyr setup

If you want import and publish features to work, you need to fill in Atlassian settings inside the app.

Open the app, then open **Settings** from the toolbar and fill in:

- `Base URL` - your Jira or Atlassian base URL, for example `https://your-domain.atlassian.net`
- `Login` - the username or email used for your Atlassian account
- `Password` - your password or token, depending on how your Jira or Zephyr environment is configured

Useful notes:

- the app needs all three values before Zephyr requests can work
- the base URL should be the main Atlassian or Jira address, not a specific REST endpoint
- the non-secret part of settings is stored in `tests_repo/.settings.json`
- the secret itself is stored through the OS credential store integration

If settings are missing, Zephyr import and publish requests will fail until they are filled in.

## Development flow

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app for development

```bash
npm run dev
```

What this actually does:

- starts the Vite dev server for the renderer
- builds the Electron main process through Vite
- launches Electron and opens the desktop app window

If you change renderer code, Vite hot reload handles it.

If you change Electron main or preload code and the app starts behaving strangely, stop `npm run dev` and start it again. Hot reload is not always enough for main-process changes.

### 3. Run tests

```bash
npm test
```

### 4. Run TypeScript checks

```bash
npm run typecheck
```

### 5. Build the project

```bash
npm run build
```

This creates:

- `dist/` for the renderer build
- `dist-electron/` for the Electron main build

### 6. Start from the local build

```bash
npm run start
```

This is useful when you want to check the app without the Vite dev server.

## Main scripts

- `npm run dev` - start the development workflow
- `npm run typecheck` - run TypeScript without emitting files
- `npm test` - run Vitest
- `npm run build` - typecheck and build renderer + Electron main
- `npm run start` - build and launch Electron locally

## GitHub Actions

The repository includes a simple CI workflow in `.github/workflows/main.yml`.

It runs on:

- pushes to `main`
- every pull request

The workflow checks the project on Windows and runs:

- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run build`

This is enough to catch broken builds, failed tests, and basic integration issues before changes pile up.

## Current state of the project

The app already supports the main local editing and Zephyr sync flows, but it is still an actively evolving project.

Recent work has been focused on:

- improving workspace safety
- hardening Electron and IPC boundaries
- making autosave less heavy
- cleaning up architecture around sync and app state

## Notes

- This project is not affiliated with Atlassian.
- GitHub passwords do not work for Git operations anymore; use a token or Git Credential Manager for pushes.
