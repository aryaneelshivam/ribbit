import { RibbitGraph, ParseResult } from "../types";
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
export declare function buildGraph(parseResults: ParseResult[], unchangedFiles: string[], previousGraph: RibbitGraph | null, root: string, fileHashes: Map<string, string>, version: string, startTime: [number, number], incremental: boolean): RibbitGraph;
