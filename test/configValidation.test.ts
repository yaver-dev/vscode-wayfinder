import assert from "node:assert/strict";
import test from "node:test";
import {
  validateGroups,
  validateWayfinderSettings,
  validateWorkspaces
} from "../src/validation/ConfigValidation";

test("accepts valid groups with unique ids", () => {
  const result = validateGroups([
    { id: "example-group", name: "EXAMPLE GROUP", order: 10 },
    { id: "home", name: "HOME", order: 20 }
  ]);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, [
    { id: "example-group", name: "EXAMPLE GROUP", order: 10 },
    { id: "home", name: "HOME", order: 20 }
  ]);
});

test("rejects duplicate group ids", () => {
  const result = validateGroups([
    { id: "example-group", name: "EXAMPLE GROUP", order: 10 },
    { id: "example-group", name: "EXAMPLE GROUP Duplicate", order: 20 }
  ]);

  assert.equal(result.value, undefined);
  assert.deepEqual(result.errors, [
    'groups[1]: Group id "example-group" is duplicated.'
  ]);
});

test("rejects a workspace that references an unknown group", () => {
  const result = validateWorkspaces(
    [
      {
        id: "example-service",
        groupId: "missing-group",
        name: "example-service",
        kind: "ssh",
        host: "example-host",
        path: "/srv/example/service"
      }
    ],
    [{ id: "example-group", name: "EXAMPLE GROUP", order: 10 }]
  );

  assert.equal(result.value, undefined);
  assert.deepEqual(result.errors, [
    'workspaces[0]: Unknown groupId "missing-group".'
  ]);
});

test("returns safe fallback settings while reporting invalid configuration", () => {
  const result = validateWayfinderSettings({
    groups: "not-an-array",
    workspaces: {},
    openOnEmptyWindow: "yes",
    importSshHosts: 1
  });

  assert.deepEqual(result.value, {
    groups: [],
    workspaces: [],
    openOnEmptyWindow: false,
    importSshHosts: true
  });
  assert.deepEqual(result.errors, [
    "Wayfinder groups must be an array.",
    "Wayfinder workspaces must be an array.",
    "openOnEmptyWindow must be a boolean.",
    "importSshHosts must be a boolean."
  ]);
});

test("accepts a complete valid settings payload", () => {
  const result = validateWayfinderSettings({
    groups: [{ id: "home", name: "HOME", order: 10 }],
    workspaces: [
      {
        id: "wayfinder",
        groupId: "home",
        name: "Wayfinder",
        order: 0,
        kind: "local",
        path: "/workspace/example-project",
        color: "green"
      }
    ],
    openOnEmptyWindow: true,
    importSshHosts: false
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.value, {
    groups: [{ id: "home", name: "HOME", order: 10 }],
    workspaces: [
      {
        id: "wayfinder",
        groupId: "home",
        name: "Wayfinder",
        order: 0,
        kind: "local",
        path: "/workspace/example-project",
        color: "green"
      }
    ],
    openOnEmptyWindow: true,
    importSshHosts: false
  });
});