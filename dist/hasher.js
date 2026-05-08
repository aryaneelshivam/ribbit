"use strict";
// ─── Content Hasher ────────────────────────────────────────────────────────────
// Uses xxhash-wasm to compute fast content hashes for incremental re-run
// detection. Compares hashes against a previous graph to avoid re-parsing
// unchanged files.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashFile = hashFile;
exports.hashString = hashString;
exports.loadPreviousGraph = loadPreviousGraph;
exports.diffFiles = diffFiles;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const xxhash_wasm_1 = __importDefault(require("xxhash-wasm"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hasherInstance = null;
/**
 * Initialise the xxhash WASM module. Called once at startup.
 */
async function getHasher() {
    if (!hasherInstance) {
        hasherInstance = await (0, xxhash_wasm_1.default)();
    }
    return hasherInstance;
}
/**
 * Hash the contents of a single file.
 */
async function hashFile(filePath) {
    const hasher = await getHasher();
    const content = await fs.readFile(filePath, "utf-8");
    return String(hasher.h64(content));
}
/**
 * Hash a raw string.
 */
async function hashString(content) {
    const hasher = await getHasher();
    return String(hasher.h64(content));
}
/**
 * Load the previous graph from disk.
 *
 * @param outputDir  Path to the ribbit/ output folder
 * @returns          The previous RibbitGraph, or null if none exists / is corrupt
 */
async function loadPreviousGraph(outputDir) {
    const indexPath = path.join(outputDir, "index.json");
    try {
        const raw = await fs.readFile(indexPath, "utf-8");
        const parsed = JSON.parse(raw);
        // Basic validity check
        if (!parsed.meta || !parsed.files) {
            console.warn("Ribbit: previous graph is malformed, falling back to full re-parse");
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
/**
 * Compare discovered files against the previous graph to determine which
 * files have changed and need re-parsing.
 *
 * @param files          All discovered file paths (absolute)
 * @param root           Project root (for computing relative paths)
 * @param previousGraph  The previously generated graph (may be null)
 * @returns              Changed/unchanged file lists and a hash map
 */
async function diffFiles(files, root, previousGraph) {
    const hasher = await getHasher();
    const changedFiles = [];
    const unchangedFiles = [];
    const fileHashes = new Map();
    // Read and hash all files concurrently (batched to avoid fd exhaustion)
    const BATCH_SIZE = 256;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (filePath) => {
            const content = await fs.readFile(filePath, "utf-8");
            const hash = String(hasher.h64(content));
            return { filePath, hash };
        }));
        for (const { filePath, hash } of results) {
            const relativePath = path.relative(root, filePath);
            fileHashes.set(filePath, hash);
            if (!previousGraph) {
                changedFiles.push(filePath);
                continue;
            }
            const prevFile = previousGraph.files[relativePath];
            if (!prevFile || prevFile.hash !== hash) {
                changedFiles.push(filePath);
            }
            else {
                unchangedFiles.push(filePath);
            }
        }
    }
    return { changedFiles, unchangedFiles, fileHashes };
}
//# sourceMappingURL=hasher.js.map