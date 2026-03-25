import type { Extension } from "./types";
import { transformExtension } from "./transform";
import { searchExtension } from "./search";

const extensions: Extension[] = [];

export function registerExtension(ext: Extension) {
  extensions.push(ext);
}

export function getExtensions(): Extension[] {
  return [...extensions];
}

/**
 * Match a spoken command to the best extension.
 *
 * Checks if the command starts with any extension keyword.
 * Falls back to transform extension if text is selected, otherwise null.
 */
export function matchExtension(
  command: string,
  hasSelectedText: boolean
): Extension | null {
  const lower = command.toLowerCase().trim();

  for (const ext of extensions) {
    for (const keyword of ext.keywords) {
      if (lower.startsWith(keyword.toLowerCase())) {
        return ext;
      }
    }
  }

  // Default: if text is selected, use transform; otherwise no match
  if (hasSelectedText) {
    return extensions.find((e) => e.name === "transform") || null;
  }

  return null;
}

// Register built-in extensions
registerExtension(searchExtension);
registerExtension(transformExtension);
