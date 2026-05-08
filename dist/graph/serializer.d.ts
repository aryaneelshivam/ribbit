import { RibbitGraph, RibbitConfig } from "../types";
/**
 * Serialize and write the graph to disk.
 *
 * @param graph    The final RibbitGraph
 * @param config   Ribbit configuration
 * @param root     Project root directory
 * @returns        Path to the main output file
 */
export declare function serializeGraph(graph: RibbitGraph, config: RibbitConfig, root: string): Promise<string>;
