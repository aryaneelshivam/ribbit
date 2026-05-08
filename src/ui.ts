// ─── Terminal UI ───────────────────────────────────────────────────────────────
// Rich terminal output with colors, ASCII art banner, box-drawn stats,
// and progress indicators. Zero external dependencies.

const hasColor = process.stdout.isTTY !== false && !process.env.NO_COLOR;
const a = (code: string) => (hasColor ? code : "");

export const c = {
  reset: a("\x1b[0m"),
  bold: a("\x1b[1m"),
  dim: a("\x1b[2m"),
  italic: a("\x1b[3m"),
  red: a("\x1b[31m"),
  green: a("\x1b[32m"),
  yellow: a("\x1b[33m"),
  blue: a("\x1b[34m"),
  magenta: a("\x1b[35m"),
  cyan: a("\x1b[36m"),
  white: a("\x1b[37m"),
  gray: a("\x1b[90m"),
  brightCyan: a("\x1b[96m"),
  brightBlue: a("\x1b[94m"),
  brightMagenta: a("\x1b[95m"),
  brightGreen: a("\x1b[92m"),
  brightYellow: a("\x1b[93m"),
  brightRed: a("\x1b[91m"),
};

// ─── Box Drawing Helpers ───────────────────────────────────────────────────────

function boxTop(width: number, title?: string): string {
  if (title) {
    const titleText = ` ${title} `;
    const remaining = width - 2 - titleText.length;
    return `  ${c.gray}╭─${c.reset}${c.bold}${c.cyan}${titleText}${c.reset}${c.gray}${"─".repeat(Math.max(0, remaining))}╮${c.reset}`;
  }
  return `  ${c.gray}╭${"─".repeat(width)}╮${c.reset}`;
}

function boxRow(content: string, width: number): string {
  // Strip ANSI codes to measure visible length
  const visible = content.replace(/\x1b\[[0-9;]*m/g, "");
  const pad = Math.max(0, width - 2 - visible.length);
  return `  ${c.gray}│${c.reset} ${content}${" ".repeat(pad)}${c.gray}│${c.reset}`;
}

function boxEmpty(width: number): string {
  return `  ${c.gray}│${" ".repeat(width)}│${c.reset}`;
}

function boxBottom(width: number): string {
  return `  ${c.gray}╰${"─".repeat(width)}╯${c.reset}`;
}

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function progressBar(value: number, max: number, barWidth: number = 16): string {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;
  return `${c.cyan}${"█".repeat(filled)}${c.gray}${"░".repeat(empty)}${c.reset}`;
}

// ─── Banner ────────────────────────────────────────────────────────────────────

const BANNER_ART = [
  " ██████  ██ ██████  ██████  ██ ████████ ",
  " ██   ██ ██ ██   ██ ██   ██ ██    ██    ",
  " ██████  ██ ██████  ██████  ██    ██    ",
  " ██   ██ ██ ██   ██ ██   ██ ██    ██    ",
  " ██   ██ ██ ██████  ██████  ██    ██    ",
];

const GRADIENT = [c.brightGreen, c.green, c.brightGreen, c.green, c.brightGreen];

export function printBanner(version: string): void {
  const W = 50;
  console.log("");
  console.log(boxTop(W));
  console.log(boxEmpty(W));
  for (let i = 0; i < BANNER_ART.length; i++) {
    const line = BANNER_ART[i];
    const colored = `${GRADIENT[i]}${c.bold}${line}${c.reset}`;
    console.log(boxRow(colored, W));
  }
  console.log(boxEmpty(W));
  const tagline = `${c.green}🐸${c.reset} ${c.white}${c.bold}Knowledge Graph Generator${c.reset}`;
  console.log(boxRow(`         ${tagline}          `, W));
  const ver = `${c.dim}v${version}${c.reset}`;
  console.log(boxRow(`                  ${ver}                   `, W));
  console.log(boxEmpty(W));
  console.log(boxBottom(W));
  console.log("");
}

// ─── Status Messages ───────────────────────────────────────────────────────────

export function info(msg: string): void {
  console.log(`  ${c.cyan}●${c.reset} ${msg}`);
}

export function success(msg: string): void {
  console.log(`  ${c.green}✔${c.reset} ${c.green}${msg}${c.reset}`);
}

export function warn(msg: string): void {
  console.log(`  ${c.yellow}⚠${c.reset} ${c.yellow}${msg}${c.reset}`);
}

export function error(msg: string): void {
  console.log("");
  console.log(`  ${c.brightRed}┌─ Error ${"─".repeat(40)}${c.reset}`);
  console.log(`  ${c.brightRed}│${c.reset}`);
  console.log(`  ${c.brightRed}│${c.reset}  ${c.red}${msg}${c.reset}`);
  console.log(`  ${c.brightRed}│${c.reset}`);
  console.log(`  ${c.brightRed}└${"─".repeat(48)}${c.reset}`);
  console.log("");
}

export function dimInfo(msg: string): void {
  console.log(`  ${c.gray}◦ ${msg}${c.reset}`);
}

// ─── Stats Panel ───────────────────────────────────────────────────────────────

interface StatsData {
  files: number;
  nodes: number;
  edges: number;
  parseTime: number;
  incremental: boolean;
  outputPath: string;
}

export function printStats(stats: StatsData): void {
  const W = 50;
  const fmt = (n: number) => n.toLocaleString();
  const maxVal = Math.max(stats.files, stats.nodes, stats.edges, 1);

  const timeStr = (stats.parseTime / 1000).toFixed(1) + "s";
  const speed =
    stats.parseTime < 200
      ? `${c.brightGreen}⚡ blazing fast${c.reset}`
      : stats.parseTime < 1000
      ? `${c.green}✦ fast${c.reset}`
      : `${c.yellow}◆ moderate${c.reset}`;

  console.log("");
  console.log(boxTop(W, "Results"));
  console.log(boxEmpty(W));
  console.log(
    boxRow(
      `${c.cyan}📁${c.reset} Files    ${c.bold}${c.white}${fmt(stats.files).padStart(8)}${c.reset}    ${progressBar(stats.files, maxVal)}`,
      W
    )
  );
  console.log(
    boxRow(
      `${c.brightBlue}◆${c.reset}  Nodes    ${c.bold}${c.white}${fmt(stats.nodes).padStart(8)}${c.reset}    ${progressBar(stats.nodes, maxVal)}`,
      W
    )
  );
  console.log(
    boxRow(
      `${c.magenta}◇${c.reset}  Edges    ${c.bold}${c.white}${fmt(stats.edges).padStart(8)}${c.reset}    ${progressBar(stats.edges, maxVal)}`,
      W
    )
  );
  console.log(
    boxRow(`${c.yellow}⚡${c.reset} Time     ${c.bold}${c.white}${timeStr.padStart(8)}${c.reset}    ${speed}`, W)
  );
  console.log(
    boxRow(
      `${c.gray}↻${c.reset}  Mode     ${c.bold}${stats.incremental ? `${c.brightYellow}incremental` : `${c.brightCyan}full scan`}${c.reset}`,
      W
    )
  );
  console.log(boxEmpty(W));
  console.log(boxRow(`${c.green}→${c.reset}  ${c.dim}${stats.outputPath}${c.reset}`, W));
  console.log(boxEmpty(W));
  console.log(boxBottom(W));
  console.log("");
}

export function printStatsOnly(meta: { files: number; nodes: number; edges: number; parseTime: number; incremental: boolean }): void {
  const W = 50;
  const fmt = (n: number) => n.toLocaleString();
  const maxVal = Math.max(meta.files, meta.nodes, meta.edges, 1);
  const timeStr = (meta.parseTime / 1000).toFixed(1) + "s";

  console.log("");
  console.log(boxTop(W, "Graph Stats"));
  console.log(boxEmpty(W));
  console.log(
    boxRow(
      `${c.cyan}📁${c.reset} Files    ${c.bold}${c.white}${fmt(meta.files).padStart(8)}${c.reset}    ${progressBar(meta.files, maxVal)}`,
      W
    )
  );
  console.log(
    boxRow(
      `${c.brightBlue}◆${c.reset}  Nodes    ${c.bold}${c.white}${fmt(meta.files).padStart(8)}${c.reset}    ${progressBar(meta.files, maxVal)}`,
      W
    )
  );
  console.log(
    boxRow(
      `${c.magenta}◇${c.reset}  Edges    ${c.bold}${c.white}${fmt(meta.files).padStart(8)}${c.reset}    ${progressBar(meta.files, maxVal)}`,
      W
    )
  );
  console.log(
    boxRow(`${c.yellow}⚡${c.reset} Time     ${c.bold}${c.white}${timeStr.padStart(8)}${c.reset}`, W)
  );
  console.log(boxEmpty(W));
  console.log(boxBottom(W));
  console.log("");
}

// ─── Help Screen ───────────────────────────────────────────────────────────────

export function printHelp(version: string): void {
  printBanner(version);

  const W = 50;
  console.log(boxTop(W, "Usage"));
  console.log(boxEmpty(W));
  console.log(boxRow(`${c.dim}$${c.reset} ${c.white}ribbit${c.reset}                 ${c.gray}Build the graph${c.reset}`, W));
  console.log(boxRow(`${c.dim}$${c.reset} ${c.white}ribbit ${c.cyan}--full${c.reset}            ${c.gray}Force re-parse${c.reset}`, W));
  console.log(boxRow(`${c.dim}$${c.reset} ${c.white}ribbit ${c.cyan}--stats${c.reset}           ${c.gray}Stats only${c.reset}`, W));
  console.log(boxRow(`${c.dim}$${c.reset} ${c.white}ribbit ${c.cyan}--config${c.reset} ${c.dim}<path>${c.reset}   ${c.gray}Custom config${c.reset}`, W));
  console.log(boxRow(`${c.dim}$${c.reset} ${c.white}ribbit ${c.cyan}--help${c.reset}            ${c.gray}Show this help${c.reset}`, W));
  console.log(boxRow(`${c.dim}$${c.reset} ${c.white}ribbit ${c.cyan}--version${c.reset}         ${c.gray}Show version${c.reset}`, W));
  console.log(boxEmpty(W));
  console.log(boxBottom(W));
  console.log("");

  console.log(boxTop(W, "Options"));
  console.log(boxEmpty(W));
  console.log(boxRow(`${c.cyan}--full${c.reset}       Ignore cache, re-parse every file`, W));
  console.log(boxRow(`${c.cyan}--stats${c.reset}      Print graph stats without writing`, W));
  console.log(boxRow(`${c.cyan}--config${c.reset}     Path to a custom ribbit.config.js`, W));
  console.log(boxEmpty(W));
  console.log(boxBottom(W));
  console.log("");


  console.log(boxTop(W, "Supported Languages"));
  console.log(boxEmpty(W));
  console.log(boxRow(`${c.brightCyan}▸${c.reset} TypeScript    ${c.dim}.ts  .tsx${c.reset}`, W));
  console.log(boxRow(`${c.yellow}▸${c.reset} JavaScript    ${c.dim}.js  .jsx  .mjs  .cjs${c.reset}`, W));
  console.log(boxRow(`${c.green}▸${c.reset} Python        ${c.dim}.py${c.reset}`, W));
  console.log(boxEmpty(W));
  console.log(boxBottom(W));
  console.log("");
}
