export const WORKSPACE_KINDS = [
  "local",
  "ssh",
  "workspaceFile"
] as const;

export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_COLORS = [
  "purple",
  "blue",
  "green",
  "orange",
  "pink",
  "gray"
] as const;

export type WorkspaceColor = (typeof WORKSPACE_COLORS)[number];

export interface WayfinderGroup {
  id: string;
  name: string;
  order: number;
}

interface WorkspaceTargetBase {
  id: string;
  groupId: string;
  name: string;
  order: number;
  kind: WorkspaceKind;
  path: string;
  color?: WorkspaceColor;
}

export interface LocalWorkspaceTarget extends WorkspaceTargetBase {
  kind: "local";
}

export interface SshWorkspaceTarget extends WorkspaceTargetBase {
  kind: "ssh";
  host: string;
}

export interface WorkspaceFileTarget extends WorkspaceTargetBase {
  kind: "workspaceFile";
}

export type WorkspaceTarget =
  | LocalWorkspaceTarget
  | SshWorkspaceTarget
  | WorkspaceFileTarget;

export interface RecentTarget {
  fingerprint: string;
  workspaceId?: string;
  kind: WorkspaceKind;
  name: string;
  path: string;
  host?: string;
  openedAt: string;
}

export interface WayfinderSettings {
  groups: WayfinderGroup[];
  workspaces: WorkspaceTarget[];
  openOnEmptyWindow: boolean;
  importSshHosts: boolean;
}

export interface SshHost {
  alias: string;
  sourceFile: string;
}