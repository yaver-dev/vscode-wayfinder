import type {
  DashboardSnapshot,
  WebviewMessage,
  WorkspaceColor,
  WorkspaceTarget
} from "../protocol";
import { WORKSPACE_COLORS } from "../../../shared/types";
import {
  createTextField,
  createSelectField,
  createEditorActions
} from "../lib/dom";
import { createSlug, createWorkspaceId } from "../lib/slug";
import { buildWorkspaceTarget } from "../lib/workspaceBuilder";

export interface WorkspaceEditorCallbacks {
  onSave(workspace: WorkspaceTarget): void;
  onCancel(): void;
  postMessage(message: WebviewMessage): void;
}

export function createWorkspaceEditor(
  workspace: WorkspaceTarget,
  snapshot: DashboardSnapshot,
  callbacks: WorkspaceEditorCallbacks
): HTMLElement {
  const editor = document.createElement("section");
  editor.className = "editor-card";

  const isExisting = snapshot.settings.workspaces.some((item) => item.id === workspace.id);
  const title = document.createElement("h2");
  title.textContent = isExisting ? "Edit workspace" : "Add workspace";

  const form = document.createElement("form");
  form.className = "editor-form";

  const nameInput = createTextField("Name", workspace.name, "Visible name");
  nameInput.input.required = true;

  const groupInput = createSelectField("Group", snapshot.settings.groups.map((g) => ({
    label: g.name,
    value: g.id
  })), workspace.groupId);
  groupInput.input.required = true;

  const kindInput = createSelectField("Kind", [
    { label: "Local folder", value: "local" },
    { label: "Remote SSH", value: "ssh" },
    { label: ".code-workspace file", value: "workspaceFile" }
  ], workspace.kind);

  const hostInput = createTextField(
    "SSH host",
    workspace.kind === "ssh" ? workspace.host ?? "" : "",
    "SSH alias"
  );
  hostInput.input.required = workspace.kind === "ssh";

  const pathInput = createTextField("Path", workspace.path, "/absolute/path");
  pathInput.input.required = true;

  const colorInput = createSelectField("Color", [
    { label: "Default", value: "" },
    ...WORKSPACE_COLORS.map((color) => ({ label: color, value: color }))
  ], workspace.color ?? "");

  const badgeInput = createTextField("Badge text", workspace.badge ?? "", "Up to 3 characters");
  badgeInput.input.maxLength = 3;

  const updateKindFields = (): void => {
    const isSsh = kindInput.input.value === "ssh";
    hostInput.field.hidden = !isSsh;
    hostInput.input.required = isSsh;
    pathInput.input.placeholder = kindInput.input.value === "workspaceFile"
      ? "/absolute/project.code-workspace"
      : isSsh
        ? "/absolute/remote/path"
        : "/absolute/local/path";
  };
  kindInput.input.addEventListener("change", updateKindFields);
  updateKindFields();

  const actions = createEditorActions(() => {
    const kind = kindInput.input.value as WorkspaceTarget["kind"];
    const name = nameInput.input.value.trim();
    const groupId = groupInput.input.value;
    const target = buildWorkspaceTarget(kind, {
      id: createWorkspaceId(workspace.id, groupId, name, snapshot),
      groupId,
      name,
      order: workspace.order,
      path: pathInput.input.value.trim(),
      ...(colorInput.input.value ? { color: colorInput.input.value as WorkspaceColor } : {}),
      ...(badgeInput.input.value.trim() ? { badge: badgeInput.input.value.trim().slice(0, 3) } : {})
    }, hostInput.input.value.trim());

    callbacks.postMessage({ type: "saveWorkspace", workspace: target });
    callbacks.onSave(target);
  }, () => callbacks.onCancel());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.save.click();
  });

  form.append(
    nameInput.field,
    groupInput.field,
    kindInput.field,
    hostInput.field,
    pathInput.field,
    colorInput.field,
    badgeInput.field,
    actions.container
  );
  editor.append(title, form);
  return editor;
}

