import type {
  DashboardSnapshot,
  RecentTarget,
  WorkspaceTarget
} from "../protocol";
import { createIconButton } from "../lib/dom";
import { createRecentVisualBadge } from "../lib/badge";

export interface RecentItemCallbacks {
  onOpenRecent(fingerprint: string): void;
  onRemoveRecent(fingerprint: string): void;
  onPinRecent(target: RecentTarget): void;
}

export function createRecentItem(
  target: RecentTarget,
  snapshot: DashboardSnapshot,
  callbacks: RecentItemCallbacks
): HTMLElement {
  const item = document.createElement("article");
  item.className = "recent-item";
  const matchingWorkspace = findPinnedWorkspace(target, snapshot);
  const visualBadge = createRecentVisualBadge(target.name, matchingWorkspace);

  const content = document.createElement("div");
  content.className = "recent-item-content";

  const name = document.createElement("strong");
  name.className = "recent-item-name";
  name.textContent = target.name;
  name.title = target.path;

  const detail = document.createElement("span");
  detail.className = "target-detail";
  detail.textContent = target.kind === "ssh" ? `${target.host}:${target.path}` : target.path;

  content.append(name, detail);

  const actions = document.createElement("div");
  actions.className = "recent-item-actions";
  actions.append(
    createIconButton("folderOpen", "Open recent target", () => {
      callbacks.onOpenRecent(target.fingerprint);
    }, "recent-action-button"),
    createIconButton("pin", "Pin as workspace", () => {
      callbacks.onPinRecent(target);
    }, "recent-action-button"),
    createIconButton("trash", "Remove recent target", () => {
      callbacks.onRemoveRecent(target.fingerprint);
    }, "destructive-icon-button recent-action-button")
  );

  item.append(visualBadge, content, actions);
  return item;
}

function findPinnedWorkspace(
  target: RecentTarget,
  snapshot: DashboardSnapshot
): WorkspaceTarget | undefined {
  return snapshot.settings.workspaces.find((workspace) =>
    workspace.kind === target.kind &&
    workspace.path === target.path &&
    (workspace.kind !== "ssh" || workspace.host === target.host)
  );
}
