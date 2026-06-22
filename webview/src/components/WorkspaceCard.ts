import type {
  WorkspaceTarget,
  WebviewMessage
} from "../protocol";
import {
  createIconButton,
  createDragHandle
} from "../lib/dom";
import { createWorkspaceVisualBadge } from "../lib/badge";
import type { DragController } from "../controllers/DragController";

export interface WorkspaceCardCallbacks {
  onOpen(workspaceId: string, forceNewWindow: boolean): void;
  onEdit(workspace: WorkspaceTarget): void;
  onRemove(workspaceId: string): void;
}

export function createWorkspaceCard(
  workspace: WorkspaceTarget,
  dragController: DragController,
  callbacks: WorkspaceCardCallbacks
): HTMLElement {
  const card = document.createElement("article");
  card.className = "workspace-card";
  card.dataset.color = workspace.color ?? "gray";
  card.dataset.workspaceId = workspace.id;
  card.draggable = true;
  dragController.configureWorkspaceDragAndDrop(card);

  const badge = createWorkspaceVisualBadge(workspace);
  const dragHandle = createDragHandle("Reorder workspace");

  const title = document.createElement("h3");
  title.textContent = workspace.name;

  const metadata = createWorkspaceMetadata(workspace);

  const detail = document.createElement("p");
  detail.className = "target-detail";
  detail.textContent = workspace.kind === "ssh"
    ? `${workspace.host}:${workspace.path}`
    : workspace.path;

  const actions = document.createElement("div");
  actions.className = "workspace-actions";

  actions.append(
    createIconButton("folderOpen", "Open here", () => {
      callbacks.onOpen(workspace.id, false);
    }),
    createIconButton("openExternal", "Open in new window", () => {
      callbacks.onOpen(workspace.id, true);
    }),
    createIconButton("edit", "Edit workspace", () => {
      callbacks.onEdit(workspace);
    }),
    createIconButton("trash", "Remove workspace", () => {
      callbacks.onRemove(workspace.id);
    }, "destructive-icon-button")
  );

  card.append(badge, dragHandle, title, metadata, detail, actions);
  return card;
}

function createWorkspaceMetadata(workspace: WorkspaceTarget): HTMLElement {
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
