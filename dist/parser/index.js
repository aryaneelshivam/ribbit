"use strict";
// ─── Parser Router ─────────────────────────────────────────────────────────────
// Routes each file to the correct language parser based on its extension.
// This module is the single entry point used by workers.
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
exports.parseFile = parseFile;
exports.parseFiles = parseFiles;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const typescript_1 = require("./typescript");
const javascript_1 = require("./javascript");
const python_1 = require("./python");
const EXTENSION_TO_PARSER = {
    ".ts": typescript_1.parseTypeScriptFile,
    ".tsx": typescript_1.parseTypeScriptFile,
    ".js": javascript_1.parseJavaScriptFile,
    ".jsx": javascript_1.parseJavaScriptFile,
    ".mjs": javascript_1.parseJavaScriptFile,
    ".cjs": javascript_1.parseJavaScriptFile,
    ".py": python_1.parsePythonFile,
};
/**
 * Parse a single source file, routing to the appropriate language parser.
 *
 * @param filePath  Absolute path to the file
 * @param hash      Pre-computed xxhash of the file contents
 * @param root      Project root (for computing relative paths)
 * @returns         A ParseResult with extracted nodes and edges, or an error
 */
function parseFile(filePath, hash, root) {
    const ext = path.extname(filePath).toLowerCase();
    const parser = EXTENSION_TO_PARSER[ext];
    if (!parser) {
        return {
            filePath,
            hash,
            nodes: [],
            edges: [],
            error: `Unsupported file extension: ${ext}`,
        };
    }
    try {
        const source = fs.readFileSync(filePath, "utf-8");
        return parser(source, filePath, hash, root);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            filePath,
            hash,
            nodes: [],
            edges: [],
            error: `Parse error: ${message}`,
        };
    }
}
/**
 * Parse multiple files sequentially. Used by worker threads.
 */
function parseFiles(files, root) {
    const results = [];
    for (const { filePath, hash } of files) {
        results.push(parseFile(filePath, hash, root));
    }
    return results;
}
//# sourceMappingURL=index.js.map