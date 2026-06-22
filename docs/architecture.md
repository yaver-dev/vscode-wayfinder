# Architecture

## Overview

Wayfinder is a VS Code extension with two runtimes: the **extension host** (Node.js) and a **webview** (browser). Communication is one-way snapshot push (extension → webview) and command message (webview → extension).

```
┌────────────────────────────────────────────────────┐
│ Extension Host (Node.js, CJS)                     │
│                                                    │
│  extension.ts                                      │
│    ├── SettingsService         reads/writes config  │
│    ├── RecentTargetsService    native + stored      │
│    ├── SshConfigService        ~/.ssh/config parse  │
│    ├── WorkspaceService        open workspace       │
│    │   └── RemoteWorkspaceOpener  SSH via vscode    │
│    └── HubPanel               webview manager      │
│          └── postSnapshot() ────► JSON snapshot     │
│                                                    │
└──────────────────────┬─────────────────────────────┘
                       │ postMessage (WebviewMessage)
                       │   openWorkspace, saveGroup,
                       │   reorderGroups, runCommand ...
                       ▼
┌────────────────────────────────────────────────────┐
│ Webview (Browser, IIFE)                           │
│                                                    │
│  main.ts → acquireVsCodeApi() + message loop       │
│    ├── App.ts               orchestrator + render   │
│    │   ├── lib/dom.ts       DOM helpers            │
│    │   ├── lib/Icons.ts     SVG icon definitions    │
│    │   ├── lib/slug.ts      ID generation           │
│    │   └── lib/workspaceBuilder.ts  target factory  │
│    ├── state.ts              persistent snapshot    │
│    └── styles.css            1067 lines             │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Shared Types

Both runtimes share domain types via the `shared/` directory:

- `shared/types.ts` — `WorkspaceTarget`, `WayfinderGroup`, `RecentTarget`, `SshHost`, `WayfinderSettings`, `WorkspaceColor`
- `shared/protocol.ts` — `WebviewMessage` (14 discriminated types), `ExtensionMessage` (3 types), `DashboardSnapshot`

## Data Flow

### Startup
1. `activate()` → create services + status bar
2. If `openOnEmptyWindow` and empty window → `HubPanel.revealOrCreate()`
3. Webview loaded → sends `{ type: "ready" }`
4. Extension responds with `{ type: "snapshot", snapshot }`

### Snapshot (extension → webview)
```
SettingsService.read()
  └─► validateWayfinderSettings() → { value, errors }
  └─► WayfinderSettings
RecentTargetsService.list()
  └─► mergeRecentTargets(native, stored) → RecentTarget[]
SshConfigService.listHosts()
  └─► collectHosts() recursive include → SshHost[]
      ↓
DashboardSnapshot { settings, recentTargets, sshHosts, configurationErrors }
      ↓
postMessage({ type: "snapshot", snapshot })
```

### Commands (webview → extension)

All webview interactions generate a `WebviewMessage`. `HubPanel.handleMessage()` routes to the matching handler via a **dispatch table** (Record<string, Handler>). Common flows:

| Message type | Extension action |
|---|---|
| `openWorkspace` | `record()` + `WorkspaceService.open()` |
| `openRecent` | `record()` + `WorkspaceService.open()` |
| `saveGroup` | validate → `SettingsService.updateGroups()` |
| `saveWorkspace` | validate → `SettingsService.updateWorkspaces()` |
| `reorderGroups` | `(index+1)*10` order → `updateGroups()` |
| `runCommand` | `vscode.commands.executeCommand()` |

## Key Design Decisions

### Dynamic `require("vscode")` → Constructor DI
`SshConfigService` originally used `require("vscode")` to read config. This was replaced with an `SshConfigGetter` interface injected via constructor for testability.

### Native + Stored Recent Merge
`RecentTargetsService` merges VS Code's native recently-opened list with Wayfinder's own stored recents (fingerprint-deduped, openedAt-sorted). This ensures recorded targets persist even when native data is unavailable.

### Vanilla DOM (no framework)
The webview uses vanilla DOM APIs. Components are factory functions returning `HTMLElement`, called from `App.render()` which does a full `replaceChildren()` on each snapshot. This is simple but not incremental — targeted re-renders would be an optimization.

### Validation Pipeline
Settings flow through a two-layer validation:
1. **JSON Schema** (`additionalProperties: false`, `pattern`, `enum`) in `package.json` contributions
2. **Runtime validators** (`validateWayfinderSettings`, `validateWorkspaceTarget`) that repair invalid values with defaults and collect errors

## Service Responsibilities

| Service | Responsibility |
|---|---|
| `SettingsService` | Read/write `wayfinder.*` settings via VS Code Configuration API. Queued writes. |
| `RecentTargetsService` | Record, list, remove recent targets. Merge native + stored. |
| `SshConfigService` | Parse `~/.ssh/config` with `Include` recursion (max 16 depth). Glob expansion. |
| `WorkspaceService` | Route `open()` to local / SSH / workspace-file opener. |
| `RemoteWorkspaceOpener` | Activate Remote - SSH extension, build `vscode-remote` URI, execute `vscode.openFolder`. |

## File Structure

```
src/
├── extension.ts
├── HubPanel.ts
├── protocol.ts         (re-export from shared/)
├── types.ts            (re-export from shared/)
├── services/
│   ├── RecentTargetsService.ts
│   ├── RemoteWorkspaceOpener.ts
│   ├── SettingsService.ts
│   ├── SshConfigService.ts
│   └── WorkspaceService.ts
├── utils/
│   ├── Nonce.ts
│   ├── Paths.ts
│   ├── UriFactory.ts
│   └── types.ts            (type guards)
└── validation/
    ├── ConfigValidation.ts
    └── WorkspaceTargetValidation.ts
shared/
├── types.ts
└── protocol.ts
webview/src/
├── main.ts
├── App.ts              (orchestrator, ~170 lines)
├── state.ts
├── protocol.ts
├── lib/
│   ├── Icons.ts
│   ├── dom.ts
│   ├── slug.ts
│   └── workspaceBuilder.ts
├── components/
│   ├── Sidebar.ts       (search, recent, remote hosts, splitter)
│   ├── WorkspaceCard.ts (workspace card rendering)
│   ├── WorkspaceEditor.ts (workspace add/edit form)
│   └── GroupEditor.ts   (group add/edit form)
├── controllers/
│   └── DragController.ts (drag-drop state + handlers)
└── styles.css
test/
├── configValidation.test.ts
├── remoteWorkspaceOpener.test.ts
├── sshConfigService.test.ts
├── workspaceTargetValidation.test.ts
└── fixtures/ssh/  (test SSH config files)
```
