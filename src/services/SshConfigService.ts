
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { SshHost } from "../types";
import { expandHomeDirectory } from "../utils/Paths";


const MAX_INCLUDE_DEPTH = 16;

export interface SshConfigGetter {
  getSshConfigFile(): string | undefined;
}

export interface ParsedSshConfigContent {
  hostAliases: string[];
  includePatterns: string[];
}

export class SshConfigService {
  public constructor(
    private readonly configGetter: SshConfigGetter,
    private readonly configPathOverride?: string
  ) { }
  public async listHosts(): Promise<SshHost[]> {
    const configPath =
      this.configPathOverride ?? this.resolveConfiguredSshConfigPath();
    const aliases = new Map<string, SshHost>();

    await this.collectHosts(configPath, aliases, new Set<string>(), 0);

    return [...aliases.values()].sort((left, right) =>
      left.alias.localeCompare(right.alias)
    );
  }

  private resolveConfiguredSshConfigPath(): string {
    const configuredPath = this.configGetter.getSshConfigFile();

    if (configuredPath && configuredPath.trim().length > 0) {
      return expandHomeDirectory(configuredPath.trim(), os.homedir());
    }

    return path.join(os.homedir(), ".ssh", "config");
  }

  private async collectHosts(
    configPath: string,
    aliases: Map<string, SshHost>,
    visitedFiles: Set<string>,
    depth: number
  ): Promise<void> {
    if (depth > MAX_INCLUDE_DEPTH) {
      return;
    }

    const resolvedPath = path.resolve(configPath);
    if (visitedFiles.has(resolvedPath)) {
      return;
    }

    visitedFiles.add(resolvedPath);

    let content: string;
    try {
      content = await fs.readFile(resolvedPath, "utf8");
    } catch {
      return;
    }

    const parsed = parseSshConfigContent(content);

    for (const alias of parsed.hostAliases) {
      if (aliases.has(alias)) {
        continue;
      }

      aliases.set(alias, {
        alias,
        sourceFile: resolvedPath
      });
    }

    for (const includePattern of parsed.includePatterns) {
      const includedFiles = await resolveIncludePaths(
        includePattern,
        path.dirname(resolvedPath)
      );

      for (const includedFile of includedFiles) {
        await this.collectHosts(includedFile, aliases, visitedFiles, depth + 1);
      }
    }
  }
}

export function parseSshConfigContent(content: string): ParsedSshConfigContent {
  const hostAliases: string[] = [];
  const includePatterns: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (line.length === 0) {
      continue;
    }

    const [keyword, ...values] = splitDirective(line);
    if (!keyword || values.length === 0) {
      continue;
    }

    if (keyword.toLowerCase() === "host") {
      for (const alias of values) {
        if (isConcreteHostAlias(alias)) {
          hostAliases.push(alias);
        }
      }

      continue;
    }

    if (keyword.toLowerCase() === "include") {
      includePatterns.push(...values);
    }
  }

  return {
    hostAliases,
    includePatterns
  };
}

function splitDirective(line: string): string[] {
  return line.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(unquote) ?? [];
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function stripInlineComment(value: string): string {
  let quote: "'" | '"' | undefined;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "'" || character === '"') {
      if (quote === character) {
        quote = undefined;
      } else if (!quote) {
        quote = character;
      }

      continue;
    }

    if (character === "#" && !quote) {
      return value.slice(0, index);
    }
  }

  return value;
}

function isConcreteHostAlias(alias: string): boolean {
  return (
    alias.length > 0 &&
    !alias.startsWith("!") &&
    !alias.includes("*") &&
    !alias.includes("?") &&
    !alias.includes("[") &&
    !alias.includes("]")
  );
}

async function resolveIncludePaths(
  includePattern: string,
  baseDirectory: string
): Promise<string[]> {
  const normalizedPattern = expandHomeDirectory(includePattern, os.homedir());
  const absolutePattern = path.isAbsolute(normalizedPattern)
    ? normalizedPattern
    : path.resolve(baseDirectory, normalizedPattern);

  if (!hasGlob(absolutePattern)) {
    return [absolutePattern];
  }

  const directory = path.dirname(absolutePattern);
  const filePattern = path.basename(absolutePattern);

  let entries: string[];
  try {
    entries = await fs.readdir(directory);
  } catch {
    return [];
  }

  const matcher = globToRegExp(filePattern);
  return entries
    .filter((entry) => matcher.test(entry))
    .map((entry) => path.join(directory, entry))
    .sort((left, right) => left.localeCompare(right));
}

function hasGlob(value: string): boolean {
  return value.includes("*") || value.includes("?") || value.includes("[");
}

function globToRegExp(pattern: string): RegExp {
  let expression = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === "*") {
      expression += ".*";
      continue;
    }

    if (character === "?") {
      expression += ".";
      continue;
    }

    if (character === "[") {
      const closingBracket = pattern.indexOf("]", index + 1);
      if (closingBracket > index + 1) {
        expression += pattern.slice(index, closingBracket + 1);
        index = closingBracket;
        continue;
      }
    }

    expression += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }

  return new RegExp(`${expression}$`);
}