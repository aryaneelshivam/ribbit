import { RibbitConfig } from "./types";
/**
 * Walk the project directory and return all files to be parsed.
 *
 * @param root    Absolute path to the project root
 * @param config  Ribbit configuration
 * @returns       Sorted array of absolute file paths
 */
export declare function walkFiles(root: string, config: RibbitConfig): Promise<string[]>;
