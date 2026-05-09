export type NodeType = "file" | "function" | "class" | "type" | "constant" | "interface";
export type EdgeType = "imports" | "calls" | "extends" | "implements" | "exports";
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
export interface ChunkedIndex {
    meta: RibbitGraph["meta"];
    mode: "chunked";
    modules: string[];
    files: Record<string, {
        module: string;
        exports: string[];
        centrality: number;
    }>;
}
export interface ModuleChunk {
    module: string;
    files: Record<string, FileNode>;
    symbols: Record<string, SymbolNode>;
    internalEdges: RibbitEdge[];
    externalRefs: {
        from: string;
        to: string;
        type: EdgeType;
    }[];
}
export interface RelationshipsChunk {
    crossModuleEdges: RibbitEdge[];
    byModule: Record<string, {
        incoming: RibbitEdge[];
        outgoing: RibbitEdge[];
    }>;
}
export interface HandoffConfig {
    /** Whether to generate the handoff file */
    enabled: boolean;
    /** How many commits to look back */
    commits: number;
    /** Include function-level diff analysis */
    includeDiffs: boolean;
    /** Include dependency impact analysis from the graph */
    includeImpact: boolean;
    /** Output format */
    format: "markdown" | "json";
}
export interface RibbitConfig {
    ignore: string[];
    languages: string[];
    output: string;
    /** Number of files before switching to chunked output */
    chunkThreshold: number;
    includeTests: boolean;
    includeDotFiles: boolean;
    /** Handoff file generation config */
    handoff: HandoffConfig;
}
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
export declare const LANGUAGE_EXTENSIONS: Record<string, string[]>;
export declare const DEFAULT_IGNORE: string[];
export declare const DEFAULT_HANDOFF_CONFIG: HandoffConfig;
export declare const DEFAULT_CONFIG: RibbitConfig;
