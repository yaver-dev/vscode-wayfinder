import type {
  DashboardSnapshot,
  ExtensionMessage,
  WebviewMessage
} from "../../shared/protocol";

import type {
  WayfinderGroup,
  WorkspaceTarget,
  RecentTarget,
  SshHost,
  WorkspaceKind,
  WorkspaceColor
} from "../../shared/types";

export type {
  DashboardSnapshot,
  ExtensionMessage,
  WebviewMessage,
  WayfinderGroup,
  WorkspaceTarget,
  RecentTarget,
  SshHost,
  WorkspaceKind,
  WorkspaceColor
};

export interface WebviewApi {
  postMessage(message: WebviewMessage): void;
  getState(): WebviewState | undefined;
  setState(state: WebviewState): void;
}

export interface WebviewState {
  snapshot?: DashboardSnapshot;
}
