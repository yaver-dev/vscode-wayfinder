import * as vscode from "vscode";
import type {
  DashboardSnapshot,
  ExtensionMessage,
  QuickActionCommand,
  WebviewMessage
} from "./protocol";
import type { RecentTarget, WayfinderGroup, WorkspaceTarget } from "./types";
import { createNonce } from "./utils/Nonce";
import { RecentTargetsService } from "./services/RecentTargetsService";
import { SettingsService } from "./services/SettingsService";
import { SshConfigService } from "./services/SshConfigService";
import { WorkspaceService } from "./services/WorkspaceService";
import { validateGroups, validateWorkspaces } from "./validation/ConfigValidation";
import { validateWorkspaceTarget } from "./validation/WorkspaceTargetValidation";

interface HubPanelDependencies {
  extensionUri: vscode.Uri;
  settingsService: SettingsService;
  recentTargetsService: RecentTargetsService;
  sshConfigService: SshConfigService;
  workspaceService: WorkspaceService;
}

export class HubPanel {
  private static currentPanel: HubPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly dependencies: HubPanelDependencies
  ) {
    this.panel.webview.html = this.createWebviewHtml(this.panel.webview);

    this.disposables.push(
      this.panel.onDidDispose(() => this.dispose()),
      this.panel.onDidChangeViewState(() => {
        if (this.panel.visible) {
          void this.postSnapshot();
        }
      }),
      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        void this.handleMessage(message);
      })
    );
  }

  public static revealOrCreate(dependencies: HubPanelDependencies): void {
    if (HubPanel.currentPanel) {
      HubPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      void HubPanel.currentPanel.postSnapshot();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "wayfinder.dashboard",
      "Wayfinder",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(dependencies.extensionUri, "dist", "webview")
        ]
      }
    );

    HubPanel.currentPanel = new HubPanel(panel, dependencies);
  }

  public static refresh(): void {
    void HubPanel.currentPanel?.postSnapshot();
  }

  public static dispose(): void {
    HubPanel.currentPanel?.dispose();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isWebviewMessage(message)) {
      await this.postError("Wayfinder received an invalid webview message.");
      return;
    }

    try {
      switch (message.type) {
        case "ready":
        case "refresh":
          await this.postSnapshot();
          return;
        case "openWorkspace":
          await this.openConfiguredWorkspace(
            message.workspaceId,
            message.forceNewWindow
          );
          return;
        case "openRecent":
          await this.openRecentTarget(message.fingerprint, message.forceNewWindow);
          return;
        case "removeRecent":
          await this.dependencies.recentTargetsService.remove(message.fingerprint);
          await this.postSnapshot();
          return;
        case "removeWorkspace":
          await this.removeWorkspace(message.workspaceId);
          return;
        case "saveGroup":
          await this.saveGroup(message.group);
          return;
        case "removeGroup":
          await this.removeGroup(message.groupId);
          return;
        case "saveWorkspace":
          await this.saveWorkspace(message.workspace);
          return;
        case "reorderGroups":
          await this.reorderGroups(message.groupIds);
          return;
        case "reorderWorkspaces":
          await this.reorderWorkspaces(message.groupId, message.workspaceIds);
          return;
        case "moveWorkspace":
          await this.moveWorkspace(
            message.workspaceId,
            message.sourceGroupId,
            message.targetGroupId,
            message.targetWorkspaceIds
          );
          return;
        case "runCommand":
          await this.runQuickAction(message.command);
          return;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error.";
      await this.postError(detail);
    }
  }

  private async openConfiguredWorkspace(
    workspaceId: string,
    forceNewWindow?: boolean
  ): Promise<void> {
    const target = this.dependencies.settingsService
      .read()
      .workspaces.find((workspace) => workspace.id === workspaceId);

    if (!target) {
      throw new Error("The selected workspace target no longer exists.");
    }

    await this.openTarget(target, forceNewWindow);
  }

  private async openRecentTarget(
    fingerprint: string,
    forceNewWindow?: boolean
  ): Promise<void> {
    const recentTarget = (await this.dependencies.recentTargetsService.list()).find(
      (entry) => entry.fingerprint === fingerprint
    );

    if (!recentTarget) {
      throw new Error("The selected recent target no longer exists.");
    }

    await this.openTarget(toWorkspaceTarget(recentTarget), forceNewWindow);
  }

  private async openTarget(
    target: WorkspaceTarget,
    forceNewWindow?: boolean
  ): Promise<void> {
    await this.dependencies.recentTargetsService.record(target);
    await this.dependencies.workspaceService.open(target, forceNewWindow);
  }

  private async removeWorkspace(workspaceId: string): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const exists = settings.workspaces.some(
      (workspace) => workspace.id === workspaceId
    );

    if (!exists) {
      throw new Error("The selected workspace target no longer exists.");
    }

    await this.dependencies.settingsService.updateWorkspaces(
      settings.workspaces.filter((workspace) => workspace.id !== workspaceId)
    );
    await this.postSnapshot();
  }

  private async saveGroup(group: WayfinderGroup): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const groupResult = validateGroups([group]);

    if (!groupResult.value) {
      throw new Error(groupResult.errors.join(" "));
    }

    const normalizedGroup = groupResult.value[0];
    const groups = settings.groups.some((item) => item.id === normalizedGroup.id)
      ? settings.groups.map((item) =>
        item.id === normalizedGroup.id ? normalizedGroup : item
      )
      : [...settings.groups, normalizedGroup];

    await this.dependencies.settingsService.updateGroups(groups);
    await this.postSnapshot();
    await this.postNotice(`Saved group "${normalizedGroup.name}".`);
  }

  private async removeGroup(groupId: string): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const group = settings.groups.find((item) => item.id === groupId);

    if (!group) {
      throw new Error("The selected group no longer exists.");
    }

    const dependentWorkspaces = settings.workspaces.filter(
      (workspace) => workspace.groupId === groupId
    );

    if (dependentWorkspaces.length > 0) {
      throw new Error(
        `Cannot remove group "${group.name}" while it contains ${dependentWorkspaces.length} workspace target(s).`
      );
    }

    await this.dependencies.settingsService.updateGroups(
      settings.groups.filter((item) => item.id !== groupId)
    );
    await this.postSnapshot();
    await this.postNotice(`Removed group "${group.name}".`);
  }

  private async saveWorkspace(workspace: WorkspaceTarget): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const targetResult = validateWorkspaceTarget(workspace);

    if (!targetResult.value) {
      throw new Error(targetResult.errors.join(" "));
    }

    const normalizedTarget = targetResult.value;
    const candidateWorkspaces = [
      ...settings.workspaces.filter((item) => item.id !== normalizedTarget.id),
      normalizedTarget
    ];
    const workspaceResult = validateWorkspaces(
      candidateWorkspaces,
      settings.groups
    );

    if (!workspaceResult.value) {
      throw new Error(workspaceResult.errors.join(" "));
    }

    await this.dependencies.settingsService.updateWorkspaces(
      workspaceResult.value
    );
    await this.postSnapshot();
    await this.postNotice(`Saved workspace "${normalizedTarget.name}".`);
  }

  private async reorderGroups(groupIds: string[]): Promise<void> {
    const settings = this.dependencies.settingsService.read();

    if (!hasExactIds(settings.groups, groupIds)) {
      throw new Error("The requested group order does not match the current groups.");
    }

    const orderById = new Map(groupIds.map((id, index) => [id, (index + 1) * 10]));
    await this.dependencies.settingsService.updateGroups(
      settings.groups.map((group) => ({
        ...group,
        order: orderById.get(group.id) ?? group.order
      }))
    );
    await this.postSnapshot();
  }

  private async reorderWorkspaces(
    groupId: string,
    workspaceIds: string[]
  ): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const groupWorkspaces = settings.workspaces.filter(
      (workspace) => workspace.groupId === groupId
    );

    if (!hasExactIds(groupWorkspaces, workspaceIds)) {
      throw new Error("The requested workspace order does not match the current group.");
    }

    const orderById = new Map(
      workspaceIds.map((id, index) => [id, (index + 1) * 10])
    );
    await this.dependencies.settingsService.updateWorkspaces(
      settings.workspaces.map((workspace) =>
        workspace.groupId === groupId
          ? {
            ...workspace,
            order: orderById.get(workspace.id) ?? workspace.order
          }
          : workspace
      )
    );
    await this.postSnapshot();
  }

  private async moveWorkspace(
    workspaceId: string,
    sourceGroupId: string,
    targetGroupId: string,
    targetWorkspaceIds: string[]
  ): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const workspace = settings.workspaces.find((item) => item.id === workspaceId);

    if (!workspace || workspace.groupId !== sourceGroupId) {
      throw new Error("The workspace no longer belongs to its source group.");
    }

    if (!settings.groups.some((group) => group.id === targetGroupId)) {
      throw new Error("The target group no longer exists.");
    }

    const targetWorkspaces = settings.workspaces.filter(
      (item) => item.groupId === targetGroupId && item.id !== workspaceId
    );

    if (!hasExactIds([...targetWorkspaces, workspace], targetWorkspaceIds)) {
      throw new Error("The requested target workspace order is invalid.");
    }

    const targetOrderById = new Map(
      targetWorkspaceIds.map((id, index) => [id, (index + 1) * 10])
    );

    await this.dependencies.settingsService.updateWorkspaces(
      settings.workspaces.map((item) => {
        if (item.id === workspaceId) {
          return {
            ...item,
            groupId: targetGroupId,
            order: targetOrderById.get(item.id) ?? item.order
          };
        }

        if (item.groupId === targetGroupId) {
          return {
            ...item,
            order: targetOrderById.get(item.id) ?? item.order
          };
        }

        return item;
      })
    );
    await this.postSnapshot();
  }

  private async runQuickAction(command: QuickActionCommand): Promise<void> {
    const commandId = quickActionCommandIds[command];
    await vscode.commands.executeCommand(commandId);
  }

  private async postSnapshot(): Promise<void> {
    const settings = this.dependencies.settingsService.read();
    const sshHosts = settings.importSshHosts
      ? await this.dependencies.sshConfigService.listHosts()
      : [];

    const snapshot: DashboardSnapshot = {
      settings,
      recentTargets: await this.dependencies.recentTargetsService.list(),
      sshHosts,
      configurationErrors: []
    };

    await this.postMessage({ type: "snapshot", snapshot });
  }

  private async postError(message: string): Promise<void> {
    await this.postMessage({ type: "error", message });
  }

  private async postNotice(message: string): Promise<void> {
    await this.postMessage({ type: "notice", message });
  }

  private async postMessage(message: ExtensionMessage): Promise<void> {
    await this.panel.webview.postMessage(message);
  }

  private createWebviewHtml(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.dependencies.extensionUri, "dist", "webview", "main.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.dependencies.extensionUri, "dist", "webview", "main.js")
    );
    const nonce = createNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Wayfinder</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    if (HubPanel.currentPanel === this) {
      HubPanel.currentPanel = undefined;
    }

    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }

    this.panel.dispose();
  }
}

const quickActionCommandIds: Record<QuickActionCommand, string> = {
  newFile: "workbench.action.files.newUntitledFile",
  openFolder: "workbench.action.files.openFolder",
  cloneRepository: "git.clone",
  extensions: "workbench.view.extensions"
};

function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "ready":
    case "refresh":
      return true;
    case "openWorkspace":
      return (
        typeof value.workspaceId === "string" &&
        (value.forceNewWindow === undefined ||
          typeof value.forceNewWindow === "boolean")
      );
    case "openRecent":
      return (
        typeof value.fingerprint === "string" &&
        (value.forceNewWindow === undefined ||
          typeof value.forceNewWindow === "boolean")
      );
    case "removeRecent":
      return typeof value.fingerprint === "string";
    case "removeWorkspace":
      return typeof value.workspaceId === "string";
    case "saveGroup":
      return isWayfinderGroup(value.group);
    case "removeGroup":
      return typeof value.groupId === "string";
    case "saveWorkspace":
      return isRecord(value.workspace);
    case "reorderGroups":
      return isStringArray(value.groupIds);
    case "reorderWorkspaces":
      return typeof value.groupId === "string" && isStringArray(value.workspaceIds);
    case "moveWorkspace":
      return (
        typeof value.workspaceId === "string" &&
        typeof value.sourceGroupId === "string" &&
        typeof value.targetGroupId === "string" &&
        isStringArray(value.targetWorkspaceIds)
      );
    case "runCommand":
      return (
        typeof value.command === "string" &&
        value.command in quickActionCommandIds
      );
    default:
      return false;
  }
}

function toWorkspaceTarget(recentTarget: RecentTarget): WorkspaceTarget {
  if (recentTarget.kind === "ssh") {
    if (!recentTarget.host) {
      throw new Error("The SSH recent target is missing its host alias.");
    }

    return {
      id: recentTarget.workspaceId ?? recentTarget.fingerprint,
      groupId: "recent",
      name: recentTarget.name,
      order: 0,
      kind: "ssh",
      host: recentTarget.host,
      path: recentTarget.path
    };
  }

  return {
    id: recentTarget.workspaceId ?? recentTarget.fingerprint,
    groupId: "recent",
    name: recentTarget.name,
    order: 0,
    kind: recentTarget.kind,
    path: recentTarget.path
  };
}

function hasExactIds(
  items: ReadonlyArray<{ id: string }>,
  ids: string[]
): boolean {
  if (items.length !== ids.length || new Set(ids).size !== ids.length) {
    return false;
  }

  const knownIds = new Set(items.map((item) => item.id));
  return ids.every((id) => knownIds.has(id));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isWayfinderGroup(value: unknown): value is WayfinderGroup {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.order === "number"
  );
}
