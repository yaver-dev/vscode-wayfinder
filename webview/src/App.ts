import type {
  DashboardSnapshot,
  RecentTarget,
  WayfinderGroup,
  WebviewApi,
  WebviewMessage,
  WorkspaceTarget
} from "./protocol";
import type { IconName } from "./lib/Icons";
import {
  createIconButton,
  createDragHandle,
  createEmptyState
} from "./lib/dom";
import {
  createNewGroup,
  createNewWorkspace,
  createSshWorkspaceForHost,
  pinRecentToWorkspace
} from "./lib/workspaceBuilder";
import { DragController } from "./controllers/DragController";
import { createSidebar } from "./components/Sidebar";
import { createWorkspaceCard } from "./components/WorkspaceCard";
import { createGroupEditor } from "./components/GroupEditor";
import { createWorkspaceEditor } from "./components/WorkspaceEditor";

export class App {
  private currentSnapshot: DashboardSnapshot | undefined;
  private editingGroup: WayfinderGroup | undefined;
  private editingWorkspace: WorkspaceTarget | undefined;
  private sidebarSearchQuery = "";
  private readonly sidebarSectionExpansion = new Map<string, boolean>([
    ["recent", true],
    ["remoteHosts", false]
  ]);
  private readonly dragController: DragController;
  private skipSnapshot = false;

  public constructor(
    private readonly root: HTMLElement,
    private readonly vscode: WebviewApi
  ) {
    this.dragController = new DragController(root, {
      onReorderGroups: (groupIds) => {
        this.skipSnapshot = true;
        this.postMessage({ type: "reorderGroups", groupIds });
      },
      onReorderWorkspaces: (groupId, workspaceIds) => {
        this.skipSnapshot = true;
        this.postMessage({ type: "reorderWorkspaces", groupId, workspaceIds });
      },
      onMoveWorkspace: (workspaceId, sourceGroupId, targetGroupId, targetWorkspaceIds) => {
        this.skipSnapshot = true;
        this.postMessage({ type: "moveWorkspace", workspaceId, sourceGroupId, targetGroupId, targetWorkspaceIds });
      },
      postMessage: (msg) => this.postMessage(msg)
    });
  }

  public render(snapshot: DashboardSnapshot | undefined): void {
    this.currentSnapshot = snapshot;
    this.root.replaceChildren();

    if (!snapshot) {
      this.root.append(this.createLoadingState());
      return;
    }

    const shell = document.createElement("main");
    shell.className = "wayfinder-shell";

    if (snapshot.configurationErrors.length > 0) {
      shell.append(this.createConfigurationErrorBanner(snapshot.configurationErrors));
    }

    shell.append(
      this.createSidebar(snapshot),
      this.createWorkspacePanel(snapshot)
    );
    this.root.append(shell);
  }

  private createLoadingState(): HTMLElement {
    const container = document.createElement("main");
    container.className = "wayfinder-loading";
    const title = document.createElement("h1");
    title.textContent = "Wayfinder";
    const message = document.createElement("p");
    message.textContent = "Loading dashboard…";
    container.append(title, message);
    return container;
  }

  private createConfigurationErrorBanner(errors: string[]): HTMLElement {
    const banner = document.createElement("div");
    banner.className = "wayfinder-error-banner";

    const heading = document.createElement("strong");
    heading.textContent = "Configuration warnings";

    const list = document.createElement("ul");
    for (const error of errors) {
      const item = document.createElement("li");
      item.textContent = error;
      list.append(item);
    }

    banner.append(heading, list);
    return banner;
  }

  private createSidebar(snapshot: DashboardSnapshot): HTMLElement {
    return createSidebar(snapshot, this.sidebarSearchQuery, this.sidebarSectionExpansion, {
      onOpenRecent: (fingerprint) =>
        this.postMessage({ type: "openRecent", fingerprint }),
      onRemoveRecent: (fingerprint) =>
        this.postMessage({ type: "removeRecent", fingerprint }),
      onPinRecent: (target) => this.pinRecentTarget(target),
      onAddSshWorkspace: (hostAlias) => {
        const group = [...snapshot.settings.groups].sort(
          (a, b) => a.order - b.order || a.name.localeCompare(b.name)
        )[0];
        if (!group) return;
        this.editingGroup = undefined;
        this.editingWorkspace = createSshWorkspaceForHost(hostAlias, group, snapshot.settings.workspaces);
        this.rerenderCurrentSnapshot();
      },
      postMessage: (msg) => this.postMessage(msg)
    });
  }

  private createWorkspacePanel(snapshot: DashboardSnapshot): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "wayfinder-panel workspace-panel";

    panel.append(this.createQuickActionsBar());

    const heading = document.createElement("h1");
    heading.textContent = "Pinned Workspaces";
    panel.append(heading);

    const headingActions = document.createElement("div");
    headingActions.className = "panel-heading-actions";
    const addGroupButton = createIconButton("add", "Add group", () => {
      this.editingWorkspace = undefined;
      this.editingGroup = createNewGroup(snapshot.settings.groups);
      this.rerenderCurrentSnapshot();
    });
    headingActions.append(addGroupButton);
    heading.after(headingActions);

    const groups = [...snapshot.settings.groups].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name)
    );
    const hint = document.createElement("p");
    hint.className = "sort-hint";
    hint.textContent = "Drag groups and workspace cards to reorder them.";
    panel.append(hint);

    if (groups.length === 0) {
      panel.append(createEmptyState("Add a group to start pinning workspace targets."));
    }

    for (const group of groups) {
      panel.append(this.createGroupSection(group, snapshot));
    }

    if (this.editingGroup) {
      panel.append(createGroupEditor(this.editingGroup, this.currentSnapshot?.settings.groups.some((g) => g.id === this.editingGroup!.id) ?? false, {
        onSave: () => { this.editingGroup = undefined; },
        onCancel: () => { this.editingGroup = undefined; this.rerenderCurrentSnapshot(); },
        postMessage: (msg) => this.postMessage(msg)
      }));
    }

    if (this.editingWorkspace) {
      panel.append(createWorkspaceEditor(this.editingWorkspace, snapshot, {
        onSave: () => { this.editingWorkspace = undefined; },
        onCancel: () => { this.editingWorkspace = undefined; this.rerenderCurrentSnapshot(); },
        postMessage: (msg) => this.postMessage(msg)
      }));
    }

    return panel;
  }

  private createQuickActionsBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = "quick-actions-bar";

    const label = document.createElement("span");
    label.className = "quick-actions-bar-label";
    label.textContent = "Quick Actions:";
    bar.append(label);

    const actions = document.createElement("div");
    actions.className = "quick-actions-bar-items";

    const commands: Array<{ label: string; command: "newFile" | "openFolder" | "cloneRepository" | "extensions" | "theme" | "keymap" | "settings"; icon: IconName }> = [
      { label: "New File", command: "newFile", icon: "newFile" },
      { label: "Open Folder", command: "openFolder", icon: "folderOpen" },
      { label: "Clone Repository", command: "cloneRepository", icon: "clone" },
      { label: "Extensions", command: "extensions", icon: "extensions" },
      { label: "Theme", command: "theme", icon: "theme" },
      { label: "Keymap", command: "keymap", icon: "keymap" },
      { label: "Settings", command: "settings", icon: "settings" }
    ];

    for (const cmd of commands) {
      actions.append(createIconButton(cmd.icon, cmd.label, () => {
        this.postMessage({ type: "runCommand", command: cmd.command });
      }, "quick-action-button"));
    }

    bar.append(actions);
    return bar;
  }

  private createGroupSection(group: WayfinderGroup, snapshot: DashboardSnapshot): HTMLElement {
    const section = document.createElement("section");
    section.className = "workspace-group";
    section.dataset.groupId = group.id;
    section.draggable = true;
    this.dragController.configureGroupDragAndDrop(section);

    const groupHeader = document.createElement("div");
    groupHeader.className = "group-header";

    const groupTitle = document.createElement("div");
    groupTitle.className = "group-title";
    const dragHandle = createDragHandle("Reorder group");
    const heading = document.createElement("h2");
    heading.textContent = group.name;
    groupTitle.append(dragHandle, heading);

    const groupActions = document.createElement("div");
    groupActions.className = "group-actions";
    groupActions.append(
      createIconButton("add", "Add workspace", () => {
        this.editingGroup = undefined;
        this.editingWorkspace = createNewWorkspace(group.id, snapshot.settings.workspaces);
        this.rerenderCurrentSnapshot();
      }),
      createIconButton("edit", "Edit group", () => {
        this.editingWorkspace = undefined;
        this.editingGroup = group;
        this.rerenderCurrentSnapshot();
      }),
      createIconButton("trash", "Remove group", () => {
        this.postMessage({ type: "removeGroup", groupId: group.id });
      }, "destructive-icon-button")
    );

    groupHeader.append(groupTitle, groupActions);
    section.append(groupHeader);

    const grid = document.createElement("div");
    grid.className = "workspace-grid";
    grid.dataset.groupId = group.id;
    this.dragController.configureWorkspaceGridDragAndDrop(grid);

    const workspaces = snapshot.settings.workspaces
      .filter((w) => w.groupId === group.id)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    if (workspaces.length === 0) {
      grid.append(createEmptyState("No pinned workspaces."));
    } else {
      for (const workspace of workspaces) {
        grid.append(createWorkspaceCard(workspace, this.dragController, {
          onOpen: (id, forceNewWindow) =>
            this.postMessage({ type: "openWorkspace", workspaceId: id, forceNewWindow }),
          onEdit: (w) => {
            this.editingGroup = undefined;
            this.editingWorkspace = w;
            this.rerenderCurrentSnapshot();
          },
          onRemove: (id) =>
            this.postMessage({ type: "removeWorkspace", workspaceId: id })
        }));
      }
    }

    section.append(grid);
    return section;
  }

  private pinRecentTarget(target: RecentTarget): void {
    const snapshot = this.currentSnapshot;
    if (!snapshot) return;

    const group = [...snapshot.settings.groups].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name)
    )[0];
    if (!group) return;

    this.editingGroup = undefined;
    this.editingWorkspace = pinRecentToWorkspace(
      target.kind, target.name, target.path, target.host,
      group.id, snapshot.settings.workspaces
    );
    this.rerenderCurrentSnapshot();
  }

  public shouldSkipSnapshot(): boolean {
    return this.skipSnapshot;
  }

  public consumeSkipSnapshot(): void {
    this.skipSnapshot = false;
  }

  private rerenderCurrentSnapshot(): void {
    this.render(this.currentSnapshot);
  }

  private postMessage(message: WebviewMessage): void {
    this.vscode.postMessage(message);
  }
}
