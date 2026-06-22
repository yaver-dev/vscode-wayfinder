import type {
  WayfinderGroup,
  WebviewMessage
} from "../protocol";
import {
  createTextField,
  createEditorActions
} from "../lib/dom";
import { createSlug } from "../lib/slug";

export interface GroupEditorCallbacks {
  onSave(group: WayfinderGroup): void;
  onCancel(): void;
  postMessage(message: WebviewMessage): void;
}

export function createGroupEditor(
  group: WayfinderGroup,
  isExisting: boolean,
  callbacks: GroupEditorCallbacks
): HTMLElement {
  const editor = document.createElement("section");
  editor.className = "editor-card";

  const title = document.createElement("h2");
  title.textContent = isExisting ? "Edit group" : "Add group";

  const form = document.createElement("form");
  form.className = "editor-form";

  const nameInput = createTextField("Name", group.name, "e.g. ALBA");
  nameInput.input.required = true;

  const actions = createEditorActions(
    () => {
      const name = nameInput.input.value.trim();
      const id = group.id || createSlug(name);

      if (!id) return;

      callbacks.postMessage({
        type: "saveGroup",
        group: { id, name, order: group.order }
      });
      callbacks.onSave(group);
    },
    () => callbacks.onCancel()
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.save.click();
  });

  form.append(nameInput.field, actions.container);
  editor.append(title, form);
  return editor;
}

