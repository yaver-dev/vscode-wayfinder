import {
  WORKSPACE_COLORS,
  WORKSPACE_KINDS,
  type WorkspaceTarget
} from "../types";
import { isRecord } from "../utils/types";
import { isAbsoluteLocalPath } from "../utils/Paths";

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ValidationResult<T> {
  value?: T;
  errors: string[];
}

export function validateWorkspaceTarget(
  value: unknown
): ValidationResult<WorkspaceTarget> {
  if (!isRecord(value)) {
    return { errors: ["Workspace target must be an object."] };
  }

  const errors: string[] = [];
  const id = readRequiredString(value, "id", errors);
  const groupId = readRequiredString(value, "groupId", errors);
  const name = readRequiredString(value, "name", errors);
  const order = readOptionalOrder(value, errors);
  const kind = readWorkspaceKind(value, errors);
  const path = readRequiredString(value, "path", errors);
  const color = readOptionalColor(value, errors);
  const badge = readOptionalBadge(value, errors);

  if (id && !ID_PATTERN.test(id)) {
    errors.push("Workspace target id must be lowercase kebab-case.");
  }

  if (groupId && !ID_PATTERN.test(groupId)) {
    errors.push("Workspace target groupId must be lowercase kebab-case.");
  }

  if (kind === "local" && path && !isAbsoluteLocalPath(path)) {
    errors.push("Local workspace path must be absolute.");
  }

  if (kind === "workspaceFile") {
    if (path && !isAbsoluteLocalPath(path)) {
      errors.push("Workspace file path must be absolute.");
    }

    if (path && !path.endsWith(".code-workspace")) {
      errors.push("Workspace file path must end with .code-workspace.");
    }
  }

  const host = value.host;
  const sshHost = typeof host === "string" ? host.trim() : undefined;

  if (kind === "ssh") {
    if (!sshHost) {
      errors.push("SSH workspace target requires a host.");
    }

    if (path && !path.startsWith("/")) {
      errors.push("SSH workspace path must be an absolute POSIX path.");
    }
  } else if (host !== undefined) {
    errors.push("Only SSH workspace targets can define a host.");
  }

  if (errors.length > 0 || !id || !groupId || !name || !kind || !path) {
    return { errors };
  }

  if (kind === "ssh" && sshHost) {
    return {
      errors: [],
      value: {
        id,
        groupId,
        name,
        order,
        kind: "ssh",
        host: sshHost,
        path,
        ...(color ? { color } : {}),
        ...(badge ? { badge } : {})
      }
    };
  }

  if (kind === "local") {
    return {
      errors: [],
      value: {
        id,
        groupId,
        name,
        order,
        kind: "local",
        path,
        ...(color ? { color } : {}),
        ...(badge ? { badge } : {})
      }
    };
  }

  if (kind === "workspaceFile") {
    return {
      errors: [],
      value: {
        id,
        groupId,
        name,
        order,
        kind: "workspaceFile",
        path,
        ...(color ? { color } : {}),
        ...(badge ? { badge } : {})
      }
    };
  }

  return { errors: ["Workspace target kind is invalid."] };
}

function readRequiredString(
  value: Record<string, unknown>,
  propertyName: string,
  errors: string[]
): string | undefined {
  const propertyValue = value[propertyName];

  if (typeof propertyValue !== "string" || propertyValue.trim().length === 0) {
    errors.push(`Workspace target ${propertyName} must be a non-empty string.`);
    return undefined;
  }

  return propertyValue.trim();
}

function readOptionalOrder(
  value: Record<string, unknown>,
  errors: string[]
): number {
  const propertyValue = value.order;

  if (propertyValue === undefined) {
    return 0;
  }

  if (
    typeof propertyValue !== "number" ||
    !Number.isInteger(propertyValue) ||
    propertyValue < 0
  ) {
    errors.push("Workspace target order must be a non-negative integer.");
    return 0;
  }

  return propertyValue;
}

function readWorkspaceKind(
  value: Record<string, unknown>,
  errors: string[]
): WorkspaceTarget["kind"] | undefined {
  const propertyValue = value.kind;

  if (
    typeof propertyValue !== "string" ||
    !WORKSPACE_KINDS.includes(propertyValue as WorkspaceTarget["kind"])
  ) {
    errors.push("Workspace target kind is invalid.");
    return undefined;
  }

  return propertyValue as WorkspaceTarget["kind"];
}

function readOptionalColor(
  value: Record<string, unknown>,
  errors: string[]
): Exclude<WorkspaceTarget["color"], undefined> | undefined {
  const propertyValue = value.color;

  if (propertyValue === undefined) {
    return undefined;
  }

  if (
    typeof propertyValue !== "string" ||
    !WORKSPACE_COLORS.includes(
      propertyValue as Exclude<WorkspaceTarget["color"], undefined>
    )
  ) {
    errors.push("Workspace target color is invalid.");
    return undefined;
  }

  return propertyValue as Exclude<WorkspaceTarget["color"], undefined>;
}

function readOptionalBadge(
  value: Record<string, unknown>,
  errors: string[]
): string | undefined {
  const propertyValue = value.badge;

  if (propertyValue === undefined) {
    return undefined;
  }

  if (typeof propertyValue !== "string") {
    errors.push("Workspace target badge must be a string.");
    return undefined;
  }

  const badge = propertyValue.trim();
  if (badge.length === 0) {
    return undefined;
  }

  if (badge.length > 3) {
    errors.push("Workspace target badge must be at most 3 characters.");
    return undefined;
  }

  return badge;
}

