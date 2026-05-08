# Ribbit

**Generate an AI-readable knowledge graph of your codebase.**

Ribbit scans your project, parses every file with [tree-sitter](https://tree-sitter.github.io/), and outputs a structured JSON graph of all files, symbols, and relationships. Any AI agent can directly reference this graph for code understanding, navigation, and analysis.

## Features

- ⚡️ **Blazing Fast Incremental Builds**: Uses `xxhash-wasm` to fingerprint files. On re-runs, only modified files are parsed, completing most updates in under 500ms.
- 🧵 **Multi-Core Parallel Parsing**: Leverages Node.js `worker_threads` to parse your codebase concurrently across all available CPU cores.
- 🌳 **Deep Semantic Understanding**: Powered by `tree-sitter` for flawless AST-based parsing of **TypeScript**, **JavaScript**, and **Python**.
- 🐸 **Production-Grade Terminal UI**: Zero-dependency custom UI with vibrant green gradients, ASCII banners, and animated box-drawn statistics panels.
- 🧠 **AI-Optimized Output**: Automatically calculates "centrality" metrics so LLMs and coding agents know which files are the most critical in your architecture.
- 📦 **Smart Auto-Chunking**: Small projects get a single `index.json`. Large projects (>200 files) are automatically split into a chunked module directory structure to prevent context window overflows.
- ⚙️ **Highly Customizable**: Easily exclude directories, toggle test files, or focus on specific languages via `ribbit.config.js`.

---

## Quick Start

```bash
# Install
npm install @aryaneelshivam/ribbit
npx @aryaneelshivam/ribbit

# Add the script to your package.json
# "scripts": { "ribbit": "ribbit" }

# Run
npm run ribbit
```

Or run directly:

```bash
npx ribbit
```

## What Gets Generated

Ribbit writes to a `ribbit/` folder in your project root:

**Small codebases (< 200 files) → single file:**

```
ribbit/
  index.json          ← full graph: files, symbols, relationships
```

**Large codebases (≥ 200 files) → chunked:**

```
ribbit/
  index.json          ← meta + file map (always small)
  modules/
    auth.json         ← one file per top-level directory
    payments.json
    utils.json
  relationships.json  ← cross-module edges
```

## Output Format

```json
{
  "meta": {
    "generated": "2026-05-08T10:00:00Z",
    "version": "1.0.0",
    "files": 847,
    "nodes": 12453,
    "edges": 34821,
    "parseTime": 1200,
    "incremental": true
  },
  "files": {
    "src/auth/middleware.ts": {
      "exports": ["authMiddleware", "validateToken"],
      "imports": ["src/db/client.ts", "src/utils/logger.ts"],
      "language": "typescript",
      "centrality": 0.87,
      "hash": "a1b2c3d4",
      "lastModified": 1715000000,
      "size": 4821
    }
  },
  "symbols": {
    "authMiddleware": {
      "file": "src/auth/middleware.ts",
      "type": "function",
      "calls": ["db.query", "logger.log"],
      "calledBy": ["src/routes/api.ts"]
    }
  },
  "relationships": {
    "src/auth/middleware.ts": {
      "dependsOn": ["src/db/client.ts"],
      "dependedOnBy": ["src/routes/api.ts"]
    }
  }
}
```

## How to Reference in IDE Agents

Point your AI agent to the graph:

```
@ribbit/index.json
```

The centrality scores tell agents which files and symbols are most important — entry points, shared utilities, and core models will have high centrality.

## CLI Options

| Flag | Description |
|------|-------------|
| `ribbit` | Default: runs full or incremental build |
| `--full` | Force complete re-parse, ignore previous graph |
| `--stats` | Print graph stats to console, don't write files |
| `--config <path>` | Path to custom `ribbit.config.js` |
| `--version` | Print version |
| `--help` | Show help |

## Configuration

Create a `ribbit.config.js` in your project root (auto-created on first run):

```javascript
module.exports = {
  // Glob patterns to ignore
  ignore: [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**",
    "**/dist/**",
  ],

  // Languages to parse
  languages: ["typescript", "javascript"],

  // Output directory
  output: "ribbit/",

  // File count threshold for chunked output
  chunkThreshold: 200,

  // Include test files in the graph
  includeTests: false,

  // Include dotfiles
  includeDotFiles: false,
}
```

## Incremental Builds

Ribbit uses `xxhash` to fingerprint every file. On re-runs, only files whose content has changed are re-parsed — everything else is carried forward from the previous graph. This makes re-runs extremely fast even on large codebases.

## Terminal UI

Ribbit features a production-grade terminal interface with:
- **Gradient ASCII Art Banner** for clear startup visibility.
- **Boxed Stats Panels** with dynamic progress bars.
- **Colored Status Indicators** for scanning, parsing, and building stages.
- **Blazing Fast Timing** indicators based on execution speed.

## Performance

| Scenario | Target |
|----------|--------|
| First run — 10k lines | < 0.5s |
| First run — 100k lines | < 3s |
| First run — 1M lines | < 20s |
| Re-run — 10 changed files | < 500ms |

## Supported Languages

- **TypeScript** (`.ts`, `.tsx`)
- **JavaScript** (`.js`, `.jsx`, `.mjs`, `.cjs`)
- **Python** (`.py`)

## Roadmap

- [ ] **Phase 2**: `--watch` mode for automatic re-runs on file changes.
- [ ] **Phase 3**: MCP server for real-time graph queries.
- [ ] **Phase 4**: Additional language support (Go, Rust, Java).

## Author

**Aryaneel Shivam**

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
