// ─── Parser Router ─────────────────────────────────────────────────────────────
// Routes each file to the correct language parser based on its extension.
// This module is the single entry point used by workers.

import * as path from "path";
import * as fs from "fs";
import { ParseResult } from "../types";
import { parseTypeScriptFile } from "./typescript";
import { parseJavaScriptFile } from "./javascript";
import { parsePythonFile } from "./python";

const EXTENSION_TO_PARSER: Record<
  string,
  (source: string, filePath: string, hash: string, root: string) => ParseResult
> = {
  ".ts": parseTypeScriptFile,
  ".tsx": parseTypeScriptFile,
  ".js": parseJavaScriptFile,
  ".jsx": parseJavaScriptFile,
  ".mjs": parseJavaScriptFile,
  ".cjs": parseJavaScriptFile,
  ".py": parsePythonFile,
};

/**
 * Parse a single source file, routing to the appropriate language parser.
 *
 * @param filePath  Absolute path to the file
 * @param hash      Pre-computed xxhash of the file contents
 * @param root      Project root (for computing relative paths)
 * @returns         A ParseResult with extracted nodes and edges, or an error
 */
export function parseFile(filePath: string, hash: string, root: string): ParseResult {
  const ext = path.extname(filePath).toLowerCase();
  const parser = EXTENSION_TO_PARSER[ext];

  if (!parser) {
    return {
      filePath,
      hash,
      nodes: [],
      edges: [],
      error: `Unsupported file extension: ${ext}`,
    };
  }

  try {
    const source = fs.readFileSync(filePath, "utf-8");
    return parser(source, filePath, hash, root);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      filePath,
      hash,
      nodes: [],
      edges: [],
      error: `Parse error: ${message}`,
    };
  }
}

/**
 * Parse multiple files sequentially. Used by worker threads.
 */
export function parseFiles(
  files: Array<{ filePath: string; hash: string }>,
  root: string
): ParseResult[] {
  const results: ParseResult[] = [];
  for (const { filePath, hash } of files) {
    results.push(parseFile(filePath, hash, root));
  }
  return results;
}
