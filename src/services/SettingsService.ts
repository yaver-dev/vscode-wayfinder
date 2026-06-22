
import * as vscode from "vscode";
import type {
  WayfinderGroup,
  WayfinderSettings,
  WorkspaceTarget
} from "../types";
import { validateWayfinderSettings } from "../validation/ConfigValidation";

export class SettingsService {
  private writeQueue: Promise<void> = Promise.resolve();
  private lastErrors: string[] = [];

  public read(): WayfinderSettings {
    const configuration = vscode.workspace.getConfiguration("wayfinder");
    const result = validateWayfinderSettings({
      groups: configuration.get<unknown[]>("groups", []),
      workspaces: configuration.get<unknown[]>("workspaces", []),
      openOnEmptyWindow: configuration.get<unknown>("openOnEmptyWindow", false),
      importSshHosts: configuration.get<unknown>("importSshHosts", true)
    });

    this.lastErrors = result.errors;

    if (result.errors.length > 0) {
      console.warn(
        "Wayfinder ignored invalid configuration values:",
        result.errors
      );
    }

    return result.value;
  }

  public getLastErrors(): string[] {
    return this.lastErrors;
  }

  public updateGroups(groups: readonly WayfinderGroup[]): Promise<void> {
    return this.enqueueUpdate("groups", [...groups]);
  }

  public updateWorkspaces(
    workspaces: readonly WorkspaceTarget[]
  ): Promise<void> {
    return this.enqueueUpdate("workspaces", [...workspaces]);
  }

  public updateOpenOnEmptyWindow(value: boolean): Promise<void> {
    return this.enqueueUpdate("openOnEmptyWindow", value);
  }

  public updateImportSshHosts(value: boolean): Promise<void> {
    return this.enqueueUpdate("importSshHosts", value);
  }

  private enqueueUpdate<T>(settingName: string, value: T): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await vscode.workspace
        .getConfiguration("wayfinder")
        .update(settingName, value, vscode.ConfigurationTarget.Global);
    });

    return this.writeQueue;
  }
}