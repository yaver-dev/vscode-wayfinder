
import type {
  WayfinderGroup,
  WayfinderSettings,
  WorkspaceTarget
} from "../types";
import {
  validateWorkspaceTarget,
  type ValidationResult
} from "./WorkspaceTargetValidation";
import { isRecord } from "../utils/types";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SettingsValidationResult {
  value: WayfinderSettings;
  errors: string[];
}

export function validateGroups(value: unknown): ValidationResult<WayfinderGroup[]> {
  if (!Array.isArray(value)) {
    return { errors: ["Wayfinder groups must be an array."] };
  }

  const errors: string[] = [];
  const groups: WayfinderGroup[] = [];
  const ids = new Set<string>();

  value.forEach((item, index) => {
    const result = validateGroup(item);

    if (!result.value) {
      errors.push(...result.errors.map((error) => `groups[${index}]: ${error}`));
      return;
    }

    if (ids.has(result.value.id)) {
      errors.push(`groups[${index}]: Group id \"${result.value.id}\" is duplicated.`);
      return;
    }

    ids.add(result.value.id);
    groups.push(result.value);
  });

  return errors.length > 0 ? { errors } : { value: groups, errors: [] };
}

export function validateWorkspaces(
  value: unknown,
  groups: readonly WayfinderGroup[]
): ValidationResult<WorkspaceTarget[]> {
  if (!Array.isArray(value)) {
    return { errors: ["Wayfinder workspaces must be an array."] };
  }

  const errors: string[] = [];
  const workspaces: WorkspaceTarget[] = [];
  const workspaceIds = new Set<string>();
  const groupIds = new Set(groups.map((group) => group.id));

  value.forEach((item, index) => {
    const result = validateWorkspaceTarget(item);

    if (!result.value) {
      errors.push(...result.errors.map((error) => `workspaces[${index}]: ${error}`));
      return;
    }

    if (workspaceIds.has(result.value.id)) {
      errors.push(
        `workspaces[${index}]: Workspace id \"${result.value.id}\" is duplicated.`
      );
      return;
    }

    if (!groupIds.has(result.value.groupId)) {
      errors.push(
        `workspaces[${index}]: Unknown groupId \"${result.value.groupId}\".`
      );
      return;
    }

    workspaceIds.add(result.value.id);
    workspaces.push(result.value);
  });

  return errors.length > 0 ? { errors } : { value: workspaces, errors: [] };
}

export function validateWayfinderSettings(input: {
  groups: unknown;
  workspaces: unknown;
  openOnEmptyWindow: unknown;
  importSshHosts: unknown;
}): SettingsValidationResult {
  const groupsResult = validateGroups(input.groups);
  const groups = groupsResult.value ?? [];
  const workspacesResult = validateWorkspaces(input.workspaces, groups);
  const errors = [...groupsResult.errors, ...workspacesResult.errors];

  const openOnEmptyWindow = readBoolean(
    input.openOnEmptyWindow,
    "openOnEmptyWindow",
    errors
  );
  const importSshHosts = readBoolean(
    input.importSshHosts,
    "importSshHosts",
    errors
  );

  return {
    value: {
      groups,
      workspaces: workspacesResult.value ?? [],
      openOnEmptyWindow: openOnEmptyWindow ?? false,
      importSshHosts: importSshHosts ?? true
    },
    errors
  };
}

function validateGroup(value: unknown): ValidationResult<WayfinderGroup> {
  if (!isRecord(value)) {
    return { errors: ["Group must be an object."] };
  }

  const errors: string[] = [];
  const id = readRequiredString(value, "id", errors);
  const name = readRequiredString(value, "name", errors);
  const order = value.order;

  if (id && !ID_PATTERN.test(id)) {
    errors.push("Group id must be lowercase kebab-case.");
  }

  if (typeof order !== "number" || !Number.isFinite(order)) {
    errors.push("Group order must be a finite number.");
  }

  if (errors.length > 0 || !id || !name || typeof order !== "number") {
    return { errors };
  }

  return {
    value: {
      id,
      name,
      order
    },
    errors: []
  };
}

function readRequiredString(
  value: Record<string, unknown>,
  propertyName: string,
  errors: string[]
): string | undefined {
  const propertyValue = value[propertyName];

  if (typeof propertyValue !== "string" || propertyValue.trim().length === 0) {
    errors.push(`${propertyName} must be a non-empty string.`);
    return undefined;
  }

  return propertyValue.trim();
}

function readBoolean(
  value: unknown,
  propertyName: string,
  errors: string[]
): boolean | undefined {
  if (typeof value !== "boolean") {
    errors.push(`${propertyName} must be a boolean.`);
    return undefined;
  }

  return value;
}

