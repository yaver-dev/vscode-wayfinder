

import * as vscode from "vscode";
import { HubPanel } from "./HubPanel";
import { RecentTargetsService } from "./services/RecentTargetsService";
import { RemoteWorkspaceOpener } from "./services/RemoteWorkspaceOpener";
import { SettingsService } from "./services/SettingsService";
import { SshConfigService } from "./services/SshConfigService";
import { WorkspaceService } from "./services/WorkspaceService";

export function activate(context: vscode.ExtensionContext): void {
  const settingsService = new SettingsService();
  const recentTargetsService = new RecentTargetsService(context.globalState);
  const sshConfigService = new SshConfigService();
  const workspaceService = new WorkspaceService(new RemoteWorkspaceOpener());

  const openDashboard = (): void => {
    HubPanel.revealOrCreate({
      extensionUri: context.extensionUri,
      settingsService,
      recentTargetsService,
      sshConfigService,
      workspaceService
    });
  };

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "wayfinder.open";
  statusBarItem.text = "$(home) Wayfinder";
  statusBarItem.tooltip = "Open Wayfinder Dashboard";
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand("wayfinder.open", openDashboard),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("wayfinder")) {
        HubPanel.refresh();
      }
    })
  );

  const settings = settingsService.read();
  if (settings.openOnEmptyWindow && isEmptyWindow()) {
    openDashboard();
  }
}

export function deactivate(): void {
  HubPanel.dispose();
}

function isEmptyWindow(): boolean {
  return (
    vscode.workspace.workspaceFile === undefined &&
    (vscode.workspace.workspaceFolders?.length ?? 0) === 0
  );
}