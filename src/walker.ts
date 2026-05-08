// ─── File Walker ───────────────────────────────────────────────────────────────
// Discovers all source files eligible for parsing. Respects .gitignore,
// configured ignore patterns, language filters, and sorts by directory depth
// so entry points and index files are prioritised.

import fg from "fast-glob";
import * as fs from "fs";
import * as path from "path";
import { RibbitConfig, LANGUAGE_EXTENSIONS, DEFAULT_IGNORE } from "./types";

/**
 * Parse a .gitignore file into glob patterns that fast-glob understands.
 */
function parseGitignore(root: string): string[] {
  const gitignorePath = path.join(root, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return [];

  const content = fs.readFileSync(gitignorePath, "utf-8");
  const patterns: string[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    // Skip comments and blank lines
    if (!line || line.startsWith("#")) continue;
    // Normalise: ensure patterns work as globs
    if (line.startsWith("/")) {
      patterns.push(line.slice(1));
    } else {
      patterns.push(`**/${line}`);
    }
  }
  return patterns;
}

/**
 * Build the list of file-extension globs for the configured languages.
 */
function buildExtensionGlobs(languages: string[]): string[] {
  const exts: string[] = [];
  for (const lang of languages) {
    const langExts = LANGUAGE_EXTENSIONS[lang];
    if (langExts) {
      for (const ext of langExts) {
        exts.push(`**/*${ext}`);
      }
    }
  }
  return exts;
}

/**
 * Walk the project directory and return all files to be parsed.
 *
 * @param root    Absolute path to the project root
 * @param config  Ribbit configuration
 * @returns       Sorted array of absolute file paths
 */
export async function walkFiles(root: string, config: RibbitConfig): Promise<string[]> {
  const extensionGlobs = buildExtensionGlobs(config.languages);
  if (extensionGlobs.length === 0) return [];

  // Merge ignore sources: built-in defaults + config ignores + .gitignore
  const ignorePatterns: string[] = [
    ...DEFAULT_IGNORE.map((d) => `**/${d}/**`),
    ...config.ignore,
    ...parseGitignore(root),
  ];

  // Exclude dot-files unless explicitly included
  if (!config.includeDotFiles) {
    ignorePatterns.push("**/.*/**");
  }

  const files = await fg(extensionGlobs, {
    cwd: root,
    absolute: true,
    ignore: ignorePatterns,
    dot: config.includeDotFiles,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  // Sort by directory depth (shallowest first) so entry points are parsed early
  files.sort((a, b) => {
    const depthA = a.split(path.sep).length;
    const depthB = b.split(path.sep).length;
    if (depthA !== depthB) return depthA - depthB;
    return a.localeCompare(b);
  });

  return files;
}
