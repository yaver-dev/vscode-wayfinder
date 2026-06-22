import type { QuickActionCommand, WebviewMessage } from "../protocol";
import { isRecord, isStringArray, isWayfinderGroup } from "../utils/types";

export const quickActionCommandIds: Record<QuickActionCommand, string> = {
  newFile: "workbench.action.files.newUntitledFile",
  openFolder: "workbench.action.files.openFolder",
  cloneRepository: "git.clone",
  extensions: "workbench.view.extensions",
  theme: "workbench.colorTheme",
  keymap: "workbench.action.openGlobalKeybindings",
  settings: "workbench.action.openSettings"
};

export function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "ready":
    case "refresh":
      return true;
    case "openWorkspace":
      return (
        typeof value.workspaceId === "string" &&
        (value.forceNewWindow === undefined ||
          typeof value.forceNewWindow === "boolean")
      );
    case "openRecent":
      return (
        typeof value.fingerprint === "string" &&
        (value.forceNewWindow === undefined ||
          typeof value.forceNewWindow === "boolean")
      );
    case "removeRecent":
      return typeof value.fingerprint === "string";
    case "removeWorkspace":
      return typeof value.workspaceId === "string";
    case "saveGroup":
      return isWayfinderGroup(value.group);
    case "removeGroup":
      return typeof value.groupId === "string";
    case "saveWorkspace":
      return isRecord(value.workspace);
    case "reorderGroups":
      return isStringArray(value.groupIds);
    case "reorderWorkspaces":
      return typeof value.groupId === "string" && isStringArray(value.workspaceIds);
    case "moveWorkspace":
      return (
        typeof value.workspaceId === "string" &&
        typeof value.sourceGroupId === "string" &&
        typeof value.targetGroupId === "string" &&
        isStringArray(value.targetWorkspaceIds)
      );
    case "runCommand":
      return (
        typeof value.command === "string" &&
        value.command in quickActionCommandIds
      );
    default:
      return false;
  }
}
