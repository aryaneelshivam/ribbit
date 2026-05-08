// ─── Differ ────────────────────────────────────────────────────────────────────
// On incremental re-runs, validates that unchanged files still have consistent
// relationship data after changed files may have altered their exports.
// Patches any stale edges so the graph is always fully consistent.

import { RibbitGraph } from "../types";

/**
 * Validate and patch relationships in the graph after an incremental build.
 *
 * When files change their exports, other files that import from them may have
 * stale relationship data even if those files themselves didn't change. This
 * function detects and corrects such inconsistencies.
 *
 * @param graph         The assembled graph (will be mutated in place)
 * @param changedFiles  Relative paths of files that were re-parsed
 */
export function patchStaleEdges(graph: RibbitGraph, changedFiles: string[]): void {
  if (changedFiles.length === 0) return;

  const changedSet = new Set(changedFiles);

  // ── Step 1: Identify unchanged files that reference changed files ────────
  const affectedUnchangedFiles: string[] = [];

  for (const [filePath, rel] of Object.entries(graph.relationships)) {
    if (changedSet.has(filePath)) continue; // skip changed files

    const referencesChanged = rel.dependsOn.some((dep) => changedSet.has(dep)) ||
      rel.dependedOnBy.some((dep) => changedSet.has(dep));

    if (referencesChanged) {
      affectedUnchangedFiles.push(filePath);
    }
  }

  // ── Step 2: Rebuild dependedOnBy for changed files ───────────────────────
  // Clear dependedOnBy for changed files (will be rebuilt from dependsOn)
  for (const changedFile of changedFiles) {
    if (graph.relationships[changedFile]) {
      graph.relationships[changedFile].dependedOnBy = [];
    }
  }

  // Rebuild by scanning all dependsOn entries
  for (const [filePath, rel] of Object.entries(graph.relationships)) {
    for (const dep of rel.dependsOn) {
      if (changedSet.has(dep) && graph.relationships[dep]) {
        if (!graph.relationships[dep].dependedOnBy.includes(filePath)) {
          graph.relationships[dep].dependedOnBy.push(filePath);
        }
      }
    }
  }

  // ── Step 3: Validate dependsOn for affected unchanged files ──────────────
  // If an unchanged file depends on a changed file that no longer exports
  // certain symbols, we need to remove those stale references
  for (const filePath of affectedUnchangedFiles) {
    const rel = graph.relationships[filePath];
    if (!rel) continue;

    // Validate dependsOn: ensure the target file still exists in the graph
    rel.dependsOn = rel.dependsOn.filter((dep) => {
      // Package imports (no path separator) are always valid
      if (!dep.includes("/") && !dep.includes("\\")) return true;
      // File must still exist in the graph
      return graph.files[dep] !== undefined;
    });

    // Validate dependedOnBy: ensure the referencing file still exists
    rel.dependedOnBy = rel.dependedOnBy.filter((dep) => {
      return graph.files[dep] !== undefined;
    });
  }

  // ── Step 4: Patch calledBy in symbols ────────────────────────────────────
  // Rebuild calledBy for symbols in changed files
  for (const [symbolName, symbolData] of Object.entries(graph.symbols)) {
    if (changedSet.has(symbolData.file)) {
      // Clear calledBy — will be rebuilt
      symbolData.calledBy = [];
    }
  }

  // Scan all symbols to rebuild calledBy
  for (const [symbolName, symbolData] of Object.entries(graph.symbols)) {
    if (!symbolData.calls || !Array.isArray(symbolData.calls)) continue;
    for (const callTarget of symbolData.calls) {
      if (!callTarget || typeof callTarget !== "string") continue;
      const targetName = callTarget.includes(".")
        ? callTarget.split(".").pop()
        : callTarget;

      if (targetName && graph.symbols[targetName] && graph.symbols[targetName].calledBy) {
        if (!graph.symbols[targetName].calledBy.includes(symbolName)) {
          graph.symbols[targetName].calledBy.push(symbolName);
        }
      }
    }
  }

  // ── Step 5: Recompute centrality for affected files ──────────────────────
  const maxInbound = Math.max(
    1,
    ...Object.values(graph.relationships).map((r) => r.dependedOnBy.length)
  );

  for (const filePath of [...changedFiles, ...affectedUnchangedFiles]) {
    const fileData = graph.files[filePath];
    const rel = graph.relationships[filePath];
    if (fileData && rel) {
      fileData.centrality = Number((rel.dependedOnBy.length / maxInbound).toFixed(4));
    }
  }
}
