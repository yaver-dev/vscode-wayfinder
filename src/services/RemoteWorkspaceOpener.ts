
import * as vscode from "vscode";
import type { SshWorkspaceTarget } from "../types";
import { createRemoteSshWorkspaceUri } from "../utils/UriFactory";

const REMOTE_SSH_EXTENSION_ID = "ms-vscode-remote.remote-ssh";

export class RemoteWorkspaceOpener {
  public async open(
    target: SshWorkspaceTarget,
    forceNewWindow = false
  ): Promise<void> {
    const remoteSshExtension = vscode.extensions.getExtension(
      REMOTE_SSH_EXTENSION_ID
    );

    if (!remoteSshExtension) {
      throw new Error(
        "Remote - SSH must be installed to open an SSH workspace target."
      );
    }

    if (!remoteSshExtension.isActive) {
      await remoteSshExtension.activate();
    }

    const workspaceUri = createRemoteSshWorkspaceUri(target, vscode.Uri);

    await vscode.commands.executeCommand(
      "vscode.openFolder",
      workspaceUri,
      forceNewWindow
    );
  }
}