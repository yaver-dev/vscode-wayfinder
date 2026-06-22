
import * as path from "node:path";

export function isAbsoluteLocalPath(value: string): boolean {
  return path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value);
}

export function isAbsolutePosixPath(value: string): boolean {
  return value.startsWith("/");
}

export function expandHomeDirectory(value: string, homeDirectory: string): string {
  if (value === "~") {
    return homeDirectory;
  }

  if (value.startsWith("~/")) {
    return path.join(homeDirectory, value.slice(2));
  }

  return value;
}