import * as path from "node:path";
import * as vscode from "vscode";
import type { RecentTarget, WorkspaceTarget } from "../types";
import { isRecord } from "../utils/types";

const STORAGE_KEY = "wayfinder.recentTargets";
const MAX_RECENT_TARGETS = 25;
const RECENTLY_OPENED_COMMAND = "_workbench.getRecentlyOpened";
const REMOVE_FROM_RECENTLY_OPENED_COMMAND = "vscode.removeFromRecentlyOpened";

interface RecentlyOpenedResult {
  workspaces?: unknown[];
}

export class RecentTargetsService {
  public constructor(
    private readonly globalState: vscode.Memento
  ) { }

  public async list(): Promise<RecentTarget[]> {
    const nativeTargets = await this.listNative();
    const storedTargets = this.listStored();
    return this.mergeRecentTargets(nativeTargets, storedTargets);
  }

  mergeRecentTargets(
    nativeTargets: RecentTarget[],
    storedTargets: RecentTarget[]
  ): RecentTarget[] {
    const seen = new Set<string>();
    const merged: RecentTarget[] = [];

    for (const target of nativeTargets) {
      if (!seen.has(target.fingerprint)) {
        seen.add(target.fingerprint);
        merged.push(target);
      }
    }

    for (const target of storedTargets) {
      if (!seen.has(target.fingerprint)) {
        seen.add(target.fingerprint);
        merged.push(target);
      }
    }

    return merged
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
      .slice(0, MAX_RECENT_TARGETS);
  }

  public async record(target: WorkspaceTarget): Promise<void> {
    const entry = toRecentTarget(target);
    const entries = this.listStored().filter(
      (existing) => existing.fingerprint !== entry.fingerprint
    );

    entries.unshift(entry);
    await this.globalState.update(STORAGE_KEY, entries.slice(0, MAX_RECENT_TARGETS));
  }

  public async remove(fingerprint: string): Promise<void> {
    const target = (await this.list()).find(
      (entry) => entry.fingerprint === fingerprint
    );
    const entries = this.listStored().filter(
      (entry) => entry.fingerprint !== fingerprint
    );

    await this.globalState.update(STORAGE_KEY, entries);

    if (target) {
      await this.removeFromNativeRecent(target);
    }
  }

  public async clear(): Promise<void> {
    await this.globalState.update(STORAGE_KEY, []);
  }

  private listStored(): RecentTarget[] {
    const stored = this.globalState.get<unknown>(STORAGE_KEY, []);

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .filter(isRecentTarget)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt));
  }

  private async listNative(): Promise<RecentTarget[]> {
    try {
      const result = await vscode.commands.executeCommand<RecentlyOpenedResult>(
        RECENTLY_OPENED_COMMAND
      );

      if (!result || !Array.isArray(result.workspaces)) {
        return [];
      }

      const seen = new Set<string>();
      const now = Date.now();
      const recentTargets: RecentTarget[] = [];

      for (const [index, workspace] of result.workspaces.entries()) {
        const target = toRecentTargetFromNativeWorkspace(workspace, now - index);

        if (target && !seen.has(target.fingerprint)) {
          seen.add(target.fingerprint);
          recentTargets.push(target);
        }
      }

      return recentTargets.slice(0, MAX_RECENT_TARGETS);
    } catch {
      return [];
    }
  }

  private async removeFromNativeRecent(target: RecentTarget): Promise<void> {
    try {
      await vscode.commands.executeCommand(
        REMOVE_FROM_RECENTLY_OPENED_COMMAND,
        toUri(target)
      );
    } catch {
      // Native recent support is best-effort and isolated behind this adapter.
    }
  }
}

function toRecentTarget(target: WorkspaceTarget): RecentTarget {
  return {
    fingerprint: createFingerprint(target),
    workspaceId: target.id,
    kind: target.kind,
    name: target.name,
    path: target.path,
    ...(target.kind === "ssh" ? { host: target.host } : {}),
    openedAt: new Date().toISOString()
  };
}

function toRecentTargetFromNativeWorkspace(
  value: unknown,
  openedAtMilliseconds: number
): RecentTarget | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const uri = readWorkspaceUri(value);
  if (!uri) {
    return undefined;
  }

  const openedAt = new Date(openedAtMilliseconds).toISOString();

  if (uri.scheme === "vscode-remote" && uri.authority.startsWith("ssh-remote+")) {
    const host = uri.authority.slice("ssh-remote+".length);
    const remotePath = uri.path;

    if (!host || !remotePath.startsWith("/")) {
      return undefined;
    }

    return {
      fingerprint: `ssh:${host}:${remotePath}`,
      kind: "ssh",
      name: path.posix.basename(remotePath) || host,
      host,
      path: remotePath,
      openedAt
    };
  }

  if (uri.scheme !== "file") {
    return undefined;
  }

  const kind = uri.fsPath.endsWith(".code-workspace")
    ? "workspaceFile"
    : "local";

  return {
    fingerprint: `${kind}:${uri.fsPath}`,
    kind,
    name: path.basename(uri.fsPath) || uri.fsPath,
    path: uri.fsPath,
    openedAt
  };
}

function readWorkspaceUri(value: Record<string, unknown>): vscode.Uri | undefined {
  if (value.folderUri !== undefined) {
    return parseUri(value.folderUri);
  }

  if (isRecord(value.workspace) && value.workspace.configPath !== undefined) {
    return parseUri(value.workspace.configPath);
  }

  if (typeof value.path === "string") {
    return vscode.Uri.file(value.path);
  }

  return undefined;
}

function parseUri(value: unknown): vscode.Uri | undefined {
  if (value instanceof vscode.Uri) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  try {
    return vscode.Uri.parse(value);
  } catch {
    return undefined;
  }
}

function toUri(target: RecentTarget): vscode.Uri {
  if (target.kind === "ssh" && target.host) {
    return vscode.Uri.from({
      scheme: "vscode-remote",
      authority: `ssh-remote+${target.host}`,
      path: target.path
    });
  }

  return vscode.Uri.file(target.path);
}

function createFingerprint(target: WorkspaceTarget): string {
  return target.kind === "ssh"
    ? `ssh:${target.host}:${target.path}`
    : `${target.kind}:${target.path}`;
}

function isRecentTarget(value: unknown): value is RecentTarget {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.fingerprint === "string" &&
    typeof value.kind === "string" &&
    typeof value.name === "string" &&
    typeof value.path === "string" &&
    typeof value.openedAt === "string" &&
    (value.workspaceId === undefined || typeof value.workspaceId === "string") &&
    (value.host === undefined || typeof value.host === "string")
  );
}

