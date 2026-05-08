// ─── Core Types ────────────────────────────────────────────────────────────────
// Every type used throughout the Ribbit codebase is defined here as the single
// source of truth. This file has zero runtime imports — it is types-only.

export type NodeType = "file" | "function" | "class" | "type" | "constant" | "interface";

export type EdgeType = "imports" | "calls" | "extends" | "implements" | "exports";

// ─── Graph Nodes & Edges ───────────────────────────────────────────────────────


//adding a comment to test ribbit rerrun.
//adding one more comment to test ribbit rerrun.
// another one to trigger an incremental UI test
// testing git rebase with branching. 
export interface RibbitNode {
  /** Unique identifier: "src/auth/middleware.ts:authMiddleware" */
  id: string;
  type: NodeType;
  name: string;
  file: string;
  language: string;
  /** xxhash of file content */
  hash: string;
  exports: string[];
  /** Resolved to actual file paths where possible */
  imports: string[];
  calls: string[];
  calledBy: string[];
  extends?: string;
  implements?: string[];
  /** 0–1, computed from how many nodes reference this */
  centrality: number;
  /** Unix timestamp */
  lastModified: number;
}

export interface RibbitEdge {
  from: string;
  to: string;
  type: EdgeType;
}

// ─── Output Graph ──────────────────────────────────────────────────────────────

export interface RibbitGraph {
  meta: {
    generated: string;
    version: string;
    files: number;
    nodes: number;
    edges: number;
    parseTime: number;
    incremental: boolean;
  };
  files: Record<string, FileNode>;
  symbols: Record<string, SymbolNode>;
  relationships: Record<string, RelationshipNode>;
}

export interface FileNode {
  exports: string[];
  imports: string[];
  language: string;
  centrality: number;
  hash: string;
  lastModified: number;
  /** File size in bytes */
  size: number;
}

export interface SymbolNode {
  file: string;
  type: NodeType;
  calls: string[];
  calledBy: string[];
  imports: string[];
  extends?: string;
  implements?: string[];
}

export interface RelationshipNode {
  dependsOn: string[];
  dependedOnBy: string[];
}

// ─── Chunked Output (large codebases) ──────────────────────────────────────────

export interface ChunkedIndex {
  meta: RibbitGraph["meta"];
  mode: "chunked";
  modules: string[];
  files: Record<string, { module: string; exports: string[]; centrality: number }>;
}

export interface ModuleChunk {
  module: string;
  files: Record<string, FileNode>;
  symbols: Record<string, SymbolNode>;
  internalEdges: RibbitEdge[];
  externalRefs: { from: string; to: string; type: EdgeType }[];
}

export interface RelationshipsChunk {
  crossModuleEdges: RibbitEdge[];
  byModule: Record<string, { incoming: RibbitEdge[]; outgoing: RibbitEdge[] }>;
}

// ─── Config ────────────────────────────────────────────────────────────────────

export interface RibbitConfig {
  ignore: string[];
  languages: string[];
  output: string;
  /** Number of files before switching to chunked output */
  chunkThreshold: number;
  includeTests: boolean;
  includeDotFiles: boolean;
}

// ─── Parse Pipeline ────────────────────────────────────────────────────────────

export interface ParseResult {
  filePath: string;
  hash: string;
  nodes: RibbitNode[];
  edges: RibbitEdge[];
  error?: string;
}

export interface WorkerMessage {
  files: string[];
  configPath?: string;
}

export interface WorkerResult {
  results: ParseResult[];
  errors: string[];
}

// ─── Language Extension Map ────────────────────────────────────────────────────

export const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx", ".mjs", ".cjs"],
  python: [".py"],
};

// ─── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  "out",
  ".turbo",
  ".vercel",
  ".cache",
];

export const DEFAULT_CONFIG: RibbitConfig = {
  ignore: [
    "**/*.test.ts",
    "**/*.test.js",
    "**/*.spec.ts",
    "**/*.spec.js",
    "**/__tests__/**",
    "**/dist/**",
    "**/coverage/**",
    "**/.next/**",
    "**/build/**",
  ],
  languages: ["typescript", "javascript"],
  output: "ribbit/",
  chunkThreshold: 200,
  includeTests: false,
  includeDotFiles: false,
};
