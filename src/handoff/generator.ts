// ─── Handoff File Generator ────────────────────────────────────────────────────
// Generates ribbit.handoff.md — a human and agent readable summary of recent
// codebase activity. Combines git history, function-level diffs, and the
// structural graph to produce impact analysis and an agent context block.

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs/promises";
import { RibbitGraph, HandoffConfig } from "../types";

// ─── Git Data Types ────────────────────────────────────────────────────────────

interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  relativeDate: string;
  message: string;
}

interface FileChange {
  filePath: string;
  author: string;
  date: string;
  relativeDate: string;
  commitMessage: string;
  commitHash: string;
}

interface DiffChange {
  filePath: string;
  added: string[];
  removed: string[];
  modified: string[];
  addedImports: string[];
  removedImports: string[];
  addedExports: string[];
  removedExports: string[];
}

interface ImpactEntry {
  filePath: string;
  dependedOnBy: string[];
  centrality: number;
  isHighRisk: boolean;
}

interface BrokenEdge {
  removedSymbol: string;
  fromFile: string;
  stillCalledBy: string[];
}

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

function isSourceFile(filePath: string): boolean {
  return !EXCLUDED_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function isGitRepo(root: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: root, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function getRecentCommits(root: string, count: number): CommitInfo[] {
  try {
    const raw = execSync(
      `git log -n ${count} --format="%H|||%an|||%aI|||%ar|||%s"`,
      { cwd: root, stdio: "pipe", encoding: "utf-8" }
    );
    return raw
      .trim()
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [hash, author, date, relativeDate, message] = line.split("|||");
        return { hash, author, date, relativeDate, message };
      });
  } catch {
    return [];
  }
}

function getChangedFilesFromCommits(root: string, count: number): FileChange[] {
  try {
    // Get files changed in each commit with author/date info
    const raw = execSync(
      `git log -n ${count} --name-only --format="COMMIT:%H|||%an|||%aI|||%ar|||%s"`,
      { cwd: root, stdio: "pipe", encoding: "utf-8" }
    );

    const changes: FileChange[] = [];
    const seen = new Set<string>();
    let currentCommit: Omit<FileChange, "filePath"> | null = null;

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith("COMMIT:")) {
        const parts = trimmed.replace("COMMIT:", "").split("|||");
        currentCommit = {
          commitHash: parts[0],
          author: parts[1],
          date: parts[2],
          relativeDate: parts[3],
          commitMessage: parts[4],
        };
      } else if (currentCommit && trimmed.length > 0) {
        // Deduplicate — show only the most recent change per file
        // Filter out noise from node_modules, dist, etc.
        if (!seen.has(trimmed) && isSourceFile(trimmed)) {
          seen.add(trimmed);
          changes.push({ filePath: trimmed, ...currentCommit });
        }
      }
    }
    return changes;
  } catch {
    return [];
  }
}

/**
 * Get the diff for a specific commit to extract function-level changes.
 * Falls back gracefully if git diff fails.
 */
function getCommitDiff(root: string, commitHash: string): string {
  try {
    return execSync(`git diff ${commitHash}~1 ${commitHash} --unified=0`, {
      cwd: root,
      stdio: "pipe",
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
  } catch {
    return "";
  }
}

// ─── Diff Analysis ─────────────────────────────────────────────────────────────

/**
 * Analyse the raw diff output to extract function-level changes per file.
 * Detects added/removed/modified functions, import changes, and export changes.
 */
function analyseDiffs(root: string, commits: CommitInfo[]): Map<string, DiffChange> {
  const changeMap = new Map<string, DiffChange>();

  for (const commit of commits) {
    const rawDiff = getCommitDiff(root, commit.hash);
    if (!rawDiff) continue;

    let currentFile = "";

    for (const line of rawDiff.split("\n")) {
      // Track which file we're in
      if (line.startsWith("diff --git")) {
        const match = line.match(/b\/(.+)$/);
        if (match) currentFile = match[1];
        continue;
      }

      if (!currentFile || !isSourceFile(currentFile)) continue;

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
      const entry = changeMap.get(currentFile)!;

      // Detect function/class/const additions and removals
      const funcPatterns = [
        /^[+-]\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
        /^[+-]\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
        /^[+-]\s*(?:export\s+)?class\s+(\w+)/,
        /^[+-]\s*(?:export\s+)?interface\s+(\w+)/,
        /^[+-]\s*(?:export\s+)?type\s+(\w+)/,
        /^[+-]\s*(\w+)\s*\([^)]*\)\s*[:{]/,  // method declarations
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
              } else {
                entry.added.push(name);
              }
            }
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            if (!entry.removed.includes(name) && !entry.modified.includes(name)) {
              if (entry.added.includes(name)) {
                entry.added = entry.added.filter((a) => a !== name);
                entry.modified.push(name);
              } else {
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
          if (!entry.addedImports.includes(moduleName)) entry.addedImports.push(moduleName);
        } else {
          if (!entry.removedImports.includes(moduleName)) entry.removedImports.push(moduleName);
        }
      }

      // Python imports
      const pyImportMatch = line.match(/^([+-])\s*(?:from\s+(\S+)\s+)?import\s+(\S+)/);
      if (pyImportMatch && !importMatch) {
        const [, sign, fromModule, importName] = pyImportMatch;
        const name = fromModule || importName;
        if (sign === "+") {
          if (!entry.addedImports.includes(name)) entry.addedImports.push(name);
        } else {
          if (!entry.removedImports.includes(name)) entry.removedImports.push(name);
        }
      }

      // Detect export changes
      const exportMatch = line.match(/^([+-])\s*export\s+(?:default\s+)?(?:function|const|class|interface|type|let|var)\s+(\w+)/);
      if (exportMatch) {
        const [, sign, name] = exportMatch;
        if (sign === "+") {
          if (!entry.addedExports.includes(name)) entry.addedExports.push(name);
        } else {
          if (!entry.removedExports.includes(name)) entry.removedExports.push(name);
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
function computeImpact(
  changedFiles: string[],
  diffChanges: Map<string, DiffChange>,
  graph: RibbitGraph
): { impacts: ImpactEntry[]; brokenEdges: BrokenEdge[] } {
  const impacts: ImpactEntry[] = [];
  const brokenEdges: BrokenEdge[] = [];

  // Compute high-risk threshold (top 20% centrality)
  const allCentralities = Object.values(graph.files).map((f) => f.centrality);
  const sortedCentralities = [...allCentralities].sort((a, b) => b - a);
  const highRiskThreshold = sortedCentralities[Math.floor(sortedCentralities.length * 0.2)] ?? 0.5;

  for (const filePath of changedFiles) {
    const fileData = graph.files[filePath];
    const rel = graph.relationships?.[filePath];

    if (!fileData || !rel) continue;

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
        const callers: string[] = [];
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
                if (!callers.includes(otherFile)) callers.push(otherFile);
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

function generateMarkdown(
  commits: CommitInfo[],
  fileChanges: FileChange[],
  diffChanges: Map<string, DiffChange>,
  impacts: ImpactEntry[],
  brokenEdges: BrokenEdge[],
  config: HandoffConfig
): string {
  const now = new Date().toISOString();
  const lines: string[] = [];

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
      lines.push(
        `| ${change.filePath} | @${change.author.replace(/\s+/g, "")} | ${change.relativeDate} | ${change.commitMessage} (${shortHash}) |`
      );
    }
    lines.push("");
  } else {
    lines.push("No recent file changes detected.");
    lines.push("");
  }

  // ── What changed (diff analysis) ─────────────────────────────────────────
  if (config.includeDiffs && diffChanges.size > 0) {
    lines.push("## What changed");
    lines.push("");

    for (const [filePath, diff] of diffChanges) {
      const hasChanges =
        diff.added.length > 0 ||
        diff.removed.length > 0 ||
        diff.modified.length > 0 ||
        diff.addedImports.length > 0 ||
        diff.removedImports.length > 0 ||
        diff.addedExports.length > 0 ||
        diff.removedExports.length > 0;

      if (!hasChanges) continue;

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
        const broken = brokenEdges.find(
          (b) => b.removedSymbol === name && b.fromFile === filePath
        );
        if (broken) {
          const callers = broken.stillCalledBy.join(", ");
          lines.push(`- Removed: \`${name}\` ← still called by ${callers} ⚠️`);
        } else {
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
      if (impact.dependedOnBy.length === 0 && !impact.isHighRisk) continue;

      const depCount = impact.dependedOnBy.length;
      const riskTag = impact.isHighRisk ? " — changes here are **high risk**" : "";

      if (depCount > 0) {
        const fileRefs =
          depCount <= 5
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
        lines.push(
          `- \`${broken.removedSymbol}\` was removed from \`${broken.fromFile}\` but ${callers} still references it ⚠️`
        );
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
function buildAgentContext(
  commits: CommitInfo[],
  fileChanges: FileChange[],
  diffChanges: Map<string, DiffChange>,
  impacts: ImpactEntry[],
  brokenEdges: BrokenEdge[]
): string {
  const summaryParts: string[] = [];

  // Summarise commit activity
  if (commits.length > 0) {
    const uniqueAuthors = new Set(commits.map((c) => c.author));
    const authorStr =
      uniqueAuthors.size <= 3
        ? [...uniqueAuthors].join(", ")
        : `${uniqueAuthors.size} contributors`;
    summaryParts.push(
      `Last ${commits.length} commits by ${authorStr}, spanning from ${commits[commits.length - 1]?.relativeDate || "unknown"} to ${commits[0]?.relativeDate || "now"}.`
    );
  }

  // Summarise key changes
  const keyChanges: string[] = [];
  for (const [filePath, diff] of diffChanges) {
    const parts: string[] = [];
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
    summaryParts.push(
      `High-risk changes: ${highRisk.map((i) => `${i.filePath} (${i.dependedOnBy.length} dependents)`).join(", ")}.`
    );
  }

  // Broken edge warnings
  if (brokenEdges.length > 0) {
    summaryParts.push(
      `⚠️ Potential broken imports: ${brokenEdges.map((b) => `${b.removedSymbol} removed from ${b.fromFile} but still referenced by ${b.stillCalledBy.join(", ")}`).join("; ")}.`
    );
  }

  if (summaryParts.length === 0) {
    return "No significant changes detected in the recent commit history.";
  }

  return summaryParts.join("\n");
}

// ─── JSON Generation ───────────────────────────────────────────────────────────

function generateJSON(
  commits: CommitInfo[],
  fileChanges: FileChange[],
  diffChanges: Map<string, DiffChange>,
  impacts: ImpactEntry[],
  brokenEdges: BrokenEdge[]
): string {
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
    whatChanged: Object.fromEntries(
      [...diffChanges].map(([file, diff]) => [
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
      ])
    ),
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
export async function generateHandoff(
  graph: RibbitGraph,
  config: HandoffConfig,
  root: string,
  outputDir: string
): Promise<string | null> {
  if (!config.enabled) return null;

  // Check for git
  if (!isGitRepo(root)) {
    return null;
  }

  // Step 1: Get recent commits
  const commits = getRecentCommits(root, config.commits);
  if (commits.length === 0) return null;

  // Step 2: Get changed files
  const fileChanges = getChangedFilesFromCommits(root, config.commits);

  // Step 3: Analyse diffs (function-level)
  let diffChanges = new Map<string, DiffChange>();
  if (config.includeDiffs) {
    diffChanges = analyseDiffs(root, commits);
  }

  // Step 4: Impact analysis
  let impacts: ImpactEntry[] = [];
  let brokenEdges: BrokenEdge[] = [];
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

  let content: string;
  if (config.format === "json") {
    content = generateJSON(commits, fileChanges, diffChanges, impacts, brokenEdges);
  } else {
    content = generateMarkdown(commits, fileChanges, diffChanges, impacts, brokenEdges, config);
  }

  await fs.writeFile(outputPath, content, "utf-8");
  return outputPath;
}
