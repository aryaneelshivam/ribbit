# Ribbit Handoff — 2026-05-09T06:33:13.295Z

## Recent activity (last 7 commits)

| File | Changed by | When | Commit |
|---|---|---|---|
| README.md | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| ribbit.config.js | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| ribbit/handoff.md | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| src/cli.ts | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| src/handoff/generator.ts | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| src/types.ts | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| src/ui.ts | @aryaneelshivam | 2 minutes ago | handoff file generator feature update (4dec88a) |
| package.json | @aryaneelshivam | 17 hours ago | 1.1.4 changes (3eb39e8) |
| .gitignore | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| .npmignore | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| LICENSE | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| grasp.config.js | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/declarations.d.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/graph/builder.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/graph/differ.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/graph/serializer.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/hasher.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/parser/index.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/parser/javascript.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/parser/python.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/parser/typescript.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/walker.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| src/worker.ts | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |
| tsconfig.json | @aryaneelshivam | 18 hours ago | ribbit init (9fdd79c) |

## What changed

### src/cli.ts
- Modified: `VERSION` (logic changed)
- Added: `mergedHandoff`
- Added: `if`
- Added: `handoffPath`
- Removed: `gitignorePath`
- Removed: `relOutput`
- Removed: `entries`
- Removed: `content`
- New imports: `./handoff/generator`, `./types`
- Removed imports: `./types`

### src/handoff/generator.ts
- Added: `CommitInfo`
- Added: `FileChange`
- Added: `DiffChange`
- Added: `ImpactEntry`
- Added: `BrokenEdge`
- Added: `EXCLUDED_PATH_PREFIXES`
- Added: `isSourceFile`
- Added: `isGitRepo`
- Added: `getRecentCommits`
- Added: `raw`
- Added: `getChangedFilesFromCommits`
- Added: `seen`
- Added: `trimmed`
- Added: `parts`
- Added: `getCommitDiff`
- Added: `analyseDiffs`
- Added: `changeMap`
- Added: `for`
- Added: `rawDiff`
- Added: `currentFile`
- Added: `match`
- Added: `entry`
- Added: `funcPatterns`
- Added: `if`
- Added: `name`
- Added: `importMatch`
- Added: `pyImportMatch`
- Added: `exportMatch`
- Added: `computeImpact`
- Added: `allCentralities`
- Added: `sortedCentralities`
- Added: `highRiskThreshold`
- Added: `fileData`
- Added: `rel`
- Added: `diff`
- Added: `otherFileData`
- Added: `generateMarkdown`
- Added: `now`
- Added: `shortHash`
- Added: `hasChanges`
- Added: `broken`
- Added: `callers`
- Added: `sorted`
- Added: `depCount`
- Added: `riskTag`
- Added: `fileRefs`
- Added: `contextLines`
- Added: `buildAgentContext`
- Added: `uniqueAuthors`
- Added: `authorStr`
- Added: `notable`
- Added: `highRisk`
- Added: `generateJSON`
- Added: `data`
- Added: `generateHandoff`
- Added: `commits`
- Added: `fileChanges`
- Added: `diffChanges`
- Added: `changedFilePaths`
- Added: `result`
- Added: `ext`
- Added: `fileName`
- Added: `outputPath`
- New imports: `child_process`, `path`, `fs/promises`, `../types`

### src/types.ts
- Added: `HandoffConfig`
- New exports: `HandoffConfig`, `DEFAULT_HANDOFF_CONFIG`

### src/ui.ts
- Added: `if`
- Removed: `BANNER_ART`
- Removed: `GRADIENT`
- Removed: `W`
- Removed: `for`
- Removed: `line`
- Removed: `colored`
- Removed: `tagline`
- Removed: `ver`

## Impact

- `src/types.ts` is depended on by 12 files — changes here are **high risk**
- `src/handoff/generator.ts` is depended on by `src/cli.ts` — changes here are **high risk**
- `src/ui.ts` is depended on by `src/cli.ts` — changes here are **high risk**
- `src/graph/builder.ts` is depended on by `src/cli.ts` — changes here are **high risk**
- `src/graph/differ.ts` is depended on by `src/cli.ts` — changes here are **high risk**
- `src/graph/serializer.ts` is depended on by `src/cli.ts` — changes here are **high risk**
- `src/hasher.ts` is depended on by `src/cli.ts` — changes here are **high risk**
- `src/parser/index.ts` is depended on by `src/worker.ts` — changes here are **high risk**
- `src/parser/javascript.ts` is depended on by `src/parser/index.ts` — changes here are **high risk**
- `src/parser/python.ts` is depended on by `src/parser/index.ts` — changes here are **high risk**
- `src/parser/typescript.ts` is depended on by `src/parser/index.ts` — changes here are **high risk**
- `src/walker.ts` is depended on by `src/cli.ts` — changes here are **high risk**

## Agent context

Last 7 commits by aryaneelshivam, spanning from 18 hours ago to 2 minutes ago.
src/cli.ts: VERSION modified; mergedHandoff, if, handoffPath added; gitignorePath, relOutput, entries, content removed. src/handoff/generator.ts: CommitInfo, FileChange, DiffChange, ImpactEntry, BrokenEdge, EXCLUDED_PATH_PREFIXES, isSourceFile, isGitRepo, getRecentCommits, raw, getChangedFilesFromCommits, seen, trimmed, parts, getCommitDiff, analyseDiffs, changeMap, for, rawDiff, currentFile, match, entry, funcPatterns, if, name, importMatch, pyImportMatch, exportMatch, computeImpact, allCentralities, sortedCentralities, highRiskThreshold, fileData, rel, diff, otherFileData, generateMarkdown, now, shortHash, hasChanges, broken, callers, sorted, depCount, riskTag, fileRefs, contextLines, buildAgentContext, uniqueAuthors, authorStr, notable, highRisk, generateJSON, data, generateHandoff, commits, fileChanges, diffChanges, changedFilePaths, result, ext, fileName, outputPath added. src/types.ts: HandoffConfig added. src/ui.ts: if added; BANNER_ART, GRADIENT, W, for, line, colored, tagline, ver removed.
High-risk changes: src/handoff/generator.ts (1 dependents), src/types.ts (12 dependents), src/ui.ts (1 dependents), src/graph/builder.ts (1 dependents), src/graph/differ.ts (1 dependents), src/graph/serializer.ts (1 dependents), src/hasher.ts (1 dependents), src/parser/index.ts (1 dependents), src/parser/javascript.ts (1 dependents), src/parser/python.ts (1 dependents), src/parser/typescript.ts (1 dependents), src/walker.ts (1 dependents).
