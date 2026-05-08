export declare const c: {
    reset: string;
    bold: string;
    dim: string;
    italic: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    gray: string;
    brightCyan: string;
    brightBlue: string;
    brightMagenta: string;
    brightGreen: string;
    brightYellow: string;
    brightRed: string;
};
export declare function printBanner(version: string): void;
export declare function info(msg: string): void;
export declare function success(msg: string): void;
export declare function warn(msg: string): void;
export declare function error(msg: string): void;
export declare function dimInfo(msg: string): void;
interface StatsData {
    files: number;
    nodes: number;
    edges: number;
    parseTime: number;
    incremental: boolean;
    outputPath: string;
}
export declare function printStats(stats: StatsData): void;
export declare function printStatsOnly(meta: {
    files: number;
    nodes: number;
    edges: number;
    parseTime: number;
    incremental: boolean;
}): void;
export declare function printHelp(version: string): void;
export {};
