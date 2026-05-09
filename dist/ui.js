"use strict";
// ─── Terminal UI ───────────────────────────────────────────────────────────────
// Rich terminal output with colors, ASCII art banner, box-drawn stats,
// and progress indicators. Zero external dependencies.
Object.defineProperty(exports, "__esModule", { value: true });
exports.c = void 0;
exports.printBanner = printBanner;
exports.info = info;
exports.success = success;
exports.warn = warn;
exports.error = error;
exports.dimInfo = dimInfo;
exports.printStats = printStats;
exports.printStatsOnly = printStatsOnly;
exports.printHelp = printHelp;
const hasColor = process.stdout.isTTY !== false && !process.env.NO_COLOR;
const a = (code) => (hasColor ? code : "");
exports.c = {
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
function boxTop(width, title) {
    if (title) {
        const titleText = ` ${title} `;
        const remaining = width - 2 - titleText.length;
        return `  ${exports.c.gray}╭─${exports.c.reset}${exports.c.bold}${exports.c.cyan}${titleText}${exports.c.reset}${exports.c.gray}${"─".repeat(Math.max(0, remaining))}╮${exports.c.reset}`;
    }
    return `  ${exports.c.gray}╭${"─".repeat(width)}╮${exports.c.reset}`;
}
function boxRow(content, width) {
    // Strip ANSI codes to measure visible length
    const visible = content.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = Math.max(0, width - 2 - visible.length);
    return `  ${exports.c.gray}│${exports.c.reset} ${content}${" ".repeat(pad)}${exports.c.gray}│${exports.c.reset}`;
}
function boxEmpty(width) {
    return `  ${exports.c.gray}│${" ".repeat(width)}│${exports.c.reset}`;
}
function boxBottom(width) {
    return `  ${exports.c.gray}╰${"─".repeat(width)}╯${exports.c.reset}`;
}
// ─── Progress Bar ──────────────────────────────────────────────────────────────
function progressBar(value, max, barWidth = 16) {
    const ratio = max > 0 ? Math.min(value / max, 1) : 0;
    const filled = Math.round(ratio * barWidth);
    const empty = barWidth - filled;
    return `${exports.c.cyan}${"█".repeat(filled)}${exports.c.gray}${"░".repeat(empty)}${exports.c.reset}`;
}
function printBanner(version) {
    console.log("");
    console.log(`  ${exports.c.green}🐸${exports.c.reset} ${exports.c.bold}Ribbit${exports.c.reset} ${exports.c.dim}v${version}${exports.c.reset}`);
    console.log("");
}
// ─── Status Messages ───────────────────────────────────────────────────────────
function info(msg) {
    console.log(`  ${exports.c.cyan}●${exports.c.reset} ${msg}`);
}
function success(msg) {
    console.log(`  ${exports.c.green}✔${exports.c.reset} ${exports.c.green}${msg}${exports.c.reset}`);
}
function warn(msg) {
    console.log(`  ${exports.c.yellow}⚠${exports.c.reset} ${exports.c.yellow}${msg}${exports.c.reset}`);
}
function error(msg) {
    console.log("");
    console.log(`  ${exports.c.brightRed}┌─ Error ${"─".repeat(40)}${exports.c.reset}`);
    console.log(`  ${exports.c.brightRed}│${exports.c.reset}`);
    console.log(`  ${exports.c.brightRed}│${exports.c.reset}  ${exports.c.red}${msg}${exports.c.reset}`);
    console.log(`  ${exports.c.brightRed}│${exports.c.reset}`);
    console.log(`  ${exports.c.brightRed}└${"─".repeat(48)}${exports.c.reset}`);
    console.log("");
}
function dimInfo(msg) {
    console.log(`  ${exports.c.gray}◦ ${msg}${exports.c.reset}`);
}
function printStats(stats) {
    const W = 50;
    const fmt = (n) => n.toLocaleString();
    const maxVal = Math.max(stats.files, stats.nodes, stats.edges, 1);
    const timeStr = (stats.parseTime / 1000).toFixed(1) + "s";
    const speed = stats.parseTime < 200
        ? `${exports.c.brightGreen}⚡ blazing fast${exports.c.reset}`
        : stats.parseTime < 1000
            ? `${exports.c.green}✦ fast${exports.c.reset}`
            : `${exports.c.yellow}◆ moderate${exports.c.reset}`;
    console.log("");
    console.log(boxTop(W, "Results"));
    console.log(boxEmpty(W));
    console.log(boxRow(`${exports.c.cyan}📁${exports.c.reset} Files    ${exports.c.bold}${exports.c.white}${fmt(stats.files).padStart(8)}${exports.c.reset}    ${progressBar(stats.files, maxVal)}`, W));
    console.log(boxRow(`${exports.c.brightBlue}◆${exports.c.reset}  Nodes    ${exports.c.bold}${exports.c.white}${fmt(stats.nodes).padStart(8)}${exports.c.reset}    ${progressBar(stats.nodes, maxVal)}`, W));
    console.log(boxRow(`${exports.c.magenta}◇${exports.c.reset}  Edges    ${exports.c.bold}${exports.c.white}${fmt(stats.edges).padStart(8)}${exports.c.reset}    ${progressBar(stats.edges, maxVal)}`, W));
    console.log(boxRow(`${exports.c.yellow}⚡${exports.c.reset} Time     ${exports.c.bold}${exports.c.white}${timeStr.padStart(8)}${exports.c.reset}    ${speed}`, W));
    console.log(boxRow(`${exports.c.gray}↻${exports.c.reset}  Mode     ${exports.c.bold}${stats.incremental ? `${exports.c.brightYellow}incremental` : `${exports.c.brightCyan}full scan`}${exports.c.reset}`, W));
    console.log(boxEmpty(W));
    console.log(boxRow(`${exports.c.green}→${exports.c.reset}  ${exports.c.dim}${stats.outputPath}${exports.c.reset}`, W));
    if (stats.handoffPath) {
        console.log(boxRow(`${exports.c.brightCyan}→${exports.c.reset}  ${exports.c.dim}${stats.handoffPath}${exports.c.reset}`, W));
    }
    console.log(boxEmpty(W));
    console.log(boxBottom(W));
    console.log("");
}
function printStatsOnly(meta) {
    const W = 50;
    const fmt = (n) => n.toLocaleString();
    const maxVal = Math.max(meta.files, meta.nodes, meta.edges, 1);
    const timeStr = (meta.parseTime / 1000).toFixed(1) + "s";
    console.log("");
    console.log(boxTop(W, "Graph Stats"));
    console.log(boxEmpty(W));
    console.log(boxRow(`${exports.c.cyan}📁${exports.c.reset} Files    ${exports.c.bold}${exports.c.white}${fmt(meta.files).padStart(8)}${exports.c.reset}    ${progressBar(meta.files, maxVal)}`, W));
    console.log(boxRow(`${exports.c.brightBlue}◆${exports.c.reset}  Nodes    ${exports.c.bold}${exports.c.white}${fmt(meta.files).padStart(8)}${exports.c.reset}    ${progressBar(meta.files, maxVal)}`, W));
    console.log(boxRow(`${exports.c.magenta}◇${exports.c.reset}  Edges    ${exports.c.bold}${exports.c.white}${fmt(meta.files).padStart(8)}${exports.c.reset}    ${progressBar(meta.files, maxVal)}`, W));
    console.log(boxRow(`${exports.c.yellow}⚡${exports.c.reset} Time     ${exports.c.bold}${exports.c.white}${timeStr.padStart(8)}${exports.c.reset}`, W));
    console.log(boxEmpty(W));
    console.log(boxBottom(W));
    console.log("");
}
// ─── Help Screen ───────────────────────────────────────────────────────────────
function printHelp(version) {
    printBanner(version);
    const W = 50;
    console.log(boxTop(W, "Usage"));
    console.log(boxEmpty(W));
    console.log(boxRow(`${exports.c.dim}$${exports.c.reset} ${exports.c.white}ribbit${exports.c.reset}                 ${exports.c.gray}Build the graph${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.dim}$${exports.c.reset} ${exports.c.white}ribbit ${exports.c.cyan}--full${exports.c.reset}            ${exports.c.gray}Force re-parse${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.dim}$${exports.c.reset} ${exports.c.white}ribbit ${exports.c.cyan}--stats${exports.c.reset}           ${exports.c.gray}Stats only${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.dim}$${exports.c.reset} ${exports.c.white}ribbit ${exports.c.cyan}--config${exports.c.reset} ${exports.c.dim}<path>${exports.c.reset}   ${exports.c.gray}Custom config${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.dim}$${exports.c.reset} ${exports.c.white}ribbit ${exports.c.cyan}--help${exports.c.reset}            ${exports.c.gray}Show this help${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.dim}$${exports.c.reset} ${exports.c.white}ribbit ${exports.c.cyan}--version${exports.c.reset}         ${exports.c.gray}Show version${exports.c.reset}`, W));
    console.log(boxEmpty(W));
    console.log(boxBottom(W));
    console.log("");
    console.log(boxTop(W, "Options"));
    console.log(boxEmpty(W));
    console.log(boxRow(`${exports.c.cyan}--full${exports.c.reset}       Ignore cache, re-parse every file`, W));
    console.log(boxRow(`${exports.c.cyan}--stats${exports.c.reset}      Print graph stats without writing`, W));
    console.log(boxRow(`${exports.c.cyan}--config${exports.c.reset}     Path to a custom ribbit.config.js`, W));
    console.log(boxEmpty(W));
    console.log(boxBottom(W));
    console.log("");
    console.log(boxTop(W, "Supported Languages"));
    console.log(boxEmpty(W));
    console.log(boxRow(`${exports.c.brightCyan}▸${exports.c.reset} TypeScript    ${exports.c.dim}.ts  .tsx${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.yellow}▸${exports.c.reset} JavaScript    ${exports.c.dim}.js  .jsx  .mjs  .cjs${exports.c.reset}`, W));
    console.log(boxRow(`${exports.c.green}▸${exports.c.reset} Python        ${exports.c.dim}.py${exports.c.reset}`, W));
    console.log(boxEmpty(W));
    console.log(boxBottom(W));
    console.log("");
}
//# sourceMappingURL=ui.js.map