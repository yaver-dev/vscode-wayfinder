import assert from "node:assert/strict";
import test from "node:test";
import type { Memento, Uri as VSCodeUri } from "vscode";
import type { RecentTarget, WorkspaceTarget } from "../src/types";
import { RecentTargetsService } from "../src/services/RecentTargetsService";

function createMemento(initial: Record<string, unknown> = {}): Memento {
  const store = { ...initial };
  return {
    get<T>(key: string, defaultValue?: T): T {
      return (key in store ? store[key] : defaultValue) as T;
    },
    async update(key: string, value: unknown): Promise<void> {
      store[key] = value;
    }
  };
}

function createServiceDeps(initial: Record<string, unknown> = {}) {
  const memento = createMemento(initial);
  return {
    globalState: memento,
    listNativeCommand: "_workbench.getRecentlyOpened",
    removeFromRecentCommand: "vscode.removeFromRecentlyOpened",
    commands: { executeCommand: async () => undefined },
    Uri: {
      file(fsPath: string) {
        return { scheme: "file", fsPath, authority: "", path: fsPath, toJSON() { return {}; }, with() { return this; } } as unknown as VSCodeUri;
      },
      parse(_value: string) {
        return { scheme: "file", fsPath: _value, authority: "", path: _value, toJSON() { return {}; }, with() { return this; } } as unknown as VSCodeUri;
      },
      from(components: { scheme: string; authority: string; path: string }) {
        return { ...components, fsPath: components.path, toJSON() { return {}; }, with() { return this; } } as unknown as VSCodeUri;
      }
    }
  };
}

function createLocalTarget(overrides: Partial<WorkspaceTarget> = {}): WorkspaceTarget {
  return {
    id: "test-local",
    groupId: "test-group",
    name: "Test Local",
    order: 0,
    kind: "local",
    path: "/workspace/test-local",
    ...overrides
  } as WorkspaceTarget;
}

function createSshTarget(overrides: Partial<WorkspaceTarget> = {}): WorkspaceTarget {
  return {
    id: "test-ssh",
    groupId: "test-group",
    name: "Test SSH",
    order: 0,
    kind: "ssh",
    host: "example-host",
    path: "/srv/test",
    ...overrides
  } as WorkspaceTarget;
}

test("mergeRecentTargets deduplicates by fingerprint with native priority", () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);
  const native: RecentTarget[] = [
    { fingerprint: "ssh:host-a:/path-a", kind: "ssh", name: "A", path: "/path-a", host: "host-a", openedAt: "2024-01-01T10:00:00Z" },
    { fingerprint: "local:/path-b", kind: "local", name: "B", path: "/path-b", openedAt: "2024-01-01T09:00:00Z" }
  ];
  const stored: RecentTarget[] = [
    { fingerprint: "ssh:host-a:/path-a", kind: "ssh", name: "A (stored)", path: "/path-a", host: "host-a", openedAt: "2024-01-01T08:00:00Z" },
    { fingerprint: "local:/path-c", kind: "local", name: "C", path: "/path-c", openedAt: "2024-01-01T11:00:00Z" }
  ];

  const merged = service.mergeRecentTargets(native, stored);

  assert.equal(merged.length, 3);
  assert.deepEqual(
    merged.map((t) => t.fingerprint),
    ["local:/path-c", "ssh:host-a:/path-a", "local:/path-b"]
  );
  assert.equal(merged.find((t) => t.fingerprint === "ssh:host-a:/path-a")?.name, "A");
});

test("mergeRecentTargets sorts by openedAt descending", () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);
  const targets: RecentTarget[] = [
    { fingerprint: "a", kind: "local", name: "A", path: "/a", openedAt: "2024-01-01T03:00:00Z" },
    { fingerprint: "b", kind: "local", name: "B", path: "/b", openedAt: "2024-01-01T01:00:00Z" },
    { fingerprint: "c", kind: "local", name: "C", path: "/c", openedAt: "2024-01-01T02:00:00Z" }
  ];

  const merged = service.mergeRecentTargets(targets, []);

  assert.deepEqual(
    merged.map((t) => t.fingerprint),
    ["a", "c", "b"]
  );
});

test("mergeRecentTargets limits to MAX_RECENT_TARGETS", () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);
  const targets: RecentTarget[] = Array.from({ length: 30 }, (_, i) => ({
    fingerprint: `target-${i}`,
    kind: "local" as const,
    name: `T${i}`,
    path: `/t${i}`,
    openedAt: `2024-01-01T${String(i).padStart(2, "0")}:00:00Z`
  }));

  const merged = service.mergeRecentTargets(targets, []);

  assert.equal(merged.length, 25);
});

test("record stores target and list returns it when native is empty", async () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);

  await service.record(createLocalTarget({ id: "proj-1", name: "Project 1", path: "/projects/p1" }));
  await service.record(createSshTarget({ id: "srv-1", name: "Server 1", host: "prod", path: "/srv/app" }));

  const list = await service.list();

  assert.equal(list.length, 2);
  assert.equal(list[0].name, "Server 1");
  assert.equal(list[0].kind, "ssh");
  assert.equal(list[0].host, "prod");
  assert.equal(list[1].name, "Project 1");
});

test("record deduplicates by fingerprint and moves to front", async () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);

  await service.record(createLocalTarget({ id: "a", name: "A", path: "/a" }));
  await service.record(createLocalTarget({ id: "b", name: "B", path: "/b" }));
  await service.record(createLocalTarget({ id: "a", name: "A-updated", path: "/a" }));

  const list = await service.list();

  assert.equal(list.length, 2);
  assert.equal(list[0].name, "A-updated");
  assert.equal(list[1].name, "B");
});

test("remove deletes stored entry by fingerprint", async () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);

  await service.record(createLocalTarget({ id: "a", name: "A", path: "/a" }));
  await service.record(createLocalTarget({ id: "b", name: "B", path: "/b" }));

  const before = await service.list();
  assert.equal(before.length, 2);

  const fingerprintA = before.find((t) => t.name === "A")!.fingerprint;
  await service.remove(fingerprintA);

  const after = await service.list();
  assert.equal(after.length, 1);
  assert.equal(after[0].name, "B");
});

test("clear removes all stored entries", async () => {
  const deps = createServiceDeps();
  const service = new RecentTargetsService(deps);

  await service.record(createLocalTarget({ id: "a", name: "A", path: "/a" }));
  await service.record(createLocalTarget({ id: "b", name: "B", path: "/b" }));

  await service.clear();

  const list = await service.list();
  assert.equal(list.length, 0);
});
