import type { DashboardSnapshot } from "../protocol";
import { createIconButton } from "../lib/dom";

export interface RemoteHostItemCallbacks {
  onAddSshWorkspace(hostAlias: string, snapshot: DashboardSnapshot): void;
}

export function createRemoteHostItem(
  host: { alias: string; sourceFile: string },
  snapshot: DashboardSnapshot,
  callbacks: RemoteHostItemCallbacks
): HTMLElement {
  const item = document.createElement("article");
  item.className = "remote-host-item";

  const name = document.createElement("span");
  name.className = "remote-host-name";
  name.textContent = host.alias;
  name.title = host.alias;

  const actions = document.createElement("div");
  actions.className = "remote-host-actions";
  actions.append(
    createIconButton("add", `Add SSH workspace for ${host.alias}`, () => {
      callbacks.onAddSshWorkspace(host.alias, snapshot);
    }, "remote-host-action")
  );

  item.append(name, actions);
  return item;
}
