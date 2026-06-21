export interface WebviewApi {
  postMessage(message: WebviewMessage): void;
  getState(): WebviewState | undefined;
  setState(state: WebviewState): void;
}

export interface WayfinderGroup {
  id: string;
  name: string;
  order: number;
}

export type WorkspaceKind = "local" | "ssh" | "workspaceFile";

export interface WorkspaceTarget {
  id: string;
  groupId: string;
  name: string;
  order: number;
  kind: WorkspaceKind;
  path: string;
  host?: string;
  color?: string;
}

export interface RecentTarget {
  fingerprint: string;
  workspaceId?: string;
  kind: WorkspaceKind;
  name: string;
  path: string;
  host?: string;
  openedAt: string;
}

export interface SshHost {
  alias: string;
  sourceFile: string;
}

export interface DashboardSnapshot {
  settings: {
    groups: WayfinderGroup[];
    workspaces: WorkspaceTarget[];
    openOnEmptyWindow: boolean;
    importSshHosts: boolean;
  };
  recentTargets: RecentTarget[];
  sshHosts: SshHost[];
  configurationErrors: string[];
}

export type WebviewMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | { type: "openWorkspace"; workspaceId: string; forceNewWindow?: boolean }
  | { type: "openRecent"; fingerprint: string; forceNewWindow?: boolean }
  | { type: "removeRecent"; fingerprint: string }
  | { type: "removeWorkspace"; workspaceId: string }
  | { type: "saveGroup"; group: WayfinderGroup }
  | { type: "removeGroup"; groupId: string }
  | { type: "saveWorkspace"; workspace: WorkspaceTarget }
  | { type: "reorderGroups"; groupIds: string[] }
  | {
    type: "reorderWorkspaces";
    groupId: string;
    workspaceIds: string[];
  }
  | {
    type: "moveWorkspace";
    workspaceId: string;
    sourceGroupId: string;
    targetGroupId: string;
    targetWorkspaceIds: string[];
  }
  | {
    type: "runCommand";
    command: "newFile" | "openFolder" | "cloneRepository" | "extensions";
  };

export type ExtensionMessage =
  | { type: "snapshot"; snapshot: DashboardSnapshot }
  | { type: "error"; message: string }
  | { type: "notice"; message: string };

export interface WebviewState {
  snapshot?: DashboardSnapshot;
}