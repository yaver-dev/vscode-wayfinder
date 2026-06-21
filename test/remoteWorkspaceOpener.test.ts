import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteSshWorkspaceUriComponents } from "../src/utils/UriFactory";

test("creates the expected Remote SSH URI components", () => {
  const components = createRemoteSshWorkspaceUriComponents({
    id: "example-service",
    groupId: "example-group",
    name: "example-service",
    kind: "ssh",
    host: "example-host",
    path: "/srv/example/service",
    color: "purple"
  });

  assert.deepEqual(components, {
    scheme: "vscode-remote",
    authority: "ssh-remote+example-host",
    path: "/srv/example/service"
  });
});

test("preserves an SSH alias exactly in the Remote SSH authority", () => {
  const components = createRemoteSshWorkspaceUriComponents({
    id: "customer-prod",
    groupId: "example-group",
    name: "customer-prod",
    kind: "ssh",
    host: "customer-prod.example",
    path: "/srv/customer/app"
  });

  assert.equal(components.authority, "ssh-remote+customer-prod.example");
  assert.equal(components.path, "/srv/customer/app");
});