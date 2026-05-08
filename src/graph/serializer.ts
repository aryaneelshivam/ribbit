// ─── Serializer ────────────────────────────────────────────────────────────────
// Writes the final RibbitGraph to disk. Automatically switches between
// single-file and chunked output based on the number of files in the graph.

import * as fs from "fs/promises";
import * as path from "path";
import {
  RibbitGraph,
  RibbitConfig,
  RibbitEdge,
  ChunkedIndex,
  ModuleChunk,
  RelationshipsChunk,
} from "../types";

/**
 * Determine the module name for a file based on its top-level directory.
 *
 * src/auth/middleware.ts → "auth"
 * src/payments/stripe.ts → "payments"
 * utils.ts               → "root"
 */
function getModuleName(filePath: string): string {
  const parts = filePath.split("/");
  // If the file is under src/ (or similar), use the next directory
  if (parts.length >= 3 && (parts[0] === "src" || parts[0] === "lib" || parts[0] === "app")) {
    return parts[1];
  }
  // If there's at least one directory, use it
  if (parts.length >= 2) {
    return parts[0];
  }
  // Root-level files
  return "root";
}

/**
 * Write the graph as a single index.json file.
 */
async function writeSingleFile(graph: RibbitGraph, outputDir: string): Promise<string> {
  const outputPath = path.join(outputDir, "index.json");
  const json = JSON.stringify(graph, null, 2);
  await fs.writeFile(outputPath, json, "utf-8");
  return outputPath;
}

/**
 * Write the graph in chunked mode for large codebases.
 */
async function writeChunked(graph: RibbitGraph, outputDir: string): Promise<string> {
  const modulesDir = path.join(outputDir, "modules");
  await fs.mkdir(modulesDir, { recursive: true });

  // Group files by module
  const moduleFiles: Record<string, string[]> = {};
  for (const filePath of Object.keys(graph.files)) {
    const mod = getModuleName(filePath);
    if (!moduleFiles[mod]) moduleFiles[mod] = [];
    moduleFiles[mod].push(filePath);
  }

  const moduleNames = Object.keys(moduleFiles).sort();

  // ── Write module chunks ──────────────────────────────────────────────────
  const allEdges: RibbitEdge[] = [];
  const crossModuleEdges: RibbitEdge[] = [];
  const byModule: Record<string, { incoming: RibbitEdge[]; outgoing: RibbitEdge[] }> = {};

  // Collect edges from relationships
  for (const [filePath, rel] of Object.entries(graph.relationships)) {
    const srcMod = getModuleName(filePath);
    for (const dep of rel.dependsOn) {
      const edge: RibbitEdge = { from: filePath, to: dep, type: "imports" };
      allEdges.push(edge);

      const depMod = getModuleName(dep);
      if (srcMod !== depMod) {
        crossModuleEdges.push(edge);
        if (!byModule[srcMod]) byModule[srcMod] = { incoming: [], outgoing: [] };
        if (!byModule[depMod]) byModule[depMod] = { incoming: [], outgoing: [] };
        byModule[srcMod].outgoing.push(edge);
        byModule[depMod].incoming.push(edge);
      }
    }
  }

  for (const mod of moduleNames) {
    const modFileList = moduleFiles[mod];
    const chunk: ModuleChunk = {
      module: mod,
      files: {},
      symbols: {},
      internalEdges: [],
      externalRefs: [],
    };

    // Add file data
    for (const filePath of modFileList) {
      chunk.files[filePath] = graph.files[filePath];
    }

    // Add symbols belonging to this module
    for (const [symbolName, symbolData] of Object.entries(graph.symbols)) {
      const symbolMod = getModuleName(symbolData.file);
      if (symbolMod === mod) {
        chunk.symbols[symbolName] = symbolData;
      }
    }

    // Split edges into internal and external
    for (const edge of allEdges) {
      const fromMod = getModuleName(edge.from);
      const toMod = getModuleName(edge.to);
      if (fromMod === mod && toMod === mod) {
        chunk.internalEdges.push(edge);
      } else if (fromMod === mod || toMod === mod) {
        chunk.externalRefs.push({ from: edge.from, to: edge.to, type: edge.type });
      }
    }

    const chunkPath = path.join(modulesDir, `${mod}.json`);
    await fs.writeFile(chunkPath, JSON.stringify(chunk, null, 2), "utf-8");
  }

  // ── Write relationships.json ─────────────────────────────────────────────
  const relChunk: RelationshipsChunk = { crossModuleEdges, byModule };
  await fs.writeFile(
    path.join(outputDir, "relationships.json"),
    JSON.stringify(relChunk, null, 2),
    "utf-8"
  );

  // ── Write chunked index.json ─────────────────────────────────────────────
  const chunkedIndex: ChunkedIndex = {
    meta: graph.meta,
    mode: "chunked",
    modules: moduleNames,
    files: {},
  };

  for (const [filePath, fileData] of Object.entries(graph.files)) {
    chunkedIndex.files[filePath] = {
      module: getModuleName(filePath),
      exports: fileData.exports,
      centrality: fileData.centrality,
    };
  }

  const indexPath = path.join(outputDir, "index.json");
  await fs.writeFile(indexPath, JSON.stringify(chunkedIndex, null, 2), "utf-8");
  return indexPath;
}

/**
 * Serialize and write the graph to disk.
 *
 * @param graph    The final RibbitGraph
 * @param config   Ribbit configuration
 * @param root     Project root directory
 * @returns        Path to the main output file
 */
export async function serializeGraph(
  graph: RibbitGraph,
  config: RibbitConfig,
  root: string
): Promise<string> {
  const outputDir = path.resolve(root, config.output);
  await fs.mkdir(outputDir, { recursive: true });

  const fileCount = graph.meta.files;
  const threshold = config.chunkThreshold ?? 200;

  if (fileCount >= threshold) {
    return writeChunked(graph, outputDir);
  } else {
    return writeSingleFile(graph, outputDir);
  }
}
