import { RibbitGraph } from "./types";
/**
 * Hash the contents of a single file.
 */
export declare function hashFile(filePath: string): Promise<string>;
/**
 * Hash a raw string.
 */
export declare function hashString(content: string): Promise<string>;
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
export declare function loadPreviousGraph(outputDir: string): Promise<RibbitGraph | null>;
/**
 * Compare discovered files against the previous graph to determine which
 * files have changed and need re-parsing.
 *
 * @param files          All discovered file paths (absolute)
 * @param root           Project root (for computing relative paths)
 * @param previousGraph  The previously generated graph (may be null)
 * @returns              Changed/unchanged file lists and a hash map
 */
export declare function diffFiles(files: string[], root: string, previousGraph: RibbitGraph | null): Promise<HashDiffResult>;
