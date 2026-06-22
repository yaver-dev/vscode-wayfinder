# Wayfinder

[![VS Code](https://img.shields.io/badge/VS%20Code-1.99%2B-0098FF)](https://code.visualstudio.com/)
[![Node](https://img.shields.io/badge/Node-22-339933)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6)](https://www.typescriptlang.org/)
[![esbuild](https://img.shields.io/badge/esbuild-0.25-FFCF00)](https://esbuild.github.io/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-2ea44f)](#requirements)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

**A modern workspace launcher and dashboard for Visual Studio Code.**

Wayfinder pins local folders, Remote SSH hosts, and `.code-workspace` files into customizable groups, merges VS Code native recents with its own history, imports SSH aliases from `~/.ssh/config`, and provides a keyboard-first dashboard for jumping between projects.

It is designed for developers who manage many workspaces — local, remote, or multi-root — and want a single, organized view instead of hunting through the command palette or recent list.

```text
Sidebar          -> quick actions, recent targets, remote SSH hosts
Workspace Panel  -> pinned groups with drag-and-drop workspace cards
Editors          -> inline group and workspace add/edit forms
```

## 📸 Screenshot

![Wayfinder dashboard](docs/images/wayfinder-screenshot.png)

## ✨ Features

| Feature                          | Description                                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 📌 **Pinned workspaces**          | Organize local, SSH, and `.code-workspace` targets into named groups                                      |
| 🖥️ **Dashboard webview**          | Full-screen VS Code webview panel with sidebar and workspace grid                                         |
| 🐧 **Remote SSH integration**     | Open SSH targets via the Remote - SSH extension; `vscode-remote` URI construction                         |
| 📋 **SSH config import**          | Parses `~/.ssh/config` with recursive `Include` support (glob, relative, 16-depth limit)                 |
| 🕐 **Recent targets**             | Merges VS Code native recents with Wayfinder-recorded targets; fingerprint-deduped, sorted by recency    |
| 🎨 **Colors and badges**          | 10 accent colors and 1–3 character badge labels per workspace                                             |
| 🖱️ **Drag-and-drop reorder**      | Reorder groups, reorder workspace cards within a group, move cards across groups                          |
| ⚡ **Quick actions**              | New File, Open Folder, Clone Repository, Extensions — all from the sidebar                               |
| 🔍 **Sidebar search**             | Filter recent targets and SSH hosts by name, path, or alias                                               |
| 📐 **Resizable sidebar sections** | Drag the splitter between Recent Targets and Remote Hosts to adjust heights                              |
| 🛡️ **Configuration validation**   | Two-layer validation: JSON schema in `package.json` + runtime validators with safe fallbacks             |
| ⚠️ **Error banner**               | Configuration warnings displayed inline in the dashboard when settings contain invalid values            |
| 🌍 **Cross-platform by design**   | Works on macOS, Linux, and Windows through VS Code's extension host and webview APIs                     |

## ⚡ Quick Start

### From source

```bash
git clone https://github.com/yaver-dev/vscode-wayfinder.git
cd vscode-wayfinder
npm install
npm run compile
```

Press `F5` in VS Code to launch an Extension Development Host, then run **Wayfinder: Open Dashboard** from the command palette.

### Package as VSIX

```bash
npm run package
```

Install the generated `.vsix`:

```bash
code --install-extension wayfinder-0.1.0.vsix
```

## 📋 Requirements

| Requirement                |     Minimum | Notes                                                                          |
| -------------------------- | ----------: | ------------------------------------------------------------------------------ |
| VS Code                    |      1.99.0 | Extension host, webview, and configuration APIs                                |
| Node.js                    |         22  | Required for development build only                                            |
| Remote - SSH extension     |    Optional | Required only for opening SSH workspace targets                                |
| SSH config file            |    Optional | `~/.ssh/config` or path from `remote.SSH.configFile`; enables host import     |
| VS Code workspace          | Required for data | Pin workspaces, groups, and recent targets through the dashboard         |

Supported operating systems:

- macOS
- Linux
- Windows

## 🚀 Usage

Open the dashboard via:

- **Command Palette** → `Wayfinder: Open Dashboard`
- **Status bar** → `$(home) Wayfinder` item (left-aligned)
- **Automatic** → when `wayfinder.openOnEmptyWindow` is `true` and VS Code starts without a folder

### Opening workspaces

| Action              | Result                                                       |
| ------------------- | ------------------------------------------------------------ |
| Click **Open here** | Opens the workspace in the current window                    |
| Click **Open new**  | Opens the workspace in a new window                          |
| Click a recent      | Opens the recent target (local, SSH, or workspace file)      |
| Click a SSH host    | Creates a new SSH workspace target pre-filled with the alias |

### Sidebar actions

| Action              | Shortcut                                         |
| ------------------- | ------------------------------------------------ |
| New File            | Quick Actions → New File                         |
| Open Folder         | Quick Actions → Open Folder                      |
| Clone Repository    | Quick Actions → Clone Repository                 |
| Extensions          | Quick Actions → Extensions                       |
| Search              | Type in the sidebar search box                   |
| Clear search        | Click the **×** button in the search toolbar     |
| Resize sections     | Drag the splitter between Recent and Remote      |
| Collapse section    | Click the section heading                        |

## ⚙️ Configuration

```jsonc
{
  "wayfinder.groups": [
    { "id": "main-projects", "name": "Main Projects", "order": 10 },
    { "id": "servers", "name": "Servers", "order": 20 }
  ],
  "wayfinder.workspaces": [
    {
      "id": "my-project",
      "groupId": "main-projects",
      "name": "My Project",
      "kind": "local",
      "path": "/home/user/projects/my-project",
      "color": "blue",
      "badge": "MP"
    },
    {
      "id": "prod-server",
      "groupId": "servers",
      "name": "Production",
      "kind": "ssh",
      "host": "prod.example.com",
      "path": "/srv/app",
      "color": "red"
    },
    {
      "id": "mono-workspace",
      "groupId": "main-projects",
      "name": "Monorepo",
      "kind": "workspaceFile",
      "path": "/home/user/mono/mono.code-workspace",
      "color": "purple"
    }
  ],
  "wayfinder.openOnEmptyWindow": false,
  "wayfinder.importSshHosts": true
}
```

### Settings

| Setting                     | Type                | Default | Description                                                  |
| --------------------------- | ------------------- | ------- | ------------------------------------------------------------ |
| `wayfinder.groups`          | `WayfinderGroup[]`  | `[]`    | Pinned workspace groups with id, name, and order             |
| `wayfinder.workspaces`      | `WorkspaceTarget[]` | `[]`    | Pinned local, SSH, and workspace-file targets                |
| `wayfinder.openOnEmptyWindow` | `boolean`         | `false` | Open Wayfinder automatically on empty window startup         |
| `wayfinder.importSshHosts`  | `boolean`           | `true`  | Import SSH host aliases from the configured SSH config file  |

### Workspace colors

`purple` · `blue` · `green` · `orange` · `pink` · `red` · `yellow` · `teal` · `cyan` · `gray`

### ID format

Group and workspace IDs must be lowercase kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). The dashboard auto-generates IDs from names; manual edits are validated at runtime.

## 🧩 How It Works

Wayfinder treats VS Code's Configuration API and the Remote - SSH extension as its external contracts:

```text
SettingsService          -> reads/writes wayfinder.* via VS Code Configuration API
SshConfigService         -> parses ~/.ssh/config with recursive Include support
RecentTargetsService     -> merges _workbench.getRecentlyOpened with stored history
WorkspaceService         -> routes open() to local / SSH / workspace-file openers
HubPanel                 -> webview manager, snapshot push, message dispatch
```

The webview receives a `DashboardSnapshot` containing settings, recent targets, SSH hosts, and configuration errors. User interactions generate `WebviewMessage` commands routed through a dispatch table to the appropriate service.

Runtime metrics flow:

1. `SettingsService.read()` validates configuration and collects errors.
2. `RecentTargetsService.list()` merges native + stored recents (fingerprint-deduped).
3. `SshConfigService.listHosts()` parses SSH config recursively.
4. `HubPanel.postSnapshot()` pushes the merged snapshot to the webview.
5. Webview renders sidebar, workspace panel, and inline editors.

## 🧱 Architecture

| Layer              | Responsibility                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `shared/`          | Domain types and protocol definitions shared between extension host and webview            |
| `src/services/`    | SettingsService, RecentTargetsService, SshConfigService, WorkspaceService, RemoteWorkspaceOpener |
| `src/validation/`  | ConfigValidation, WorkspaceTargetValidation, MessageValidation                             |
| `src/utils/`       | Nonce, Paths, UriFactory, type guards                                                       |
| `webview/src/lib/` | Icons, DOM helpers, slug generation, badge helpers, workspace target builder               |
| `webview/src/components/` | Sidebar, WorkspaceCard, WorkspaceEditor, GroupEditor, RecentTargetItem, RemoteHostItem |
| `webview/src/controllers/` | DragController — drag-and-drop state and event handlers                                |

See [docs/architecture.md](docs/architecture.md) for the full diagram and data flow.

## 🛠️ Development

Build:

```bash
npm run compile      # Build extension + webview via esbuild
```

Watch:

```bash
npm run watch        # Rebuild on change
```

Type-check:

```bash
npm run typecheck    # tsc --noEmit for both extension and webview
```

Test:

```bash
npm test             # node:test via tsx
```

Package:

```bash
npm run package      # Compile + vsce package -> .vsix
```

Before opening a pull request, run typecheck and tests locally.

## 🧭 Project Goals

Wayfinder aims to be:

- workspace-native
- organized with groups and visual cues
- cross-platform through VS Code
- useful with local, remote SSH, and workspace-file targets
- conservative with configuration validation
- non-crashing when optional data is missing
- complementary to VS Code's built-in recent list, not a replacement

## 🚧 Roadmap

- Publish to the VS Code Marketplace
- Add sidebar filter by kind (local / SSH / workspace-file)
- Add workspace card drag-and-drop between windows
- Add richer screenshots and usage GIFs
- Add integration tests for the webview message round-trip
- Add workspace status indicators (git branch, dirty state)

## 🐛 Troubleshooting

### SSH host aliases not appearing

Verify that `wayfinder.importSshHosts` is `true` and your SSH config file is readable. The config path is taken from `remote.SSH.configFile` or defaults to `~/.ssh/config`.

### SSH workspace target does not open

Install the [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension. Wayfinder activates it automatically before opening.

### Configuration warnings banner appears

Check the `wayfinder.groups` and `wayfinder.workspaces` arrays in your `settings.json` for invalid entries. The banner lists each validation error. Invalid values are replaced with safe defaults; the dashboard remains usable.

### Recent targets are empty

Wayfinder merges VS Code's native recently-opened list with its own stored history. If both are empty, open a folder or workspace first and it will appear after the next snapshot refresh.

### Colors or layout look wrong

Wayfinder uses VS Code theme variables. Ensure you are running a recent VS Code version and a standard theme. Custom CSS extensions may interfere with webview styling.

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Keep changes focused
4. Add or update tests when behavior changes
5. Run `npm run typecheck`
6. Run `npm test`
7. Open a pull request

## 💜 Built With

Wayfinder is built with [TypeScript](https://www.typescriptlang.org/), [esbuild](https://esbuild.github.io/), [VS Code Extension API](https://code.visualstudio.com/api), [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh), and [GitHub Copilot](https://github.com/features/copilot).

It started as a simple question:

> "What if switching workspaces felt like a dashboard instead of a menu?"

Then it became a weekend of webview panels, drag-and-drop, SSH config parsing, and just enough AI-assisted coding to keep things fun.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
