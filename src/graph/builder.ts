// ─── Graph Builder ─────────────────────────────────────────────────────────────
// Assembles the final RibbitGraph from parse results (changed files) and
// previous graph data (unchanged files). Resolves edges, builds inverted
// indexes (calledBy, dependedOnBy), and computes centrality scores.

import * as path from "path";
import * as fs from "fs";
import {
  RibbitGraph,
  RibbitNode,
  RibbitEdge,
  ParseResult,
  FileNode,
  SymbolNode,
  RelationshipNode,
} from "../types";

/**
 * Build the final RibbitGraph.
 *
 * @param parseResults     Results from parsing changed files
 * @param unchangedFiles   Unchanged file paths (absolute)
 * @param previousGraph    Previous graph to copy unchanged data from
 * @param root             Project root
 * @param fileHashes       Map of absolute file path → hash
 * @param version          Package version string
 * @param startTime        hrtime when the build started
 * @param incremental      Whether this was an incremental run
 */
export function buildGraph(
  parseResults: ParseResult[],
  unchangedFiles: string[],
  previousGraph: RibbitGraph | null,
  root: string,
  fileHashes: Map<string, string>,
  version: string,
  startTime: [number, number],
  incremental: boolean
): RibbitGraph {
  const allNodes: RibbitNode[] = [];
  const allEdges: RibbitEdge[] = [];
  const files: Record<string, FileNode> = {};
  const symbols: Record<string, SymbolNode> = {};
  const relationships: Record<string, RelationshipNode> = {};

  // ── Step 1: Collect nodes and edges from parse results ────────────────────
  for (const result of parseResults) {
    if (result.error && result.nodes.length === 0) continue;
    allNodes.push(...result.nodes);
    allEdges.push(...result.edges);
  }

  // ── Step 2: Carry forward unchanged files from previous graph ─────────────
  if (previousGraph) {
    for (const absPath of unchangedFiles) {
      const relativePath = path.relative(root, absPath);
      const prevFile = previousGraph.files[relativePath];
      if (prevFile) {
        files[relativePath] = { ...prevFile };
      }

      // Copy symbols belonging to this file
      for (const [symbolId, symbolData] of Object.entries(previousGraph.symbols)) {
        if (symbolData.file === relativePath) {
          symbols[symbolId] = { ...symbolData };
        }
      }
    }
  }

  // ── Step 3: Populate files and symbols from newly parsed nodes ────────────
  for (const node of allNodes) {
    if (node.type === "file") {
      let fileSize = 0;
      try {
        const absPath = path.resolve(root, node.file);
        const stat = fs.statSync(absPath);
        fileSize = stat.size;
        node.lastModified = Math.floor(stat.mtimeMs / 1000);
      } catch {
        // If stat fails, leave defaults
      }

      files[node.file] = {
        exports: node.exports,
        imports: node.imports,
        language: node.language,
        centrality: 0,
        hash: node.hash,
        lastModified: node.lastModified,
        size: fileSize,
      };
    } else {
      // Set lastModified from file stat
      try {
        const absPath = path.resolve(root, node.file);
        const stat = fs.statSync(absPath);
        node.lastModified = Math.floor(stat.mtimeMs / 1000);
      } catch {
        // leave as 0
      }

      symbols[node.name] = {
        file: node.file,
        type: node.type,
        calls: node.calls,
        calledBy: [],
        imports: node.imports,
        extends: node.extends,
        implements: node.implements,
      };
    }
  }

  // ── Step 4: Build inverted indexes ────────────────────────────────────────
  // calledBy: for each call target, record who calls it
  for (const [symbolName, symbolData] of Object.entries(symbols)) {
    if (!symbolData.calls || !Array.isArray(symbolData.calls)) continue;
    for (const callTarget of symbolData.calls) {
      if (!callTarget || typeof callTarget !== "string") continue;
      // Try to find the call target as a symbol
      const targetName = callTarget.includes(".")
        ? callTarget.split(".").pop()
        : callTarget;

      if (targetName && symbols[targetName] && symbols[targetName].calledBy) {
        if (!symbols[targetName].calledBy.includes(symbolName)) {
          symbols[targetName].calledBy.push(symbolName);
        }
      }
    }
  }

  // dependsOn / dependedOnBy: build from file imports
  for (const [filePath, fileData] of Object.entries(files)) {
    const dependsOn: string[] = [];
    const dependedOnBy: string[] = [];

    // dependsOn = files this file imports
    for (const imp of fileData.imports) {
      // Try to match import to a known file (with or without extension)
      const candidates = [imp, `${imp}.ts`, `${imp}.tsx`, `${imp}.js`, `${imp}.jsx`, `${imp}/index.ts`, `${imp}/index.js`];
      for (const candidate of candidates) {
        if (files[candidate]) {
          if (!dependsOn.includes(candidate)) dependsOn.push(candidate);
          break;
        }
      }
      // If no match, still record the raw import path
      if (!dependsOn.includes(imp) && !candidates.some((c) => dependsOn.includes(c))) {
        dependsOn.push(imp);
      }
    }

    relationships[filePath] = { dependsOn, dependedOnBy };
  }

  // Fill in dependedOnBy (inverse of dependsOn)
  for (const [filePath, rel] of Object.entries(relationships)) {
    for (const dep of rel.dependsOn) {
      if (relationships[dep]) {
        if (!relationships[dep].dependedOnBy.includes(filePath)) {
          relationships[dep].dependedOnBy.push(filePath);
        }
      }
    }
  }

  // ── Step 5: Compute centrality scores ─────────────────────────────────────
  const totalInboundEdges = Object.values(relationships).reduce(
    (sum, r) => sum + r.dependedOnBy.length,
    0
  );

  const maxInbound = Math.max(
    1,
    ...Object.values(relationships).map((r) => r.dependedOnBy.length)
  );

  for (const [filePath, fileData] of Object.entries(files)) {
    const rel = relationships[filePath];
    if (rel) {
      fileData.centrality = Number((rel.dependedOnBy.length / maxInbound).toFixed(4));
    }
  }

  // Symbol centrality based on calledBy count
  const maxCalledBy = Math.max(
    1,
    ...Object.values(symbols).map((s) => s.calledBy.length)
  );

  // ── Step 6: Compute timing ────────────────────────────────────────────────
  const elapsed = process.hrtime(startTime);
  const parseTime = Math.round(elapsed[0] * 1000 + elapsed[1] / 1e6);

  // ── Step 7: Assemble final graph ──────────────────────────────────────────
  const graph: RibbitGraph = {
    meta: {
      generated: new Date().toISOString(),
      version,
      files: Object.keys(files).length,
      nodes: Object.keys(files).length + Object.keys(symbols).length,
      edges: allEdges.length,
      parseTime,
      incremental,
    },
    files,
    symbols,
    relationships,
  };

  return graph;
}
