import type * as vscode from "vscode";
import type {
  SshWorkspaceTarget,
  WorkspaceFileTarget,
  WorkspaceTarget
} from "../types";

export interface RemoteSshUriComponents {
  scheme: string;
  authority: string;
  path: string;
}

export interface UriFactory {
  file(path: string): vscode.Uri;
  from(components: RemoteSshUriComponents): vscode.Uri;
}

export function createLocalWorkspaceUri(
  target: WorkspaceTarget,
  uriFactory: UriFactory
): vscode.Uri {
  return uriFactory.file(target.path);
}

export function createWorkspaceFileUri(
  target: WorkspaceFileTarget,
  uriFactory: UriFactory
): vscode.Uri {
  return uriFactory.file(target.path);
}

export function createRemoteSshWorkspaceUriComponents(
  target: SshWorkspaceTarget
): RemoteSshUriComponents {
  return {
    scheme: "vscode-remote",
    authority: `ssh-remote+${target.host}`,
    path: target.path
  };
}

export function createRemoteSshWorkspaceUri(
  target: SshWorkspaceTarget,
  uriFactory: UriFactory
): vscode.Uri {
  return uriFactory.from(createRemoteSshWorkspaceUriComponents(target));
}