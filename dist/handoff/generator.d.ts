import { RibbitGraph, HandoffConfig } from "../types";
/**
 * Generate the handoff file (ribbit.handoff.md or ribbit.handoff.json).
 *
 * @param graph   The current RibbitGraph (used for impact analysis)
 * @param config  Handoff configuration
 * @param root    Project root directory
 * @param outputDir  Path to the ribbit/ output folder
 * @returns       Path to the generated handoff file, or null if disabled / no git
 */
export declare function generateHandoff(graph: RibbitGraph, config: HandoffConfig, root: string, outputDir: string): Promise<string | null>;
