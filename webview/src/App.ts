import type {
  DashboardSnapshot,
  RecentTarget,
  WayfinderGroup,
  WebviewApi,
  WebviewMessage,
  WorkspaceTarget
} from "./protocol";

const WORKSPACE_COLORS = [
  "purple",
  "blue",
  "green",
  "orange",
  "pink",
  "gray"
] as const;

type IconName =
  | "add"
  | "clone"
  | "edit"
  | "extensions"
  | "folderOpen"
  | "newFile"
  | "openExternal"
  | "trash";

export class App {
  private currentSnapshot: DashboardSnapshot | undefined;
  private editingGroup: WayfinderGroup | undefined;
  private editingWorkspace: WorkspaceTarget | undefined;
  private draggingGroupId: string | undefined;
  private draggingWorkspaceId: string | undefined;
  private draggingWorkspaceSourceGroupId: string | undefined;

  public constructor(
    private readonly root: HTMLElement,
    private readonly vscode: WebviewApi
  ) { }

  public render(snapshot: DashboardSnapshot | undefined): void {
    this.currentSnapshot = snapshot;
    this.root.replaceChildren();

    if (!snapshot) {
      this.root.append(this.createLoadingState());
      return;
    }

    const shell = document.createElement("main");
    shell.className = "wayfinder-shell";

    shell.append(
      this.createRecentPanel(snapshot),
      this.createWorkspacePanel(snapshot),
      this.createUtilityPanel(snapshot)
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

  private createRecentPanel(snapshot: DashboardSnapshot): HTMLElement {
    const panel = this.createPanel("Recent Targets", "wayfinder-panel recent-panel");
    const list = document.createElement("div");
    list.className = "recent-list";

    if (snapshot.recentTargets.length === 0) {
      list.append(this.createEmptyState("No recent targets yet."));
    } else {
      for (const target of snapshot.recentTargets) {
        list.append(this.createRecentItem(target));
      }
    }

    panel.append(list);
    return panel;
  }

  private createWorkspacePanel(snapshot: DashboardSnapshot): HTMLElement {
    const panel = this.createPanel("Pinned Workspaces", "wayfinder-panel workspace-panel");
    const headingActions = document.createElement("div");
    headingActions.className = "panel-heading-actions";

    const addGroupButton = this.createIconButton("add", "Add group", () => {
      this.editingWorkspace = undefined;
      this.editingGroup = this.createNewGroup(snapshot);
      this.rerenderCurrentSnapshot();
    });
    headingActions.append(addGroupButton);
    panel.firstElementChild?.after(headingActions);

    const groups = [...snapshot.settings.groups].sort(
      (left, right) => left.order - right.order || left.name.localeCompare(right.name)
    );
    const groupListHint = document.createElement("p");
    groupListHint.className = "sort-hint";
    groupListHint.textContent = "Drag groups and workspace cards to reorder them.";
    panel.append(groupListHint);

    if (groups.length === 0) {
      panel.append(this.createEmptyState("Add a group to start pinning workspace targets."));
    }

    for (const group of groups) {
      const section = document.createElement("section");
      section.className = "workspace-group";
      section.dataset.groupId = group.id;
      section.draggable = true;
      this.configureGroupDragAndDrop(section);

      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header";

      const groupTitle = document.createElement("div");
      groupTitle.className = "group-title";

      const groupDragHandle = this.createDragHandle("Reorder group");
      const heading = document.createElement("h2");
      heading.textContent = group.name;
      groupTitle.append(groupDragHandle, heading);

      const groupActions = document.createElement("div");
      groupActions.className = "group-actions";
      groupActions.append(
        this.createIconButton("add", "Add workspace", () => {
          this.editingGroup = undefined;
          this.editingWorkspace = this.createNewWorkspace(group.id, snapshot);
          this.rerenderCurrentSnapshot();
        }),
        this.createIconButton("edit", "Edit group", () => {
          this.editingWorkspace = undefined;
          this.editingGroup = group;
          this.rerenderCurrentSnapshot();
        }),
        this.createIconButton("trash", "Remove group", () => {
          this.postMessage({ type: "removeGroup", groupId: group.id });
        }, "destructive-icon-button")
      );

      groupHeader.append(groupTitle, groupActions);
      section.append(groupHeader);

      const workspaceGrid = document.createElement("div");
      workspaceGrid.className = "workspace-grid";
      workspaceGrid.dataset.groupId = group.id;
      this.configureWorkspaceGridDragAndDrop(workspaceGrid);
      const workspaces = snapshot.settings.workspaces
        .filter((workspace) => workspace.groupId === group.id)
        .sort(
          (left, right) => left.order - right.order || left.name.localeCompare(right.name)
        );

      if (workspaces.length === 0) {
        workspaceGrid.append(this.createEmptyState("No pinned workspaces."));
      } else {
        for (const workspace of workspaces) {
          workspaceGrid.append(this.createWorkspaceCard(workspace));
        }
      }

      section.append(workspaceGrid);
      panel.append(section);
    }

    if (this.editingGroup) {
      panel.append(this.createGroupEditor(this.editingGroup));
    }

    if (this.editingWorkspace) {
      panel.append(this.createWorkspaceEditor(this.editingWorkspace, snapshot));
    }

    return panel;
  }

  private createUtilityPanel(snapshot: DashboardSnapshot): HTMLElement {
    const panel = this.createPanel("Quick Actions", "wayfinder-panel utility-panel");
    const actionList = document.createElement("div");
    actionList.className = "quick-action-list";

    actionList.append(
      this.createQuickAction("New File", "newFile"),
      this.createQuickAction("Open Folder", "openFolder"),
      this.createQuickAction("Clone Repository", "cloneRepository"),
      this.createQuickAction("Extensions", "extensions")
    );

    const remoteHeading = document.createElement("h2");
    remoteHeading.className = "subheading";
    remoteHeading.textContent = "Remote Hosts";

    const remoteList = document.createElement("div");
    remoteList.className = "remote-host-list";

    if (!snapshot.settings.importSshHosts) {
      remoteList.append(this.createEmptyState("SSH host import is disabled."));
    } else if (snapshot.sshHosts.length === 0) {
      remoteList.append(this.createEmptyState("No SSH host aliases found."));
    } else {
      for (const host of snapshot.sshHosts) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "remote-host-item";
        item.textContent = host.alias;
        item.title = `Create SSH workspace for ${host.alias}`;
        item.addEventListener("click", () => {
          this.createSshWorkspaceForHost(host.alias, snapshot);
        });
        remoteList.append(item);
      }
    }

    panel.append(actionList, remoteHeading, remoteList);
    return panel;
  }

  private createRecentItem(target: RecentTarget): HTMLElement {
    const item = document.createElement("article");
    item.className = "recent-item";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "recent-open";
    openButton.textContent = target.name;
    openButton.title = target.path;
    openButton.addEventListener("click", () => {
      this.postMessage({ type: "openRecent", fingerprint: target.fingerprint });
    });

    const detail = document.createElement("span");
    detail.className = "target-detail";
    detail.textContent = target.kind === "ssh" ? `${target.host}:${target.path}` : target.path;

    const removeButton = this.createIconButton("trash", "Remove recent target", () => {
      this.postMessage({ type: "removeRecent", fingerprint: target.fingerprint });
    }, "destructive-icon-button");

    item.append(openButton, detail, removeButton);
    return item;
  }

  private createWorkspaceCard(workspace: WorkspaceTarget): HTMLElement {
    const card = document.createElement("article");
    card.className = "workspace-card";
    card.dataset.color = workspace.color ?? "gray";
    card.dataset.workspaceId = workspace.id;
    card.draggable = true;
    this.configureWorkspaceDragAndDrop(card);

    const dragHandle = this.createDragHandle("Reorder workspace");
    const title = document.createElement("h3");
    title.textContent = workspace.name;

    const metadata = this.createWorkspaceMetadata(workspace);

    const detail = document.createElement("p");
    detail.className = "target-detail";
    detail.textContent = workspace.kind === "ssh"
      ? `${workspace.host}:${workspace.path}`
      : workspace.path;

    const actions = document.createElement("div");
    actions.className = "workspace-actions";

    const openHere = this.createIconButton("folderOpen", "Open here", () => {
      this.postMessage({ type: "openWorkspace", workspaceId: workspace.id, forceNewWindow: false });
    });

    const openNewWindow = this.createIconButton("openExternal", "Open in new window", () => {
      this.postMessage({ type: "openWorkspace", workspaceId: workspace.id, forceNewWindow: true });
    });

    const edit = this.createIconButton("edit", "Edit workspace", () => {
      this.editingGroup = undefined;
      this.editingWorkspace = workspace;
      this.rerenderCurrentSnapshot();
    });

    const remove = this.createIconButton("trash", "Remove workspace", () => {
      this.postMessage({ type: "removeWorkspace", workspaceId: workspace.id });
    }, "destructive-icon-button");

    actions.append(openHere, openNewWindow, edit, remove);
    card.append(dragHandle, title, metadata, detail, actions);
    return card;
  }

  private createWorkspaceMetadata(workspace: WorkspaceTarget): HTMLElement {
    const metadata = document.createElement("div");
    metadata.className = "workspace-metadata";

    const kindBadge = document.createElement("span");
    kindBadge.className = "workspace-badge";
    kindBadge.dataset.kind = workspace.kind;
    kindBadge.textContent = workspace.kind === "ssh"
      ? "SSH"
      : workspace.kind === "workspaceFile"
        ? "Workspace"
        : "Local";
    metadata.append(kindBadge);


    return metadata;
  }
  private createDragHandle(label: string): HTMLElement {
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.textContent = "⠿";
    handle.title = label;
    handle.setAttribute("aria-label", label);
    handle.setAttribute("role", "img");
    return handle;
  }


  private createGroupEditor(group: WayfinderGroup): HTMLElement {
    const editor = document.createElement("section");
    editor.className = "editor-card";

    const title = document.createElement("h2");
    title.textContent = this.currentSnapshot?.settings.groups.some((item) => item.id === group.id)
      ? "Edit group"
      : "Add group";

    const form = document.createElement("form");
    form.className = "editor-form";

    const nameInput = this.createTextField("Name", group.name, "e.g. ALBA");
    nameInput.input.required = true;

    const actions = this.createEditorActions(() => {
      const name = nameInput.input.value.trim();
      const id = group.id || this.createSlug(name);

      if (!id) {
        return;
      }

      this.postMessage({
        type: "saveGroup",
        group: {
          id,
          name,
          order: group.order
        }
      });
      this.editingGroup = undefined;
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.save.click();
    });

    form.append(nameInput.field, actions.container);
    editor.append(title, form);
    return editor;
  }

  private createWorkspaceEditor(
    workspace: WorkspaceTarget,
    snapshot: DashboardSnapshot
  ): HTMLElement {
    const editor = document.createElement("section");
    editor.className = "editor-card";

    const title = document.createElement("h2");
    title.textContent = snapshot.settings.workspaces.some((item) => item.id === workspace.id)
      ? "Edit workspace"
      : "Add workspace";

    const form = document.createElement("form");
    form.className = "editor-form";


    const nameInput = this.createTextField("Name", workspace.name, "Visible name");
    nameInput.input.required = true;

    const groupInput = this.createSelectField("Group", snapshot.settings.groups.map((group) => ({
      label: group.name,
      value: group.id
    })), workspace.groupId);
    groupInput.input.required = true;

    const kindInput = this.createSelectField("Kind", [
      { label: "Local folder", value: "local" },
      { label: "Remote SSH", value: "ssh" },
      { label: ".code-workspace file", value: "workspaceFile" }
    ], workspace.kind);

    const hostInput = this.createTextField(
      "SSH host",
      workspace.kind === "ssh" ? workspace.host ?? "" : "",
      "SSH alias"
    );
    hostInput.input.required = workspace.kind === "ssh";

    const pathInput = this.createTextField("Path", workspace.path, "/absolute/path");
    pathInput.input.required = true;

    const colorInput = this.createSelectField("Color", [
      { label: "Default", value: "" },
      ...WORKSPACE_COLORS.map((color) => ({ label: color, value: color }))
    ], workspace.color ?? "");


    const updateKindFields = (): void => {
      const isSsh = kindInput.input.value === "ssh";
      hostInput.field.hidden = !isSsh;
      hostInput.input.required = isSsh;
      pathInput.input.placeholder = kindInput.input.value === "workspaceFile"
        ? "/absolute/project.code-workspace"
        : isSsh
          ? "/absolute/remote/path"
          : "/absolute/local/path";
    };
    kindInput.input.addEventListener("change", updateKindFields);
    updateKindFields();

    const actions = this.createEditorActions(() => {
      const kind = kindInput.input.value as WorkspaceTarget["kind"];
      const name = nameInput.input.value.trim();
      const groupId = groupInput.input.value;
      const common = {
        id: this.createWorkspaceId(workspace.id, groupId, name, snapshot),
        groupId,
        name,
        order: workspace.order,
        path: pathInput.input.value.trim(),
        ...(colorInput.input.value ? { color: colorInput.input.value } : {})
      };

      const target: WorkspaceTarget = kind === "ssh"
        ? {
          ...common,
          kind: "ssh",
          host: hostInput.input.value.trim()
        }
        : kind === "workspaceFile"
          ? { ...common, kind: "workspaceFile" }
          : { ...common, kind: "local" };

      this.postMessage({ type: "saveWorkspace", workspace: target });
      this.editingWorkspace = undefined;
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      actions.save.click();
    });

    form.append(
      nameInput.field,
      groupInput.field,
      kindInput.field,
      hostInput.field,
      pathInput.field,
      colorInput.field,
      actions.container
    );
    editor.append(title, form);
    return editor;
  }

  private createQuickAction(
    label: string,
    command: Extract<WebviewMessage, { type: "runCommand" }>["command"]
  ): HTMLButtonElement {
    const icons: Record<typeof command, IconName> = {
      newFile: "newFile",
      openFolder: "folderOpen",
      cloneRepository: "clone",
      extensions: "extensions"
    };

    return this.createIconButton(icons[command], label, () => {
      this.postMessage({ type: "runCommand", command });
    }, "quick-action-button");
  }

  private createPanel(title: string, className: string): HTMLElement {
    const panel = document.createElement("section");
    panel.className = className;

    const heading = document.createElement("h1");
    heading.textContent = title;

    panel.append(heading);
    return panel;
  }

  private createTextField(label: string, value: string, placeholder: string): {
    field: HTMLElement;
    input: HTMLInputElement;
  } {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.placeholder = placeholder;

    return {
      field: this.createLabeledField(label, input),
      input
    };
  }


  private createSelectField(
    label: string,
    options: ReadonlyArray<{ label: string; value: string }>,
    value: string
  ): {
    field: HTMLElement;
    input: HTMLSelectElement;
  } {
    const input = document.createElement("select");

    for (const optionDefinition of options) {
      const option = document.createElement("option");
      option.value = optionDefinition.value;
      option.textContent = optionDefinition.label;
      option.selected = optionDefinition.value === value;
      input.append(option);
    }

    return {
      field: this.createLabeledField(label, input),
      input
    };
  }

  private createLabeledField(label: string, input: HTMLElement): HTMLElement {
    const field = document.createElement("label");
    field.className = "form-field";

    const title = document.createElement("span");
    title.textContent = label;

    field.append(title, input);
    return field;
  }


  private createEditorActions(onSave: () => void): {
    container: HTMLElement;
    save: HTMLButtonElement;
  } {
    const container = document.createElement("div");
    container.className = "editor-actions";

    const save = this.createButton("Save", () => {
      const form = save.closest("form");
      if (form && !form.reportValidity()) {
        return;
      }

      onSave();
    });
    save.type = "button";

    const cancel = this.createButton("Cancel", () => {
      this.editingGroup = undefined;
      this.editingWorkspace = undefined;
      this.rerenderCurrentSnapshot();
    });
    cancel.classList.add("secondary-button");

    container.append(save, cancel);
    return { container, save };
  }

  private createEmptyState(message: string): HTMLElement {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = message;
    return emptyState;
  }

  private createButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  private createIconButton(
    icon: IconName,
    label: string,
    onClick: () => void,
    additionalClassName?: string
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("icon-button");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.append(this.createIcon(icon));
    button.addEventListener("click", onClick);

    if (additionalClassName) {
      button.classList.add(additionalClassName);
    }

    return button;
  }

  private createIcon(icon: IconName): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const paths: Record<IconName, string> = {
      add: "M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z",
      clone: "M7 4a3 3 0 0 0-3 3v8h2V7a1 1 0 0 1 1-1h4V4H7zm10 5a3 3 0 0 0-3 3v1h-3v2h3v1a3 3 0 0 0 3 3h3v-2h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3V9h-3zm-7 4H8v2h2v-2z",
      edit: "m16.86 3.14 4 4L9.5 18.5 4 20l1.5-5.5L16.86 3.14zm0 2.83-9.54 9.54-.63 2.33 2.33-.63 9.54-9.54-1.7-1.7z",
      extensions: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
      folderOpen: "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10zm2.5-.5a.5.5 0 0 0-.5.5v2h14V8.5a.5.5 0 0 0-.5-.5h-7.33l-2-2H5.5zM5 10.5v6a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-6H5z",
      newFile: "M6 3h8l4 4v14H6V3zm7 2.5V8h2.5L13 5.5zM11 11H9v3H6v2h3v3h2v-3h3v-2h-3v-3z",
      openExternal: "M14 4v2h2.59l-7.3 7.29 1.42 1.42L18 7.41V10h2V4h-6zM5 6h6v2H7v9h9v-4h2v6H5V6z",
      trash: "M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h2v8H7V9zm4 0h2v8h-2V9zm4 0h2v8h-2V9z"
    };

    path.setAttribute("d", paths[icon]);
    svg.append(path);
    return svg;
  }

  private createSmallButton(
    label: string,
    onClick: () => void,
    additionalClassName?: string
  ): HTMLButtonElement {
    const button = this.createButton(label, onClick);
    button.classList.add("small-button");

    if (additionalClassName) {
      button.classList.add(additionalClassName);
    }

    return button;
  }

  private createSshWorkspaceForHost(
    host: string,
    snapshot: DashboardSnapshot
  ): void {
    const group = [...snapshot.settings.groups].sort(
      (left, right) => left.order - right.order || left.name.localeCompare(right.name)
    )[0];

    if (!group) {
      return;
    }

    const workspace = this.createNewWorkspace(group.id, snapshot);
    this.editingGroup = undefined;
    this.editingWorkspace = {
      ...workspace,
      kind: "ssh",
      host
    };
    this.rerenderCurrentSnapshot();
  }

  private createNewGroup(snapshot: DashboardSnapshot): WayfinderGroup {
    const nextOrder = Math.max(0, ...snapshot.settings.groups.map((group) => group.order)) + 10;
    return {
      id: "",
      name: "",
      order: nextOrder
    };
  }

  private createNewWorkspace(
    groupId: string,
    snapshot: DashboardSnapshot
  ): WorkspaceTarget {
    const groupOrders = snapshot.settings.workspaces
      .filter((workspace) => workspace.groupId === groupId)
      .map((workspace) => workspace.order);

    return {
      id: "",
      groupId,
      name: "",
      order: Math.max(0, ...groupOrders) + 10,
      kind: "local",
      path: ""
    };
  }

  private configureGroupDragAndDrop(section: HTMLElement): void {
    section.addEventListener("dragstart", (event) => {
      const groupId = section.dataset.groupId;
      if (!groupId || !event.dataTransfer) {
        return;
      }

      this.draggingGroupId = groupId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", groupId);
      section.classList.add("dragging");
    });

    section.addEventListener("dragend", () => {
      this.draggingGroupId = undefined;
      section.classList.remove("dragging");
    });

    section.addEventListener("dragover", (event) => {
      if (!this.draggingGroupId) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    section.addEventListener("drop", (event) => {
      const sourceId = this.draggingGroupId;
      const container = section.parentElement;
      if (!sourceId || !container || sourceId === section.dataset.groupId) {
        return;
      }

      const source = Array.from(container.children).find(
        (element) => element instanceof HTMLElement && element.dataset.groupId === sourceId
      );
      if (!(source instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      this.swapChildren(container, source, section);

      const groupIds = Array.from(container.children)
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .filter((element) => element.classList.contains("workspace-group"))
        .map((element) => element.dataset.groupId)
        .filter((id): id is string => typeof id === "string");
      this.postMessage({ type: "reorderGroups", groupIds });
    });
  }

  private configureWorkspaceDragAndDrop(card: HTMLElement): void {
    card.addEventListener("dragstart", (event) => {
      const workspaceId = card.dataset.workspaceId;
      if (!workspaceId || !event.dataTransfer) {
        return;
      }

      event.stopPropagation();
      this.draggingWorkspaceId = workspaceId;
      this.draggingWorkspaceSourceGroupId = card.parentElement?.dataset.groupId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", workspaceId);
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      this.draggingWorkspaceId = undefined;
      this.draggingWorkspaceSourceGroupId = undefined;
      card.classList.remove("dragging");
    });

    card.addEventListener("dragover", (event) => {
      if (!this.draggingWorkspaceId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    card.addEventListener("drop", (event) => {
      const sourceId = this.draggingWorkspaceId;
      const sourceGroupId = this.draggingWorkspaceSourceGroupId;
      const targetGroupId = card.parentElement?.dataset.groupId;
      const container = card.parentElement;

      if (!sourceId || !sourceGroupId || !targetGroupId || !container || sourceId === card.dataset.workspaceId) {
        return;
      }

      const source = this.findWorkspaceCard(sourceId);
      if (!source) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (sourceGroupId === targetGroupId) {
        this.swapChildren(container, source, card);
        this.persistWorkspaceOrder(container);
        return;
      }

      container.insertBefore(source, card);
      this.persistWorkspaceMove(sourceId, sourceGroupId, container);
    });
  }

  private configureWorkspaceGridDragAndDrop(grid: HTMLElement): void {
    grid.addEventListener("dragover", (event) => {
      if (!this.draggingWorkspaceId) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    grid.addEventListener("drop", (event) => {
      const sourceId = this.draggingWorkspaceId;
      const sourceGroupId = this.draggingWorkspaceSourceGroupId;
      const targetGroupId = grid.dataset.groupId;

      if (
        !sourceId ||
        !sourceGroupId ||
        !targetGroupId ||
        (event.target instanceof HTMLElement && event.target.closest(".workspace-card"))
      ) {
        return;
      }

      const source = this.findWorkspaceCard(sourceId);
      if (!source) {
        return;
      }

      event.preventDefault();
      grid.querySelector(".empty-state")?.remove();
      grid.append(source);

      if (sourceGroupId === targetGroupId) {
        this.persistWorkspaceOrder(grid);
        return;
      }

      this.persistWorkspaceMove(sourceId, sourceGroupId, grid);
    });
  }

  private findWorkspaceCard(workspaceId: string): HTMLElement | undefined {
    return Array.from(this.root.querySelectorAll<HTMLElement>(".workspace-card")).find(
      (card) => card.dataset.workspaceId === workspaceId
    );
  }

  private persistWorkspaceMove(
    workspaceId: string,
    sourceGroupId: string,
    targetGrid: HTMLElement
  ): void {
    const targetGroupId = targetGrid.dataset.groupId;
    const targetWorkspaceIds = Array.from(targetGrid.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => element.classList.contains("workspace-card"))
      .map((element) => element.dataset.workspaceId)
      .filter((id): id is string => typeof id === "string");

    if (targetGroupId && targetWorkspaceIds.length > 0) {
      this.postMessage({
        type: "moveWorkspace",
        workspaceId,
        sourceGroupId,
        targetGroupId,
        targetWorkspaceIds
      });
    }
  }

  private swapChildren(
    container: HTMLElement,
    source: HTMLElement,
    target: HTMLElement
  ): void {
    const placeholder = document.createComment("wayfinder-swap");
    container.replaceChild(placeholder, source);
    container.replaceChild(source, target);
    container.replaceChild(target, placeholder);
  }

  private persistWorkspaceOrder(container: HTMLElement): void {
    const groupId = container.dataset.groupId;
    const workspaceIds = Array.from(container.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => element.classList.contains("workspace-card"))
      .map((element) => element.dataset.workspaceId)
      .filter((id): id is string => typeof id === "string");

    if (groupId && workspaceIds.length > 0) {
      this.postMessage({ type: "reorderWorkspaces", groupId, workspaceIds });
    }
  }

  private createWorkspaceId(
    currentId: string,
    groupId: string,
    name: string,
    snapshot: DashboardSnapshot
  ): string {
    if (currentId) {
      return currentId;
    }

    const nameSlug = this.createSlug(name);
    const baseId = this.createSlug(`${groupId}-${nameSlug}`);
    const existingIds = new Set(
      snapshot.settings.workspaces.map((workspace) => workspace.id)
    );

    if (!existingIds.has(baseId)) {
      return baseId;
    }

    let suffix = 2;
    while (existingIds.has(`${baseId}-${suffix}`)) {
      suffix += 1;
    }

    return `${baseId}-${suffix}`;
  }

  private createSlug(value: string): string {
    return value
      .trim()
      .toLocaleLowerCase()
      .replace(/ı/g, "i")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private rerenderCurrentSnapshot(): void {
    this.render(this.currentSnapshot);
  }

  private postMessage(message: WebviewMessage): void {
    this.vscode.postMessage(message);
  }
}