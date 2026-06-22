import type { WorkspaceTarget } from "../protocol";

export function getTargetBadgeText(name: string): string {
  const words = name
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const initials = words.slice(0, 3).map((word) => word[0]).join("");
  const fallback = initials || name.trim().slice(0, 3);
  return fallback.toLocaleUpperCase();
}

export function getWorkspaceBadgeText(workspace: WorkspaceTarget): string {
  const configuredBadge = workspace.badge?.trim();
  if (configuredBadge) {
    return configuredBadge.slice(0, 3).toLocaleUpperCase();
  }
  return getTargetBadgeText(workspace.name);
}

export function createWorkspaceVisualBadge(workspace: WorkspaceTarget): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "workspace-visual-badge";
  badge.dataset.color = workspace.color ?? "gray";
  badge.textContent = getWorkspaceBadgeText(workspace);
  badge.title = workspace.name;
  badge.setAttribute("aria-label", `${workspace.name} badge`);
  return badge;
}

export function createRecentVisualBadge(
  targetName: string,
  workspace: WorkspaceTarget | undefined
): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "recent-visual-badge";
  badge.dataset.color = workspace?.color ?? "gray";
  badge.textContent = workspace
    ? getWorkspaceBadgeText(workspace)
    : getTargetBadgeText(targetName);
  badge.title = targetName;
  badge.setAttribute("aria-label", `${targetName} badge`);
  return badge;
}
