"use strict";
// ─── Core Types ────────────────────────────────────────────────────────────────
// Every type used throughout the Ribbit codebase is defined here as the single
// source of truth. This file has zero runtime imports — it is types-only.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.DEFAULT_HANDOFF_CONFIG = exports.DEFAULT_IGNORE = exports.LANGUAGE_EXTENSIONS = void 0;
// ─── Language Extension Map ────────────────────────────────────────────────────
exports.LANGUAGE_EXTENSIONS = {
    typescript: [".ts", ".tsx"],
    javascript: [".js", ".jsx", ".mjs", ".cjs"],
    python: [".py"],
};
// ─── Defaults ──────────────────────────────────────────────────────────────────
exports.DEFAULT_IGNORE = [
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    "out",
    ".turbo",
    ".vercel",
    ".cache",
];
exports.DEFAULT_HANDOFF_CONFIG = {
    enabled: true,
    commits: 10,
    includeDiffs: true,
    includeImpact: true,
    format: "markdown",
};
exports.DEFAULT_CONFIG = {
    ignore: [
        "**/*.test.ts",
        "**/*.test.js",
        "**/*.spec.ts",
        "**/*.spec.js",
        "**/__tests__/**",
        "**/dist/**",
        "**/coverage/**",
        "**/.next/**",
        "**/build/**",
    ],
    languages: ["typescript", "javascript"],
    output: "ribbit/",
    chunkThreshold: 200,
    includeTests: false,
    includeDotFiles: false,
    handoff: exports.DEFAULT_HANDOFF_CONFIG,
};
//# sourceMappingURL=types.js.map