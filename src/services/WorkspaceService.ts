
import * as vscode from "vscode";
import type {
  LocalWorkspaceTarget,
  WorkspaceFileTarget,
  WorkspaceTarget
} from "../types";
import { createLocalWorkspaceUri, createWorkspaceFileUri } from "../utils/UriFactory";
import { RemoteWorkspaceOpener } from "./RemoteWorkspaceOpener";

export class WorkspaceService {
  public constructor(
    private readonly remoteWorkspaceOpener: RemoteWorkspaceOpener
  ) { }

  public async open(
    target: WorkspaceTarget,
    forceNewWindow = false
  ): Promise<void> {
    switch (target.kind) {
      case "local":
        await this.openLocal(target, forceNewWindow);
        return;
      case "workspaceFile":
        await this.openWorkspaceFile(target, forceNewWindow);
        return;
      case "ssh":
        await this.remoteWorkspaceOpener.open(target, forceNewWindow);
        return;
    }
  }

  private async openLocal(
    target: LocalWorkspaceTarget,
    forceNewWindow: boolean
  ): Promise<void> {
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      createLocalWorkspaceUri(target, vscode.Uri),
      forceNewWindow
    );
  }

  private async openWorkspaceFile(
    target: WorkspaceFileTarget,
    forceNewWindow: boolean
  ): Promise<void> {
    await vscode.commands.executeCommand(
      "vscode.openFolder",
      createWorkspaceFileUri(target, vscode.Uri),
      forceNewWindow
    );
  }
}