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
export declare function patchStaleEdges(graph: RibbitGraph, changedFiles: string[]): void;
