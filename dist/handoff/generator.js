"use strict";
// ─── Handoff File Generator ────────────────────────────────────────────────────
// Generates ribbit.handoff.md — a human and agent readable summary of recent
// codebase activity. Combines git history, function-level diffs, and the
// structural graph to produce impact analysis and an agent context block.
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
exports.generateHandoff = generateHandoff;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
// ─── Git Operations ────────────────────────────────────────────────────────────
/**
 * Paths to exclude from the handoff (noise from git log).
 */
const EXCLUDED_PATH_PREFIXES = [
    "node_modules/",
    "dist/",
    ".git/",
    "build/",
    "coverage/",
    ".next/",
    ".nuxt/",
    ".turbo/",
    ".vercel/",
    ".cache/",
    "package-lock.json",
];
function isSourceFile(filePath) {
    return !EXCLUDED_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}
function isGitRepo(root) {
    try {
        (0, child_process_1.execSync)("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "pipe" });
        return true;
    }
    catch {
        return false;
    }
}
function getRecentCommits(root, count) {
    try {
        const raw = (0, child_process_1.execSync)(`git log -n ${count} --format="%H|||%an|||%aI|||%ar|||%s"`, { cwd: root, stdio: "pipe", encoding: "utf-8" });
        return raw
            .trim()
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) => {
            const [hash, author, date, relativeDate, message] = line.split("|||");
            return { hash, author, date, relativeDate, message };
        });
    }
    catch {
        return [];
    }
}
function getChangedFilesFromCommits(root, count) {
    try {
        // Get files changed in each commit with author/date info
        const raw = (0, child_process_1.execSync)(`git log -n ${count} --name-only --format="COMMIT:%H|||%an|||%aI|||%ar|||%s"`, { cwd: root, stdio: "pipe", encoding: "utf-8" });
        const changes = [];
        const seen = new Set();
        let currentCommit = null;
        for (const line of raw.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            if (trimmed.startsWith("COMMIT:")) {
                const parts = trimmed.replace("COMMIT:", "").split("|||");
                currentCommit = {
                    commitHash: parts[0],
                    author: parts[1],
                    date: parts[2],
                    relativeDate: parts[3],
                    commitMessage: parts[4],
                };
            }
            else if (currentCommit && trimmed.length > 0) {
                // Deduplicate — show only the most recent change per file
                // Filter out noise from node_modules, dist, etc.
                if (!seen.has(trimmed) && isSourceFile(trimmed)) {
                    seen.add(trimmed);
                    changes.push({ filePath: trimmed, ...currentCommit });
                }
            }
        }
        return changes;
    }
    catch {
        return [];
    }
}
/**
 * Get the diff for a specific commit to extract function-level changes.
 * Falls back gracefully if git diff fails.
 */
function getCommitDiff(root, commitHash) {
    try {
        return (0, child_process_1.execSync)(`git diff ${commitHash}~1 ${commitHash} --unified=0`, {
            cwd: root,
            stdio: "pipe",
            encoding: "utf-8",
            maxBuffer: 10 * 1024 * 1024, // 10 MB
        });
    }
    catch {
        return "";
    }
}
// ─── Diff Analysis ─────────────────────────────────────────────────────────────
/**
 * Analyse the raw diff output to extract function-level changes per file.
 * Detects added/removed/modified functions, import changes, and export changes.
 */
function analyseDiffs(root, commits) {
    const changeMap = new Map();
    for (const commit of commits) {
        const rawDiff = getCommitDiff(root, commit.hash);
        if (!rawDiff)
            continue;
        let currentFile = "";
        for (const line of rawDiff.split("\n")) {
            // Track which file we're in
            if (line.startsWith("diff --git")) {
                const match = line.match(/b\/(.+)$/);
                if (match)
                    currentFile = match[1];
                continue;
            }
            if (!currentFile || !isSourceFile(currentFile))
                continue;
            // Ensure we have an entry for this file
            if (!changeMap.has(currentFile)) {
                changeMap.set(currentFile, {
                    filePath: currentFile,
                    added: [],
                    removed: [],
                    modified: [],
                    addedImports: [],
                    removedImports: [],
                    addedExports: [],
                    removedExports: [],
                });
            }
            const entry = changeMap.get(currentFile);
            // Detect function/class/const additions and removals
            const funcPatterns = [
                /^[+-]\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
                /^[+-]\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
                /^[+-]\s*(?:export\s+)?class\s+(\w+)/,
                /^[+-]\s*(?:export\s+)?interface\s+(\w+)/,
                /^[+-]\s*(?:export\s+)?type\s+(\w+)/,
                /^[+-]\s*(\w+)\s*\([^)]*\)\s*[:{]/, // method declarations
            ];
            for (const pattern of funcPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const name = match[1];
                    if (line.startsWith("+") && !line.startsWith("+++")) {
                        if (!entry.added.includes(name) && !entry.modified.includes(name)) {
                            // Check if it was also removed (= modification)
                            if (entry.removed.includes(name)) {
                                entry.removed = entry.removed.filter((r) => r !== name);
                                entry.modified.push(name);
                            }
                            else {
                                entry.added.push(name);
                            }
                        }
                    }
                    else if (line.startsWith("-") && !line.startsWith("---")) {
                        if (!entry.removed.includes(name) && !entry.modified.includes(name)) {
                            if (entry.added.includes(name)) {
                                entry.added = entry.added.filter((a) => a !== name);
                                entry.modified.push(name);
                            }
                            else {
                                entry.removed.push(name);
                            }
                        }
                    }
                    break;
                }
            }
            // Detect import changes
            const importMatch = line.match(/^([+-])\s*import\s+.+from\s+['"]([^'"]+)['"]/);
            if (importMatch) {
                const [, sign, moduleName] = importMatch;
                if (sign === "+") {
                    if (!entry.addedImports.includes(moduleName))
                        entry.addedImports.push(moduleName);
                }
                else {
                    if (!entry.removedImports.includes(moduleName))
                        entry.removedImports.push(moduleName);
                }
            }
            // Python imports
            const pyImportMatch = line.match(/^([+-])\s*(?:from\s+(\S+)\s+)?import\s+(\S+)/);
            if (pyImportMatch && !importMatch) {
                const [, sign, fromModule, importName] = pyImportMatch;
                const name = fromModule || importName;
                if (sign === "+") {
                    if (!entry.addedImports.includes(name))
                        entry.addedImports.push(name);
                }
                else {
                    if (!entry.removedImports.includes(name))
                        entry.removedImports.push(name);
                }
            }
            // Detect export changes
            const exportMatch = line.match(/^([+-])\s*export\s+(?:default\s+)?(?:function|const|class|interface|type|let|var)\s+(\w+)/);
            if (exportMatch) {
                const [, sign, name] = exportMatch;
                if (sign === "+") {
                    if (!entry.addedExports.includes(name))
                        entry.addedExports.push(name);
                }
                else {
                    if (!entry.removedExports.includes(name))
                        entry.removedExports.push(name);
                }
            }
        }
    }
    return changeMap;
}
// ─── Impact Analysis ───────────────────────────────────────────────────────────
/**
 * For every changed file, compute which files depend on it,
 * flag high-centrality changes, and detect broken edges.
 */
function computeImpact(changedFiles, diffChanges, graph) {
    const impacts = [];
    const brokenEdges = [];
    // Compute high-risk threshold (top 20% centrality)
    const allCentralities = Object.values(graph.files).map((f) => f.centrality);
    const sortedCentralities = [...allCentralities].sort((a, b) => b - a);
    const highRiskThreshold = sortedCentralities[Math.floor(sortedCentralities.length * 0.2)] ?? 0.5;
    for (const filePath of changedFiles) {
        const fileData = graph.files[filePath];
        const rel = graph.relationships?.[filePath];
        if (!fileData || !rel)
            continue;
        impacts.push({
            filePath,
            dependedOnBy: rel.dependedOnBy || [],
            centrality: fileData.centrality,
            isHighRisk: fileData.centrality >= highRiskThreshold && rel.dependedOnBy.length > 0,
        });
        // Check for broken edges: symbols removed but still referenced
        const diff = diffChanges.get(filePath);
        if (diff) {
            for (const removedSymbol of diff.removed) {
                // Check if any symbol in the graph still calls this removed symbol
                const callers = [];
                for (const [symName, symData] of Object.entries(graph.symbols)) {
                    if (symData.calls.includes(removedSymbol) && symData.file !== filePath) {
                        callers.push(symData.file);
                    }
                }
                // Check if any file still imports the removed export
                if (diff.removedExports.includes(removedSymbol)) {
                    for (const [otherFile, otherRel] of Object.entries(graph.relationships)) {
                        if (otherFile !== filePath && otherRel.dependsOn.includes(filePath)) {
                            // This file depends on the changed file — might use the removed export
                            const otherFileData = graph.files[otherFile];
                            if (otherFileData && otherFileData.imports.some((imp) => imp.includes(filePath.replace(/\.\w+$/, "")))) {
                                if (!callers.includes(otherFile))
                                    callers.push(otherFile);
                            }
                        }
                    }
                }
                if (callers.length > 0) {
                    brokenEdges.push({
                        removedSymbol,
                        fromFile: filePath,
                        stillCalledBy: [...new Set(callers)],
                    });
                }
            }
        }
    }
    return { impacts, brokenEdges };
}
// ─── Markdown Generation ───────────────────────────────────────────────────────
function generateMarkdown(commits, fileChanges, diffChanges, impacts, brokenEdges, config) {
    const now = new Date().toISOString();
    const lines = [];
    lines.push(`# Ribbit Handoff — ${now}`);
    lines.push("");
    // ── Recent activity ───────────────────────────────────────────────────────
    lines.push(`## Recent activity (last ${commits.length} commits)`);
    lines.push("");
    if (fileChanges.length > 0) {
        lines.push("| File | Changed by | When | Commit |");
        lines.push("|---|---|---|---|");
        for (const change of fileChanges) {
            const shortHash = change.commitHash.substring(0, 7);
            lines.push(`| ${change.filePath} | @${change.author.replace(/\s+/g, "")} | ${change.relativeDate} | ${change.commitMessage} (${shortHash}) |`);
        }
        lines.push("");
    }
    else {
        lines.push("No recent file changes detected.");
        lines.push("");
    }
    // ── What changed (diff analysis) ─────────────────────────────────────────
    if (config.includeDiffs && diffChanges.size > 0) {
        lines.push("## What changed");
        lines.push("");
        for (const [filePath, diff] of diffChanges) {
            const hasChanges = diff.added.length > 0 ||
                diff.removed.length > 0 ||
                diff.modified.length > 0 ||
                diff.addedImports.length > 0 ||
                diff.removedImports.length > 0 ||
                diff.addedExports.length > 0 ||
                diff.removedExports.length > 0;
            if (!hasChanges)
                continue;
            lines.push(`### ${filePath}`);
            for (const name of diff.modified) {
                lines.push(`- Modified: \`${name}\` (logic changed)`);
            }
            for (const name of diff.added) {
                // Check if this added symbol might cause broken edges
                lines.push(`- Added: \`${name}\``);
            }
            for (const name of diff.removed) {
                // Check for broken edge
                const broken = brokenEdges.find((b) => b.removedSymbol === name && b.fromFile === filePath);
                if (broken) {
                    const callers = broken.stillCalledBy.join(", ");
                    lines.push(`- Removed: \`${name}\` ← still called by ${callers} ⚠️`);
                }
                else {
                    lines.push(`- Removed: \`${name}\``);
                }
            }
            if (diff.addedImports.length > 0) {
                lines.push(`- New imports: ${diff.addedImports.map((i) => `\`${i}\``).join(", ")}`);
            }
            if (diff.removedImports.length > 0) {
                lines.push(`- Removed imports: ${diff.removedImports.map((i) => `\`${i}\``).join(", ")}`);
            }
            if (diff.addedExports.length > 0) {
                lines.push(`- New exports: ${diff.addedExports.map((e) => `\`${e}\``).join(", ")}`);
            }
            if (diff.removedExports.length > 0) {
                lines.push(`- Removed exports: ${diff.removedExports.map((e) => `\`${e}\``).join(", ")}`);
            }
            lines.push("");
        }
    }
    // ── Impact analysis ──────────────────────────────────────────────────────
    if (config.includeImpact && impacts.length > 0) {
        lines.push("## Impact");
        lines.push("");
        // Sort by centrality descending — most impactful first
        const sorted = [...impacts].sort((a, b) => b.centrality - a.centrality);
        for (const impact of sorted) {
            if (impact.dependedOnBy.length === 0 && !impact.isHighRisk)
                continue;
            const depCount = impact.dependedOnBy.length;
            const riskTag = impact.isHighRisk ? " — changes here are **high risk**" : "";
            if (depCount > 0) {
                const fileRefs = depCount <= 5
                    ? impact.dependedOnBy.map((f) => `\`${f}\``).join(", ")
                    : `${depCount} files`;
                lines.push(`- \`${impact.filePath}\` is depended on by ${fileRefs}${riskTag}`);
            }
        }
        // Broken edges
        if (brokenEdges.length > 0) {
            lines.push("");
            for (const broken of brokenEdges) {
                const callers = broken.stillCalledBy.map((c) => `\`${c}\``).join(", ");
                lines.push(`- \`${broken.removedSymbol}\` was removed from \`${broken.fromFile}\` but ${callers} still references it ⚠️`);
            }
        }
        lines.push("");
    }
    // ── Agent context ────────────────────────────────────────────────────────
    lines.push("## Agent context");
    lines.push("");
    const contextLines = buildAgentContext(commits, fileChanges, diffChanges, impacts, brokenEdges);
    lines.push(contextLines);
    lines.push("");
    return lines.join("\n");
}
/**
 * Build a plain-English agent context summary.
 */
function buildAgentContext(commits, fileChanges, diffChanges, impacts, brokenEdges) {
    const summaryParts = [];
    // Summarise commit activity
    if (commits.length > 0) {
        const uniqueAuthors = new Set(commits.map((c) => c.author));
        const authorStr = uniqueAuthors.size <= 3
            ? [...uniqueAuthors].join(", ")
            : `${uniqueAuthors.size} contributors`;
        summaryParts.push(`Last ${commits.length} commits by ${authorStr}, spanning from ${commits[commits.length - 1]?.relativeDate || "unknown"} to ${commits[0]?.relativeDate || "now"}.`);
    }
    // Summarise key changes
    const keyChanges = [];
    for (const [filePath, diff] of diffChanges) {
        const parts = [];
        if (diff.modified.length > 0) {
            parts.push(`${diff.modified.join(", ")} modified`);
        }
        if (diff.added.length > 0) {
            parts.push(`${diff.added.join(", ")} added`);
        }
        if (diff.removed.length > 0) {
            parts.push(`${diff.removed.join(", ")} removed`);
        }
        if (parts.length > 0) {
            keyChanges.push(`${filePath}: ${parts.join("; ")}`);
        }
    }
    if (keyChanges.length > 0) {
        // Limit to top 10 most notable changes
        const notable = keyChanges.slice(0, 10);
        summaryParts.push(notable.join(". ") + ".");
    }
    // High-risk warnings
    const highRisk = impacts.filter((i) => i.isHighRisk);
    if (highRisk.length > 0) {
        summaryParts.push(`High-risk changes: ${highRisk.map((i) => `${i.filePath} (${i.dependedOnBy.length} dependents)`).join(", ")}.`);
    }
    // Broken edge warnings
    if (brokenEdges.length > 0) {
        summaryParts.push(`⚠️ Potential broken imports: ${brokenEdges.map((b) => `${b.removedSymbol} removed from ${b.fromFile} but still referenced by ${b.stillCalledBy.join(", ")}`).join("; ")}.`);
    }
    if (summaryParts.length === 0) {
        return "No significant changes detected in the recent commit history.";
    }
    return summaryParts.join("\n");
}
// ─── JSON Generation ───────────────────────────────────────────────────────────
function generateJSON(commits, fileChanges, diffChanges, impacts, brokenEdges) {
    const data = {
        generated: new Date().toISOString(),
        recentActivity: {
            commits: commits.map((c) => ({
                hash: c.hash,
                author: c.author,
                date: c.date,
                message: c.message,
            })),
            changedFiles: fileChanges.map((f) => ({
                file: f.filePath,
                author: f.author,
                date: f.date,
                commit: f.commitMessage,
            })),
        },
        whatChanged: Object.fromEntries([...diffChanges].map(([file, diff]) => [
            file,
            {
                added: diff.added,
                removed: diff.removed,
                modified: diff.modified,
                addedImports: diff.addedImports,
                removedImports: diff.removedImports,
                addedExports: diff.addedExports,
                removedExports: diff.removedExports,
            },
        ])),
        impact: impacts
            .filter((i) => i.dependedOnBy.length > 0)
            .map((i) => ({
            file: i.filePath,
            dependedOnBy: i.dependedOnBy,
            centrality: i.centrality,
            highRisk: i.isHighRisk,
        })),
        brokenEdges: brokenEdges.map((b) => ({
            symbol: b.removedSymbol,
            from: b.fromFile,
            stillReferencedBy: b.stillCalledBy,
        })),
    };
    return JSON.stringify(data, null, 2);
}
// ─── Main Export ───────────────────────────────────────────────────────────────
/**
 * Generate the handoff file (ribbit.handoff.md or ribbit.handoff.json).
 *
 * @param graph   The current RibbitGraph (used for impact analysis)
 * @param config  Handoff configuration
 * @param root    Project root directory
 * @param outputDir  Path to the ribbit/ output folder
 * @returns       Path to the generated handoff file, or null if disabled / no git
 */
async function generateHandoff(graph, config, root, outputDir) {
    if (!config.enabled)
        return null;
    // Check for git
    if (!isGitRepo(root)) {
        return null;
    }
    // Step 1: Get recent commits
    const commits = getRecentCommits(root, config.commits);
    if (commits.length === 0)
        return null;
    // Step 2: Get changed files
    const fileChanges = getChangedFilesFromCommits(root, config.commits);
    // Step 3: Analyse diffs (function-level)
    let diffChanges = new Map();
    if (config.includeDiffs) {
        diffChanges = analyseDiffs(root, commits);
    }
    // Step 4: Impact analysis
    let impacts = [];
    let brokenEdges = [];
    if (config.includeImpact) {
        const changedFilePaths = fileChanges.map((f) => f.filePath);
        const result = computeImpact(changedFilePaths, diffChanges, graph);
        impacts = result.impacts;
        brokenEdges = result.brokenEdges;
    }
    // Step 5: Generate output
    const ext = config.format === "json" ? "json" : "md";
    const fileName = `handoff.${ext}`;
    const outputPath = path.join(outputDir, fileName);
    let content;
    if (config.format === "json") {
        content = generateJSON(commits, fileChanges, diffChanges, impacts, brokenEdges);
    }
    else {
        content = generateMarkdown(commits, fileChanges, diffChanges, impacts, brokenEdges, config);
    }
    await fs.writeFile(outputPath, content, "utf-8");
    return outputPath;
}
//# sourceMappingURL=generator.js.map