import type { DashboardSnapshot } from "../protocol";

export function createSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createWorkspaceId(
  currentId: string,
  groupId: string,
  name: string,
  snapshot: DashboardSnapshot
): string {
  if (currentId) {
    return currentId;
  }

  const nameSlug = createSlug(name);
  const baseId = createSlug(`${groupId}-${nameSlug}`);
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
