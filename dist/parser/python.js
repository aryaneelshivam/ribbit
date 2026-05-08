"use strict";
// ─── Python Parser ─────────────────────────────────────────────────────────────
// Parses Python files using tree-sitter-python to extract functions, classes,
// imports, calls, __all__ exports, and class inheritance.
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
exports.parsePythonFile = parsePythonFile;
const path = __importStar(require("path"));
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const pyParser = new tree_sitter_1.default();
let pyInitialised = false;
function ensurePython() {
    if (!pyInitialised) {
        try {
            pyParser.setLanguage(tree_sitter_python_1.default);
            pyInitialised = true;
        }
        catch {
            console.warn("Ribbit: failed to load tree-sitter-python grammar");
            return false;
        }
    }
    return true;
}
function collectCalls(node, calls) {
    if (node.type === "call") {
        const fn = node.childForFieldName("function");
        if (fn) {
            const name = fn.text;
            if (name && !name.startsWith("("))
                calls.add(name);
        }
    }
    for (const child of node.children) {
        collectCalls(child, calls);
    }
}
/**
 * Extract `__all__` if defined at the module level.
 */
function extractDunderAll(rootNode) {
    const names = [];
    for (const child of rootNode.namedChildren) {
        if (child.type === "expression_statement") {
            const expr = child.namedChildren[0];
            if (expr && expr.type === "assignment") {
                const left = expr.childForFieldName("left");
                if (left && left.text === "__all__") {
                    const right = expr.childForFieldName("right");
                    if (right && right.type === "list") {
                        for (const elem of right.namedChildren) {
                            if (elem.type === "string") {
                                // Strip quotes
                                const val = elem.text.replace(/['"]/g, "");
                                if (val)
                                    names.push(val);
                            }
                        }
                    }
                }
            }
        }
    }
    return names;
}
/**
 * Resolve a Python import path to a relative file path.
 */
function resolvePythonImport(modulePath, currentFile, root) {
    // Relative imports (starting with .)
    if (modulePath.startsWith(".")) {
        const dots = modulePath.match(/^\.+/)?.[0].length ?? 1;
        let dir = path.dirname(currentFile);
        for (let i = 1; i < dots; i++)
            dir = path.dirname(dir);
        const rest = modulePath.slice(dots).replace(/\./g, path.sep);
        if (rest) {
            return path.relative(root, path.join(dir, rest + ".py"));
        }
        return path.relative(root, dir);
    }
    // Absolute imports — convert dots to path separators
    return modulePath.replace(/\./g, path.sep);
}
/**
 * Parse a Python file.
 */
function parsePythonFile(source, filePath, hash, root) {
    if (!ensurePython()) {
        return { filePath, hash, nodes: [], edges: [], error: "Python grammar unavailable" };
    }
    const tree = pyParser.parse(source);
    const rootNode = tree.rootNode;
    const relativePath = path.relative(root, filePath);
    const fileNodeId = relativePath;
    const nodes = [];
    const edges = [];
    const fileImports = [];
    const fileExports = [];
    const allCalls = new Set();
    collectCalls(rootNode, allCalls);
    // Extract __all__ for exports
    const dunderAll = extractDunderAll(rootNode);
    fileExports.push(...dunderAll);
    // Collect all top-level definitions as potential exports if no __all__
    const topLevelDefs = [];
    for (const child of rootNode.namedChildren) {
        switch (child.type) {
            // ── import X ───────────────────────────────────────────
            case "import_statement": {
                for (const nameNode of child.namedChildren) {
                    if (nameNode.type === "dotted_name") {
                        const modulePath = nameNode.text;
                        const resolved = resolvePythonImport(modulePath, filePath, root);
                        fileImports.push(resolved);
                        edges.push({ from: fileNodeId, to: resolved, type: "imports" });
                    }
                    else if (nameNode.type === "aliased_import") {
                        const name = nameNode.namedChildren[0];
                        if (name) {
                            const resolved = resolvePythonImport(name.text, filePath, root);
                            fileImports.push(resolved);
                            edges.push({ from: fileNodeId, to: resolved, type: "imports" });
                        }
                    }
                }
                break;
            }
            // ── from X import Y ────────────────────────────────────
            case "import_from_statement": {
                const moduleNameNode = child.childForFieldName("module_name");
                const modulePath = moduleNameNode?.text ?? "";
                if (modulePath) {
                    const resolved = resolvePythonImport(modulePath, filePath, root);
                    fileImports.push(resolved);
                    edges.push({ from: fileNodeId, to: resolved, type: "imports" });
                }
                break;
            }
            // ── def / async def ────────────────────────────────────
            case "function_definition": {
                const nameNode = child.childForFieldName("name");
                if (!nameNode)
                    break;
                const name = nameNode.text;
                const nodeId = `${relativePath}:${name}`;
                const fnCalls = new Set();
                collectCalls(child, fnCalls);
                topLevelDefs.push(name);
                const isExported = dunderAll.length === 0 ? !name.startsWith("_") : dunderAll.includes(name);
                nodes.push({
                    id: nodeId, type: "function", name, file: relativePath,
                    language: "python", hash, exports: isExported ? [name] : [],
                    imports: [], calls: Array.from(fnCalls), calledBy: [],
                    centrality: 0, lastModified: 0,
                });
                if (isExported)
                    edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
                break;
            }
            // ── class ──────────────────────────────────────────────
            case "class_definition": {
                const nameNode = child.childForFieldName("name");
                if (!nameNode)
                    break;
                const name = nameNode.text;
                const nodeId = `${relativePath}:${name}`;
                const classCalls = new Set();
                collectCalls(child, classCalls);
                topLevelDefs.push(name);
                // Extract base classes (superclasses)
                let extendsName;
                const superclasses = child.childForFieldName("superclasses");
                if (superclasses) {
                    const bases = superclasses.namedChildren.filter((c) => c.type === "identifier" || c.type === "attribute");
                    if (bases.length > 0) {
                        extendsName = bases[0].text;
                    }
                    // Additional bases as implements (Python doesn't have interfaces, but multi-inheritance)
                    for (let i = 1; i < bases.length; i++) {
                        edges.push({ from: nodeId, to: bases[i].text, type: "extends" });
                    }
                }
                const isExported = dunderAll.length === 0 ? !name.startsWith("_") : dunderAll.includes(name);
                nodes.push({
                    id: nodeId, type: "class", name, file: relativePath,
                    language: "python", hash, exports: isExported ? [name] : [],
                    imports: [], calls: Array.from(classCalls), calledBy: [],
                    extends: extendsName, centrality: 0, lastModified: 0,
                });
                if (extendsName)
                    edges.push({ from: nodeId, to: extendsName, type: "extends" });
                if (isExported)
                    edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
                break;
            }
            // ── Top-level assignments (constants) ──────────────────
            case "expression_statement": {
                const expr = child.namedChildren[0];
                if (expr && expr.type === "assignment") {
                    const left = expr.childForFieldName("left");
                    if (left && left.type === "identifier" && left.text !== "__all__") {
                        const name = left.text;
                        const nodeId = `${relativePath}:${name}`;
                        topLevelDefs.push(name);
                        const isExported = dunderAll.length === 0 ? !name.startsWith("_") : dunderAll.includes(name);
                        nodes.push({
                            id: nodeId, type: "constant", name, file: relativePath,
                            language: "python", hash, exports: isExported ? [name] : [],
                            imports: [], calls: [], calledBy: [],
                            centrality: 0, lastModified: 0,
                        });
                        if (isExported)
                            edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
                    }
                }
                break;
            }
            default:
                break;
        }
    }
    // If no __all__, export all non-underscore top-level defs
    if (dunderAll.length === 0) {
        for (const def of topLevelDefs) {
            if (!def.startsWith("_") && !fileExports.includes(def)) {
                fileExports.push(def);
            }
        }
    }
    // File-level node
    nodes.unshift({
        id: fileNodeId,
        type: "file",
        name: path.basename(filePath),
        file: relativePath,
        language: "python",
        hash,
        exports: fileExports,
        imports: fileImports,
        calls: Array.from(allCalls),
        calledBy: [],
        centrality: 0,
        lastModified: 0,
    });
    return { filePath, hash, nodes, edges };
}
//# sourceMappingURL=python.js.map