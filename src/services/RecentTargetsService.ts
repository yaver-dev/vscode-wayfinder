import * as path from "node:path";
import type { Memento, Uri as VSCodeUri } from "vscode";
import type { RecentTarget, WorkspaceTarget } from "../types";
import { isRecord } from "../utils/types";

const STORAGE_KEY = "wayfinder.recentTargets";
const MAX_RECENT_TARGETS = 25;

interface UriFactory {
  file(fsPath: string): VSCodeUri;
  parse(value: string): VSCodeUri;
  from(components: { scheme: string; authority: string; path: string }): VSCodeUri;
}

interface CommandExecutor {
  executeCommand<T>(command: string, ...rest: unknown[]): Promise<T | undefined>;
}

export interface RecentTargetsServiceDeps {
  globalState: Memento;
  listNativeCommand: string;
  removeFromRecentCommand: string;
  commands: CommandExecutor;
  Uri: UriFactory;
}

interface RecentlyOpenedResult {
  workspaces?: unknown[];
}

export class RecentTargetsService {
  public constructor(
    private readonly deps: RecentTargetsServiceDeps
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
    await this.deps.globalState.update(STORAGE_KEY, entries.slice(0, MAX_RECENT_TARGETS));
  }

  public async remove(fingerprint: string): Promise<void> {
    const target = (await this.list()).find(
      (entry) => entry.fingerprint === fingerprint
    );
    const entries = this.listStored().filter(
      (entry) => entry.fingerprint !== fingerprint
    );

    await this.deps.globalState.update(STORAGE_KEY, entries);

    if (target) {
      await this.removeFromNativeRecent(target);
    }
  }

  public async clear(): Promise<void> {
    await this.deps.globalState.update(STORAGE_KEY, []);
  }

  private listStored(): RecentTarget[] {
    const stored = this.deps.globalState.get<unknown>(STORAGE_KEY, []);

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored
      .filter(isRecentTarget)
      .sort((left, right) => right.openedAt.localeCompare(left.openedAt));
  }

  private async listNative(): Promise<RecentTarget[]> {
    try {
      const result = await this.deps.commands.executeCommand<RecentlyOpenedResult>(
        this.deps.listNativeCommand
      );

      if (!result || !Array.isArray(result.workspaces)) {
        return [];
      }

      const seen = new Set<string>();
      const now = Date.now();
      const recentTargets: RecentTarget[] = [];

      for (const [index, workspace] of result.workspaces.entries()) {
        const target = toRecentTargetFromNativeWorkspace(workspace, now - index, this.deps.Uri);

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
      await this.deps.commands.executeCommand(
        this.deps.removeFromRecentCommand,
        toUri(target, this.deps.Uri)
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
  openedAtMilliseconds: number,
  Uri: UriFactory
): RecentTarget | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const uri = readWorkspaceUri(value, Uri);
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

function readWorkspaceUri(value: Record<string, unknown>, Uri: UriFactory): VSCodeUri | undefined {
  if (value.folderUri !== undefined) {
    return parseUri(value.folderUri, Uri);
  }

  if (isRecord(value.workspace) && value.workspace.configPath !== undefined) {
    return parseUri(value.workspace.configPath, Uri);
  }

  if (typeof value.path === "string") {
    return Uri.file(value.path);
  }

  return undefined;
}

function parseUri(value: unknown, Uri: UriFactory): VSCodeUri | undefined {
  if (typeof value === "object" && value !== null && "scheme" in value && "fsPath" in value) {
    return value as VSCodeUri;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  try {
    return Uri.parse(value);
  } catch {
    return undefined;
  }
}

function toUri(target: RecentTarget, Uri: UriFactory): VSCodeUri {
  if (target.kind === "ssh" && target.host) {
    return Uri.from({
      scheme: "vscode-remote",
      authority: `ssh-remote+${target.host}`,
      path: target.path
    });
  }

  return Uri.file(target.path);
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

