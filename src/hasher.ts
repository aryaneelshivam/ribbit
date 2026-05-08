// ─── Content Hasher ────────────────────────────────────────────────────────────
// Uses xxhash-wasm to compute fast content hashes for incremental re-run
// detection. Compares hashes against a previous graph to avoid re-parsing
// unchanged files.

import * as fs from "fs/promises";
import * as path from "path";
import xxhash from "xxhash-wasm";
import { RibbitGraph } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hasherInstance: any = null;

/**
 * Initialise the xxhash WASM module. Called once at startup.
 */
async function getHasher(): Promise<any> {
  if (!hasherInstance) {
    hasherInstance = await xxhash();
  }
  return hasherInstance;
}

/**
 * Hash the contents of a single file.
 */
export async function hashFile(filePath: string): Promise<string> {
  const hasher = await getHasher();
  const content = await fs.readFile(filePath, "utf-8");
  return String(hasher.h64(content));
}

/**
 * Hash a raw string.
 */
export async function hashString(content: string): Promise<string> {
  const hasher = await getHasher();
  return String(hasher.h64(content));
}

/**
 * Result of the diffing phase: which files need re-parsing and which can
 * be carried forward from the previous graph.
 */
export interface HashDiffResult {
  changedFiles: string[];
  unchangedFiles: string[];
  fileHashes: Map<string, string>;
}

/**
 * Load the previous graph from disk.
 *
 * @param outputDir  Path to the ribbit/ output folder
 * @returns          The previous RibbitGraph, or null if none exists / is corrupt
 */
export async function loadPreviousGraph(outputDir: string): Promise<RibbitGraph | null> {
  const indexPath = path.join(outputDir, "index.json");
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as RibbitGraph;
    // Basic validity check
    if (!parsed.meta || !parsed.files) {
      console.warn("Ribbit: previous graph is malformed, falling back to full re-parse");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Compare discovered files against the previous graph to determine which
 * files have changed and need re-parsing.
 *
 * @param files          All discovered file paths (absolute)
 * @param root           Project root (for computing relative paths)
 * @param previousGraph  The previously generated graph (may be null)
 * @returns              Changed/unchanged file lists and a hash map
 */
export async function diffFiles(
  files: string[],
  root: string,
  previousGraph: RibbitGraph | null
): Promise<HashDiffResult> {
  const hasher = await getHasher();
  const changedFiles: string[] = [];
  const unchangedFiles: string[] = [];
  const fileHashes = new Map<string, string>();

  // Read and hash all files concurrently (batched to avoid fd exhaustion)
  const BATCH_SIZE = 256;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (filePath) => {
        const content = await fs.readFile(filePath, "utf-8");
        const hash = String(hasher.h64(content));
        return { filePath, hash };
      })
    );

    for (const { filePath, hash } of results) {
      const relativePath = path.relative(root, filePath);
      fileHashes.set(filePath, hash);

      if (!previousGraph) {
        changedFiles.push(filePath);
        continue;
      }

      const prevFile = previousGraph.files[relativePath];
      if (!prevFile || prevFile.hash !== hash) {
        changedFiles.push(filePath);
      } else {
        unchangedFiles.push(filePath);
      }
    }
  }

  return { changedFiles, unchangedFiles, fileHashes };
}
