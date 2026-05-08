import { ParseResult } from "../types";
/**
 * Parse a single source file, routing to the appropriate language parser.
 *
 * @param filePath  Absolute path to the file
 * @param hash      Pre-computed xxhash of the file contents
 * @param root      Project root (for computing relative paths)
 * @returns         A ParseResult with extracted nodes and edges, or an error
 */
export declare function parseFile(filePath: string, hash: string, root: string): ParseResult;
/**
 * Parse multiple files sequentially. Used by worker threads.
 */
export declare function parseFiles(files: Array<{
    filePath: string;
    hash: string;
}>, root: string): ParseResult[];
