import assert from "node:assert/strict";
import test from "node:test";
import * as path from "node:path";
import {
  parseSshConfigContent,
  SshConfigService
} from "../src/services/SshConfigService";

test("parses concrete Host aliases and filters wildcard and negated entries", () => {
  const result = parseSshConfigContent(`
# Main aliases
Host example-host example-workstation 192.0.2.60
  HostName 192.0.2.60

Host * !blocked wildcard? [pattern]
  User ignored

Host example-app
  HostName 192.0.2.61
`);

  assert.deepEqual(result.hostAliases, [
    "example-host",
    "example-workstation",
    "192.0.2.60",
    "example-app"
  ]);
  assert.deepEqual(result.includePatterns, []);
});

test("parses Include directives, quoted values, and inline comments", () => {
  const result = parseSshConfigContent(`
Include ~/.ssh/conf.d/* # local split config
Include "relative configs/*.conf"
Host production # keep this alias
  HostName example.org
`);

  assert.deepEqual(result.hostAliases, ["production"]);
  assert.deepEqual(result.includePatterns, [
    "~/.ssh/conf.d/*",
    "relative configs/*.conf"
  ]);
});

test("ignores comments and malformed directives", () => {
  const result = parseSshConfigContent(`
# Host hidden
Host
Include
   # nothing useful
`);

  assert.deepEqual(result.hostAliases, []);
  assert.deepEqual(result.includePatterns, []);
});

test("resolves relative and glob Include files recursively", async () => {
  const configPath = path.join(import.meta.dirname, "fixtures", "ssh", "config");
  const service = new SshConfigService(configPath);

  const hosts = await service.listHosts();

  assert.deepEqual(
    hosts.map((host) => host.alias),
    [
      "example-app",
      "example-k3s-dev",
      "example-main",
      "example-workstation",
      "example-hypervisor"
    ]
  );
});