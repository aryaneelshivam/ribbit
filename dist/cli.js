#!/usr/bin/env node
"use strict";
// ─── Ribbit CLI ─────────────────────────────────────────────────────────────────
// Entry point for the `ribbit` command. Orchestrates the full pipeline:
// walker → hasher → workers → builder → differ → serializer
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const worker_threads_1 = require("worker_threads");
const walker_1 = require("./walker");
const hasher_1 = require("./hasher");
const builder_1 = require("./graph/builder");
const differ_1 = require("./graph/differ");
const serializer_1 = require("./graph/serializer");
const types_1 = require("./types");
const ui = __importStar(require("./ui"));
const VERSION = "1.1.2";
// ─── Config Loading ────────────────────────────────────────────────────────────
function loadConfig(configPath) {
    const root = process.cwd();
    const defaultPath = path.join(root, "ribbit.config.js");
    const resolvedPath = configPath ? path.resolve(configPath) : defaultPath;
    if (fs.existsSync(resolvedPath)) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const userConfig = require(resolvedPath);
            return { ...types_1.DEFAULT_CONFIG, ...userConfig };
        }
        catch (err) {
            ui.warn(`Failed to load config from ${resolvedPath}, using defaults`);
        }
    }
    // Copy default config to project on first run
    if (!configPath && !fs.existsSync(defaultPath)) {
        const defaultConfigContent = `module.exports = ${JSON.stringify(types_1.DEFAULT_CONFIG, null, 2)};\n`;
        try {
            fs.writeFileSync(defaultPath, defaultConfigContent, "utf-8");
        }
        catch {
            // Non-critical: can proceed without writing config
        }
    }
    return types_1.DEFAULT_CONFIG;
}
// ─── .gitignore Management ─────────────────────────────────────────────────────
function ensureGitignore(root, outputDir) {
    // We no longer automatically add to .gitignore because IDE agents 
    // like Cursor ignore files listed in .gitignore, making the graph invisible to them.
}
function spawnWorkers(files, root, numWorkers) {
    return new Promise((resolve, reject) => {
        if (files.length === 0) {
            resolve([]);
            return;
        }
        const workerPath = path.join(__dirname, "worker.js");
        // Check if the compiled worker exists
        if (!fs.existsSync(workerPath)) {
            ui.warn("worker.js not found, parsing in main thread");
            const { parseFile } = require("./parser/index");
            const results = [];
            for (const { filePath, hash } of files) {
                try {
                    results.push(parseFile(filePath, hash, root));
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    results.push({ filePath, hash, nodes: [], edges: [], error: msg });
                }
            }
            resolve(results);
            return;
        }
        const actualWorkers = Math.min(numWorkers, files.length);
        const chunkSize = Math.ceil(files.length / actualWorkers);
        const allResults = [];
        let completed = 0;
        for (let i = 0; i < actualWorkers; i++) {
            const chunk = files.slice(i * chunkSize, (i + 1) * chunkSize);
            if (chunk.length === 0) {
                completed++;
                if (completed === actualWorkers)
                    resolve(allResults);
                continue;
            }
            const worker = new worker_threads_1.Worker(workerPath, {
                workerData: { files: chunk, root },
            });
            worker.on("message", (result) => {
                allResults.push(...result.results);
                if (result.errors.length > 0) {
                    for (const err of result.errors) {
                        ui.warn(err);
                    }
                }
            });
            worker.on("error", (err) => {
                ui.warn(`Worker error: ${err.message}`);
            });
            worker.on("exit", (code) => {
                completed++;
                if (code !== 0 && code !== null) {
                    ui.warn(`Worker exited with code ${code}`);
                }
                if (completed === actualWorkers) {
                    resolve(allResults);
                }
            });
        }
    });
}
// ─── Main Pipeline ─────────────────────────────────────────────────────────────
async function run(options) {
    const startTime = process.hrtime();
    const root = process.cwd();
    // Show banner
    ui.printBanner(VERSION);
    // Load config
    const config = loadConfig(options.config);
    // Discover files
    ui.info("Scanning codebase...");
    const allFiles = await (0, walker_1.walkFiles)(root, config);
    if (allFiles.length === 0) {
        ui.warn("No source files found. Check your config languages and ignore patterns.");
        return;
    }
    ui.success(`Found ${ui.c.bold}${allFiles.length.toLocaleString()}${ui.c.reset}${ui.c.green} files`);
    // Load previous graph for incremental runs
    const outputDir = path.resolve(root, config.output);
    let previousGraph = options.full ? null : await (0, hasher_1.loadPreviousGraph)(outputDir);
    const incremental = !options.full && previousGraph !== null;
    // Diff against previous graph
    const { changedFiles, unchangedFiles, fileHashes } = await (0, hasher_1.diffFiles)(allFiles, root, previousGraph);
    if (incremental) {
        if (changedFiles.length === 0) {
            ui.success("No changes detected — graph is up to date");
            if (options.stats && previousGraph) {
                ui.printStatsOnly(previousGraph.meta);
            }
            return;
        }
        ui.info(`${ui.c.yellow}Incremental:${ui.c.reset} ${ui.c.bold}${changedFiles.length}${ui.c.reset} file${changedFiles.length === 1 ? "" : "s"} changed since last run`);
    }
    // Prepare file list with hashes for workers
    const filesWithHashes = changedFiles.map((fp) => ({
        filePath: fp,
        hash: fileHashes.get(fp) || "",
    }));
    // Spawn workers for parallel parsing
    const numCPUs = os.cpus().length;
    const numWorkers = Math.min(numCPUs, changedFiles.length);
    ui.info(`Parsing with ${ui.c.bold}${numWorkers}${ui.c.reset} worker${numWorkers === 1 ? "" : "s"}...`);
    const parseResults = await spawnWorkers(filesWithHashes, root, numWorkers);
    // Build the graph
    ui.info("Building graph...");
    const graph = (0, builder_1.buildGraph)(parseResults, unchangedFiles, previousGraph, root, fileHashes, VERSION, startTime, incremental);
    // Patch stale edges on incremental runs
    if (incremental) {
        const changedRelative = changedFiles.map((f) => path.relative(root, f));
        (0, differ_1.patchStaleEdges)(graph, changedRelative);
    }
    // Stats-only mode
    if (options.stats) {
        ui.printStatsOnly(graph.meta);
        return;
    }
    // Serialize to disk
    const outputPath = await (0, serializer_1.serializeGraph)(graph, config, root);
    const relOutput = path.relative(root, outputPath);
    // Ensure .gitignore has ribbit entries
    ensureGitignore(root, outputDir);
    // Print results panel
    ui.printStats({
        files: graph.meta.files,
        nodes: graph.meta.nodes,
        edges: graph.meta.edges,
        parseTime: graph.meta.parseTime,
        incremental,
        outputPath: relOutput,
    });
}
// ─── CLI Definition ────────────────────────────────────────────────────────────
const program = new commander_1.Command();
program
    .name("ribbit")
    .version(VERSION)
    .description("Generate an AI-readable knowledge graph of your codebase")
    .option("--full", "Force complete re-parse, ignoring previous graph")
    .option("--stats", "Print graph stats to console without writing files")
    .option("--config <path>", "Path to custom ribbit.config.js")
    .helpOption(false) // disable default help to use our custom one
    .option("--help", "Show help with all available commands")
    .action(async (options) => {
    if (options.help) {
        ui.printHelp(VERSION);
        return;
    }
    try {
        await run(options);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ui.error(message);
        process.exit(1);
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map