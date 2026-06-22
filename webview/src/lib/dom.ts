import type { IconName } from "./Icons";
import { createIcon } from "./Icons";

export function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

export function createIconButton(
  icon: IconName,
  label: string,
  onClick: () => void,
  additionalClassName?: string
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("icon-button");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.append(createIcon(icon));
  button.addEventListener("click", onClick);

  if (additionalClassName) {
    button.classList.add(...additionalClassName.split(/\s+/).filter(Boolean));
  }

  return button;
}

export function createTextField(label: string, value: string, placeholder: string): {
  field: HTMLElement;
  input: HTMLInputElement;
} {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;

  return {
    field: createLabeledField(label, input),
    input
  };
}

export function createSelectField(
  label: string,
  options: ReadonlyArray<{ label: string; value: string }>,
  value: string
): {
  field: HTMLElement;
  input: HTMLSelectElement;
} {
  const input = document.createElement("select");

  for (const optionDefinition of options) {
    const option = document.createElement("option");
    option.value = optionDefinition.value;
    option.textContent = optionDefinition.label;
    option.selected = optionDefinition.value === value;
    input.append(option);
  }

  return {
    field: createLabeledField(label, input),
    input
  };
}

function createLabeledField(label: string, input: HTMLElement): HTMLElement {
  const field = document.createElement("label");
  field.className = "form-field";

  const title = document.createElement("span");
  title.textContent = label;

  field.append(title, input);
  return field;
}

export function createEmptyState(message: string): HTMLElement {
  const emptyState = document.createElement("p");
  emptyState.className = "empty-state";
  emptyState.textContent = message;
  return emptyState;
}

export function createDragHandle(label: string): HTMLElement {
  const handle = document.createElement("span");
  handle.className = "drag-handle";
  handle.textContent = "⠿";
  handle.title = label;
  handle.setAttribute("aria-label", label);
  handle.setAttribute("role", "img");
  return handle;
}

export function createEditorActions(
  onSave: () => void,
  onCancel: () => void
): { container: HTMLElement; save: HTMLButtonElement } {
  const container = document.createElement("div");
  container.className = "editor-actions";

  const save = createButton("Save", () => {
    const form = save.closest("form");
    if (form && !form.reportValidity()) return;
    onSave();
  });
  save.type = "button";

  const cancel = createButton("Cancel", onCancel);
  cancel.classList.add("secondary-button");

  container.append(save, cancel);
  return { container, save };
}
