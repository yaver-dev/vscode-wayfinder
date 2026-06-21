import assert from "node:assert/strict";
import test from "node:test";
import { validateWorkspaceTarget } from "../src/validation/WorkspaceTargetValidation";

test("accepts a valid local workspace target", () => {
  const result = validateWorkspaceTarget({
    id: "example-local",
    groupId: "example-group",
    name: "Example Local",
    order: 0,
    kind: "local",
    path: "/workspace/example-local",
    color: "blue"
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    id: "example-local",
    groupId: "example-group",
    name: "Example Local",
    order: 0,
    kind: "local",
    path: "/workspace/example-local",
    color: "blue"
  });
});

test("accepts a valid SSH workspace target", () => {
  const result = validateWorkspaceTarget({
    id: "example-service",
    groupId: "example-group",
    name: "Example Service",
    order: 0,
    kind: "ssh",
    host: "example-host",
    path: "/srv/example/service",
    color: "purple"
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    id: "example-service",
    groupId: "example-group",
    name: "Example Service",
    order: 0,
    kind: "ssh",
    host: "example-host",
    path: "/srv/example/service",
    color: "purple"
  });
});

test("rejects an SSH workspace target without a host or absolute POSIX path", () => {
  const result = validateWorkspaceTarget({
    id: "invalid-ssh",
    groupId: "example-group",
    name: "Invalid SSH",
    kind: "ssh",
    path: "relative/project"
  });

  assert.equal(result.value, undefined);
  assert.deepEqual(result.errors, [
    "SSH workspace target requires a host.",
    "SSH workspace path must be an absolute POSIX path."
  ]);
});

test("accepts a valid workspace-file target", () => {
  const result = validateWorkspaceTarget({
    id: "example-workspace",
    groupId: "example-group",
    name: "Example Workspace",
    order: 0,
    kind: "workspaceFile",
    path: "/workspace/example-project/example.code-workspace"
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    id: "example-workspace",
    groupId: "example-group",
    name: "Example Workspace",
    order: 0,
    kind: "workspaceFile",
    path: "/workspace/example-project/example.code-workspace"
  });
});

test("rejects a workspace-file target that is not a .code-workspace file", () => {
  const result = validateWorkspaceTarget({
    id: "wrong-file",
    groupId: "example-group",
    name: "Wrong file",
    kind: "workspaceFile",
    path: "/workspace/example-project/package.json"
  });

  assert.equal(result.value, undefined);
  assert.deepEqual(result.errors, [
    "Workspace file path must end with .code-workspace."
  ]);
});
