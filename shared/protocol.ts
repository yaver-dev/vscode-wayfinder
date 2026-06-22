import type {
  RecentTarget,
  SshHost,
  WayfinderGroup,
  WayfinderSettings,
  WorkspaceTarget
} from "./types";

export interface DashboardSnapshot {
  settings: WayfinderSettings;
  recentTargets: RecentTarget[];
  sshHosts: SshHost[];
  configurationErrors: string[];
}

export type WebviewMessage =
  | { type: "ready" }
  | { type: "refresh" }
  | {
    type: "openWorkspace";
    workspaceId: string;
    forceNewWindow?: boolean;
  }
  | {
    type: "openRecent";
    fingerprint: string;
    forceNewWindow?: boolean;
  }
  | {
    type: "removeRecent";
    fingerprint: string;
  }
  | {
    type: "removeWorkspace";
    workspaceId: string;
  }
  | {
    type: "saveGroup";
    group: WayfinderGroup;
  }
  | {
    type: "removeGroup";
    groupId: string;
  }
  | {
    type: "saveWorkspace";
    workspace: WorkspaceTarget;
  }
  | {
    type: "reorderGroups";
    groupIds: string[];
  }
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
    command: QuickActionCommand;
  };

export type ExtensionMessage =
  | {
    type: "snapshot";
    snapshot: DashboardSnapshot;
  }
  | {
    type: "error";
    message: string;
  }
  | {
    type: "notice";
    message: string;
  };

export type QuickActionCommand =
  | "newFile"
  | "openFolder"
  | "cloneRepository"
  | "extensions";
