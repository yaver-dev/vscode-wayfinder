import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardSnapshot, WorkspaceTarget } from "../webview/src/protocol";
import {
  buildWorkspaceTarget,
  createNewGroup,
  createNewWorkspace,
  createSshWorkspaceForHost,
  pinRecentToWorkspace
} from "../webview/src/lib/workspaceBuilder";

function emptySnapshot(): DashboardSnapshot {
  return {
    settings: { groups: [], workspaces: [], openOnEmptyWindow: false, importSshHosts: true },
    recentTargets: [],
    sshHosts: [],
    configurationErrors: []
  };
}

test("buildWorkspaceTarget creates a local target with kind local", () => {
  const target = buildWorkspaceTarget("local", {
    id: "ws-1",
    groupId: "grp",
    name: "My Project",
    order: 10,
    path: "/projects/my"
  });

  assert.equal(target.kind, "local");
  assert.equal(target.id, "ws-1");
  assert.equal(target.name, "My Project");
  assert.equal(target.path, "/projects/my");
});

test("buildWorkspaceTarget creates an SSH target with host", () => {
  const target = buildWorkspaceTarget("ssh", {
    id: "ws-ssh",
    groupId: "grp",
    name: "Server",
    order: 10,
    path: "/srv/app"
  }, "prod-host");

  assert.equal(target.kind, "ssh");
  assert.equal((target as WorkspaceTarget & { host: string }).host, "prod-host");
});

test("buildWorkspaceTarget creates a workspaceFile target", () => {
  const target = buildWorkspaceTarget("workspaceFile", {
    id: "ws-file",
    groupId: "grp",
    name: "Workspace",
    order: 10,
    path: "/projects/my.code-workspace"
  });

  assert.equal(target.kind, "workspaceFile");
  assert.equal(target.path, "/projects/my.code-workspace");
});

test("buildWorkspaceTarget includes optional color and badge", () => {
  const target = buildWorkspaceTarget("local", {
    id: "ws-1",
    groupId: "grp",
    name: "My Project",
    order: 10,
    path: "/projects/my",
    color: "blue",
    badge: "MP"
  });

  assert.equal(target.color, "blue");
  assert.equal(target.badge, "MP");
});

test("buildWorkspaceTarget omits color and badge when not provided", () => {
  const target = buildWorkspaceTarget("local", {
    id: "ws-1",
    groupId: "grp",
    name: "My Project",
    order: 10,
    path: "/projects/my"
  });

  assert.equal(target.color, undefined);
  assert.equal(target.badge, undefined);
});

test("createNewGroup assigns order 10 when groups list is empty", () => {
  const group = createNewGroup([]);

  assert.equal(group.id, "");
  assert.equal(group.name, "");
  assert.equal(group.order, 10);
});

test("createNewGroup assigns next order above max", () => {
  const group = createNewGroup([
    { id: "g1", name: "G1", order: 20 },
    { id: "g2", name: "G2", order: 50 }
  ]);

  assert.equal(group.order, 60);
});

test("createNewWorkspace assigns order 10 when no workspaces exist", () => {
  const workspace = createNewWorkspace("grp", []);

  assert.equal(workspace.groupId, "grp");
  assert.equal(workspace.kind, "local");
  assert.equal(workspace.order, 10);
  assert.equal(workspace.id, "");
  assert.equal(workspace.name, "");
  assert.equal(workspace.path, "");
});

test("createNewWorkspace considers only same-group workspaces for order", () => {
  const workspace = createNewWorkspace("grp-a", [
    { id: "w1", groupId: "grp-a", name: "W1", order: 30, kind: "local", path: "/w1" } as WorkspaceTarget,
    { id: "w2", groupId: "grp-b", name: "W2", order: 100, kind: "local", path: "/w2" } as WorkspaceTarget
  ]);

  assert.equal(workspace.order, 40);
});

test("createSshWorkspaceForHost creates an SSH target with the given host", () => {
  const target = createSshWorkspaceForHost("prod-host", { id: "grp" }, []);

  assert.equal(target.kind, "ssh");
  assert.equal((target as WorkspaceTarget & { host: string }).host, "prod-host");
  assert.equal(target.name, "prod-host");
  assert.equal(target.groupId, "grp");
});

test("createSshWorkspaceForHost returns empty-id workspace when group is undefined", () => {
  const target = createSshWorkspaceForHost("host", undefined, []);

  assert.equal(target.groupId, "");
  assert.equal(target.kind, "ssh");
});

test("pinRecentToWorkspace creates an SSH target from a recent SSH target", () => {
  const target = pinRecentToWorkspace("ssh", "My Server", "/srv/app", "prod-host", "grp", []);

  assert.equal(target.kind, "ssh");
  assert.equal(target.name, "My Server");
  assert.equal(target.path, "/srv/app");
  assert.equal((target as WorkspaceTarget & { host: string }).host, "prod-host");
  assert.equal(target.groupId, "grp");
});

test("pinRecentToWorkspace creates a local target from a recent local target", () => {
  const target = pinRecentToWorkspace("local", "My Project", "/projects/my", undefined, "grp", []);

  assert.equal(target.kind, "local");
  assert.equal(target.name, "My Project");
  assert.equal(target.path, "/projects/my");
  assert.equal(target.groupId, "grp");
});

test("pinRecentToWorkspace creates a workspaceFile target", () => {
  const target = pinRecentToWorkspace("workspaceFile", "My WS", "/p/my.code-workspace", undefined, "grp", []);

  assert.equal(target.kind, "workspaceFile");
  assert.equal(target.path, "/p/my.code-workspace");
});
