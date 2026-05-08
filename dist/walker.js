"use strict";
// ─── File Walker ───────────────────────────────────────────────────────────────
// Discovers all source files eligible for parsing. Respects .gitignore,
// configured ignore patterns, language filters, and sorts by directory depth
// so entry points and index files are prioritised.
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
exports.walkFiles = walkFiles;
const fast_glob_1 = __importDefault(require("fast-glob"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("./types");
/**
 * Parse a .gitignore file into glob patterns that fast-glob understands.
 */
function parseGitignore(root) {
    const gitignorePath = path.join(root, ".gitignore");
    if (!fs.existsSync(gitignorePath))
        return [];
    const content = fs.readFileSync(gitignorePath, "utf-8");
    const patterns = [];
    for (const raw of content.split("\n")) {
        const line = raw.trim();
        // Skip comments and blank lines
        if (!line || line.startsWith("#"))
            continue;
        // Normalise: ensure patterns work as globs
        if (line.startsWith("/")) {
            patterns.push(line.slice(1));
        }
        else {
            patterns.push(`**/${line}`);
        }
    }
    return patterns;
}
/**
 * Build the list of file-extension globs for the configured languages.
 */
function buildExtensionGlobs(languages) {
    const exts = [];
    for (const lang of languages) {
        const langExts = types_1.LANGUAGE_EXTENSIONS[lang];
        if (langExts) {
            for (const ext of langExts) {
                exts.push(`**/*${ext}`);
            }
        }
    }
    return exts;
}
/**
 * Walk the project directory and return all files to be parsed.
 *
 * @param root    Absolute path to the project root
 * @param config  Ribbit configuration
 * @returns       Sorted array of absolute file paths
 */
async function walkFiles(root, config) {
    const extensionGlobs = buildExtensionGlobs(config.languages);
    if (extensionGlobs.length === 0)
        return [];
    // Merge ignore sources: built-in defaults + config ignores + .gitignore
    const ignorePatterns = [
        ...types_1.DEFAULT_IGNORE.map((d) => `**/${d}/**`),
        ...config.ignore,
        ...parseGitignore(root),
    ];
    // Exclude dot-files unless explicitly included
    if (!config.includeDotFiles) {
        ignorePatterns.push("**/.*/**");
    }
    const files = await (0, fast_glob_1.default)(extensionGlobs, {
        cwd: root,
        absolute: true,
        ignore: ignorePatterns,
        dot: config.includeDotFiles,
        onlyFiles: true,
        followSymbolicLinks: false,
    });
    // Sort by directory depth (shallowest first) so entry points are parsed early
    files.sort((a, b) => {
        const depthA = a.split(path.sep).length;
        const depthB = b.split(path.sep).length;
        if (depthA !== depthB)
            return depthA - depthB;
        return a.localeCompare(b);
    });
    return files;
}
//# sourceMappingURL=walker.js.map