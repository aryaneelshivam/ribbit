"use strict";
// ─── JavaScript / JSX Parser ───────────────────────────────────────────────────
// Parses JavaScript, JSX, MJS, and CJS files using tree-sitter-javascript.
// Extracts the same symbol categories as the TypeScript parser.
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
exports.parseJavaScriptFile = parseJavaScriptFile;
const path = __importStar(require("path"));
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_javascript_1 = __importDefault(require("tree-sitter-javascript"));
const jsParser = new tree_sitter_1.default();
let jsInitialised = false;
function ensureJS() {
    if (!jsInitialised) {
        try {
            jsParser.setLanguage(tree_sitter_javascript_1.default);
            jsInitialised = true;
        }
        catch {
            console.warn("Ribbit: failed to load tree-sitter-javascript grammar");
            return false;
        }
    }
    return true;
}
function extractIdentifier(node) {
    return node.text;
}
function collectCalls(node, calls) {
    if (node.type === "call_expression") {
        const fn = node.namedChildren[0];
        if (fn) {
            const name = extractIdentifier(fn);
            if (name && !name.startsWith("("))
                calls.add(name);
        }
    }
    for (const child of node.children) {
        collectCalls(child, calls);
    }
}
function extractImportSource(node) {
    const source = node.childForFieldName("source");
    if (source)
        return source.text.replace(/['"]/g, "");
    for (const child of node.namedChildren) {
        if (child.type === "string")
            return child.text.replace(/['"]/g, "");
    }
    return null;
}
function resolveImportPath(importPath, currentFile, root) {
    if (!importPath.startsWith(".") && !importPath.startsWith("/"))
        return importPath;
    const dir = path.dirname(currentFile);
    return path.relative(root, path.resolve(dir, importPath));
}
/**
 * Handle CommonJS `require()` calls at the top level.
 */
function extractRequires(rootNode, currentFile, root) {
    const requires = [];
    const requireNodes = rootNode.descendantsOfType("call_expression");
    for (const callNode of requireNodes) {
        const fn = callNode.namedChildren[0];
        if (fn && fn.text === "require") {
            const args = callNode.namedChildren[1];
            if (args && args.type === "arguments") {
                const firstArg = args.namedChildren[0];
                if (firstArg && firstArg.type === "string") {
                    const modPath = firstArg.text.replace(/['"]/g, "");
                    requires.push(resolveImportPath(modPath, currentFile, root));
                }
            }
        }
    }
    return requires;
}
/**
 * Parse a JavaScript/JSX/MJS/CJS file.
 */
function parseJavaScriptFile(source, filePath, hash, root) {
    if (!ensureJS()) {
        return { filePath, hash, nodes: [], edges: [], error: "JS grammar unavailable" };
    }
    const tree = jsParser.parse(source);
    const rootNode = tree.rootNode;
    const relativePath = path.relative(root, filePath);
    const fileNodeId = relativePath;
    const nodes = [];
    const edges = [];
    const fileImports = [];
    const fileExports = [];
    const allCalls = new Set();
    collectCalls(rootNode, allCalls);
    // Collect CommonJS requires
    const requireImports = extractRequires(rootNode, filePath, root);
    fileImports.push(...requireImports);
    for (const child of rootNode.namedChildren) {
        switch (child.type) {
            case "import_statement": {
                const src = extractImportSource(child);
                if (src) {
                    const resolved = resolveImportPath(src, filePath, root);
                    fileImports.push(resolved);
                    edges.push({ from: fileNodeId, to: resolved, type: "imports" });
                }
                break;
            }
            case "export_statement": {
                // Process inner declarations
                for (const inner of child.namedChildren) {
                    processJSDeclaration(inner, relativePath, hash, nodes, edges, fileNodeId, fileExports, true);
                }
                // Default exports
                if (child.text.includes("export default")) {
                    if (fileExports.length === 0)
                        fileExports.push("default");
                }
                break;
            }
            case "function_declaration":
            case "generator_function_declaration":
            case "class_declaration":
            case "lexical_declaration":
            case "variable_declaration":
                processJSDeclaration(child, relativePath, hash, nodes, edges, fileNodeId, fileExports, false);
                break;
            // Handle module.exports
            case "expression_statement": {
                const expr = child.namedChildren[0];
                if (expr && expr.type === "assignment_expression") {
                    const left = expr.namedChildren[0];
                    if (left && left.text.startsWith("module.exports")) {
                        fileExports.push("default");
                    }
                    else if (left && left.text.startsWith("exports.")) {
                        const exportName = left.text.replace("exports.", "");
                        fileExports.push(exportName);
                    }
                }
                break;
            }
            default:
                break;
        }
    }
    // Add require edges
    for (const req of requireImports) {
        edges.push({ from: fileNodeId, to: req, type: "imports" });
    }
    // File-level node
    nodes.unshift({
        id: fileNodeId,
        type: "file",
        name: path.basename(filePath),
        file: relativePath,
        language: "javascript",
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
function processJSDeclaration(node, relativePath, hash, nodes, edges, fileNodeId, fileExports, isExported) {
    switch (node.type) {
        case "function_declaration":
        case "generator_function_declaration": {
            const nameNode = node.childForFieldName("name");
            if (!nameNode)
                break;
            const name = nameNode.text;
            const nodeId = `${relativePath}:${name}`;
            const fnCalls = new Set();
            collectCalls(node, fnCalls);
            if (isExported)
                fileExports.push(name);
            nodes.push({
                id: nodeId, type: "function", name, file: relativePath,
                language: "javascript", hash, exports: isExported ? [name] : [],
                imports: [], calls: Array.from(fnCalls), calledBy: [],
                centrality: 0, lastModified: 0,
            });
            if (isExported)
                edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
            break;
        }
        case "class_declaration": {
            const nameNode = node.childForFieldName("name");
            if (!nameNode)
                break;
            const name = nameNode.text;
            const nodeId = `${relativePath}:${name}`;
            const classCalls = new Set();
            collectCalls(node, classCalls);
            if (isExported)
                fileExports.push(name);
            // Check extends
            let extendsName;
            const heritage = node.namedChildren.find((c) => c.type === "class_heritage");
            if (heritage) {
                const ext = heritage.namedChildren[0];
                if (ext)
                    extendsName = ext.text;
            }
            nodes.push({
                id: nodeId, type: "class", name, file: relativePath,
                language: "javascript", hash, exports: isExported ? [name] : [],
                imports: [], calls: Array.from(classCalls), calledBy: [],
                extends: extendsName, centrality: 0, lastModified: 0,
            });
            if (extendsName)
                edges.push({ from: nodeId, to: extendsName, type: "extends" });
            if (isExported)
                edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
            break;
        }
        case "lexical_declaration":
        case "variable_declaration": {
            for (const decl of node.namedChildren) {
                if (decl.type === "variable_declarator") {
                    const nameNode = decl.childForFieldName("name");
                    if (!nameNode)
                        continue;
                    const name = nameNode.text;
                    const nodeId = `${relativePath}:${name}`;
                    const value = decl.childForFieldName("value");
                    const isFunc = value && (value.type === "arrow_function" || value.type === "function" || value.type === "function_expression");
                    const declCalls = new Set();
                    collectCalls(decl, declCalls);
                    if (isExported)
                        fileExports.push(name);
                    nodes.push({
                        id: nodeId, type: isFunc ? "function" : "constant", name, file: relativePath,
                        language: "javascript", hash, exports: isExported ? [name] : [],
                        imports: [], calls: Array.from(declCalls), calledBy: [],
                        centrality: 0, lastModified: 0,
                    });
                    if (isExported)
                        edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
                }
            }
            break;
        }
        case "export_clause": {
            for (const spec of node.namedChildren) {
                if (spec.type === "export_specifier") {
                    const alias = spec.childForFieldName("alias");
                    const name = spec.childForFieldName("name");
                    fileExports.push(alias ? alias.text : name ? name.text : spec.text);
                }
            }
            break;
        }
        default:
            break;
    }
}
//# sourceMappingURL=javascript.js.map