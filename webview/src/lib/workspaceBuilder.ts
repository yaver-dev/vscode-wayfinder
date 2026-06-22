import type { DashboardSnapshot, WorkspaceTarget } from "../protocol";

export function buildWorkspaceTarget(
  kind: WorkspaceTarget["kind"],
  common: {
    id: string;
    groupId: string;
    name: string;
    order: number;
    path: string;
    color?: string;
    badge?: string;
  },
  host?: string
): WorkspaceTarget {
  const base = {
    ...common,
    ...(common.color ? { color: common.color } : {}),
    ...(common.badge ? { badge: common.badge } : {})
  };

  switch (kind) {
    case "ssh":
      return { ...base, kind: "ssh", host: host ?? "" } as WorkspaceTarget;
    case "workspaceFile":
      return { ...base, kind: "workspaceFile" } as WorkspaceTarget;
    default:
      return { ...base, kind: "local" } as WorkspaceTarget;
  }
}

export function createNewGroup(
  groups: DashboardSnapshot["settings"]["groups"]
): { id: string; name: string; order: number } {
  const nextOrder = Math.max(0, ...groups.map((group) => group.order)) + 10;
  return { id: "", name: "", order: nextOrder };
}

export function createNewWorkspace(
  groupId: string,
  workspaces: DashboardSnapshot["settings"]["workspaces"]
): WorkspaceTarget {
  const groupOrders = workspaces
    .filter((workspace) => workspace.groupId === groupId)
    .map((workspace) => workspace.order);

  return {
    id: "",
    groupId,
    name: "",
    order: Math.max(0, ...groupOrders) + 10,
    kind: "local",
    path: ""
  } as WorkspaceTarget;
}

export function createSshWorkspaceForHost(
  host: string,
  group: { id: string } | undefined,
  workspaces: DashboardSnapshot["settings"]["workspaces"]
): WorkspaceTarget {
  const workspace = createNewWorkspace(group?.id ?? "", workspaces);
  return buildWorkspaceTarget("ssh", {
    ...workspace,
    id: workspace.id ?? "",
    name: host,
    path: ""
  }, host);
}

export function pinRecentToWorkspace(
  kind: WorkspaceTarget["kind"],
  name: string,
  path: string,
  host: string | undefined,
  groupId: string,
  workspaces: DashboardSnapshot["settings"]["workspaces"]
): WorkspaceTarget {
  const workspace = createNewWorkspace(groupId, workspaces);
  const base = {
    ...workspace,
    id: workspace.id ?? "",
    name,
    path
  };

  if (kind === "ssh" && host) {
    return buildWorkspaceTarget("ssh", base, host);
  }

  return buildWorkspaceTarget(kind, base);
}
