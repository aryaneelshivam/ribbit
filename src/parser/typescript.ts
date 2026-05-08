// ─── TypeScript / TSX Parser ───────────────────────────────────────────────────
// Parses TypeScript and TSX files using tree-sitter-typescript to extract
// symbols (functions, classes, types, interfaces, constants), imports,
// exports, call expressions, and inheritance relationships.

import * as path from "path";
import Parser from "tree-sitter";
import TypeScriptLanguages from "tree-sitter-typescript";
import { RibbitNode, RibbitEdge, ParseResult, NodeType } from "../types";

const tsParser = new Parser();
const tsxParser = new Parser();

let tsInitialised = false;
let tsxInitialised = false;

function ensureTS(): boolean {
  if (!tsInitialised) {
    try {
      tsParser.setLanguage(TypeScriptLanguages.typescript);
      tsInitialised = true;
    } catch (e) {
      console.warn("Ribbit: failed to load tree-sitter-typescript grammar");
      return false;
    }
  }
  return true;
}

function ensureTSX(): boolean {
  if (!tsxInitialised) {
    try {
      tsxParser.setLanguage(TypeScriptLanguages.tsx);
      tsxInitialised = true;
    } catch (e) {
      console.warn("Ribbit: failed to load tree-sitter-tsx grammar");
      return false;
    }
  }
  return true;
}

/**
 * Extract the text of an identifier node, handling dotted member expressions.
 */
function extractIdentifier(node: Parser.SyntaxNode): string {
  if (node.type === "identifier" || node.type === "type_identifier" || node.type === "property_identifier") {
    return node.text;
  }
  if (node.type === "member_expression" || node.type === "nested_identifier") {
    return node.text;
  }
  return node.text;
}

/**
 * Recursively collect all call_expression nodes from the AST.
 */
function collectCalls(node: Parser.SyntaxNode, calls: Set<string>): void {
  if (node.type === "call_expression") {
    const fn = node.namedChildren[0];
    if (fn) {
      const name = extractIdentifier(fn);
      if (name && !name.startsWith("(")) {
        calls.add(name);
      }
    }
  }
  for (const child of node.children) {
    collectCalls(child, calls);
  }
}

/**
 * Extract import source path from an import statement node.
 */
function extractImportSource(node: Parser.SyntaxNode): string | null {
  // Look for the string/string_fragment child that holds the module path
  const source = node.childForFieldName("source");
  if (source) {
    // Remove quotes
    return source.text.replace(/['"]/g, "");
  }
  // Fallback: find a string node among children
  for (const child of node.namedChildren) {
    if (child.type === "string") {
      return child.text.replace(/['"]/g, "");
    }
  }
  return null;
}

/**
 * Extract imported symbol names from an import statement.
 */
function extractImportedNames(node: Parser.SyntaxNode): string[] {
  const names: string[] = [];
  const clause = node.children.find(
    (c) => c.type === "import_clause"
  );
  if (!clause) return names;

  for (const child of clause.namedChildren) {
    if (child.type === "identifier") {
      // default import
      names.push(child.text);
    } else if (child.type === "named_imports") {
      for (const spec of child.namedChildren) {
        if (spec.type === "import_specifier") {
          const alias = spec.childForFieldName("alias");
          const name = spec.childForFieldName("name");
          names.push(alias ? alias.text : name ? name.text : spec.text);
        }
      }
    } else if (child.type === "namespace_import") {
      const id = child.namedChildren.find((c) => c.type === "identifier");
      if (id) names.push(`* as ${id.text}`);
    }
  }
  return names;
}

/**
 * Resolve an import path relative to the current file.
 */
function resolveImportPath(importPath: string, currentFile: string, root: string): string {
  // Package imports stay as-is
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return importPath;
  }
  // Resolve relative paths
  const dir = path.dirname(currentFile);
  const resolved = path.resolve(dir, importPath);
  return path.relative(root, resolved);
}

/**
 * Extract export names from an export statement.
 */
function extractExportNames(node: Parser.SyntaxNode): string[] {
  const names: string[] = [];

  for (const child of node.namedChildren) {
    switch (child.type) {
      case "function_declaration":
      case "generator_function_declaration": {
        const name = child.childForFieldName("name");
        if (name) names.push(name.text);
        break;
      }
      case "class_declaration": {
        const name = child.childForFieldName("name");
        if (name) names.push(name.text);
        break;
      }
      case "interface_declaration": {
        const name = child.childForFieldName("name");
        if (name) names.push(name.text);
        break;
      }
      case "type_alias_declaration": {
        const name = child.childForFieldName("name");
        if (name) names.push(name.text);
        break;
      }
      case "enum_declaration": {
        const name = child.childForFieldName("name");
        if (name) names.push(name.text);
        break;
      }
      case "lexical_declaration":
      case "variable_declaration": {
        for (const decl of child.namedChildren) {
          if (decl.type === "variable_declarator") {
            const name = decl.childForFieldName("name");
            if (name) names.push(name.text);
          }
        }
        break;
      }
      case "export_clause": {
        for (const spec of child.namedChildren) {
          if (spec.type === "export_specifier") {
            const alias = spec.childForFieldName("alias");
            const name = spec.childForFieldName("name");
            names.push(alias ? alias.text : name ? name.text : spec.text);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // Handle `export default expression`
  if (node.text.includes("export default")) {
    if (names.length === 0) names.push("default");
  }

  return names;
}

/**
 * Extract extends clause from a class declaration.
 */
function extractExtends(classNode: Parser.SyntaxNode): string | undefined {
  const heritage = classNode.namedChildren.find(
    (c) => c.type === "class_heritage"
  );
  if (!heritage) return undefined;

  const extendsClause = heritage.namedChildren.find(
    (c) => c.type === "extends_clause"
  );
  if (!extendsClause) return undefined;

  // The extends target is the first expression/identifier after 'extends'
  for (const child of extendsClause.namedChildren) {
    if (child.type !== "extends" && child.text !== "extends") {
      return extractIdentifier(child);
    }
  }
  return extendsClause.namedChildren[0]?.text;
}

/**
 * Extract implements clause from a class declaration.
 */
function extractImplements(classNode: Parser.SyntaxNode): string[] {
  const heritage = classNode.namedChildren.find(
    (c) => c.type === "class_heritage"
  );
  if (!heritage) return [];

  const implClause = heritage.namedChildren.find(
    (c) => c.type === "implements_clause"
  );
  if (!implClause) return [];

  return implClause.namedChildren
    .filter((c) => c.type === "type_identifier" || c.type === "generic_type")
    .map((c) => {
      if (c.type === "generic_type") {
        const name = c.namedChildren[0];
        return name ? name.text : c.text;
      }
      return c.text;
    });
}

/**
 * Main parse function for TypeScript/TSX files.
 */
export function parseTypeScriptFile(
  source: string,
  filePath: string,
  hash: string,
  root: string
): ParseResult {
  const ext = path.extname(filePath);
  const isTSX = ext === ".tsx";

  if (isTSX) {
    if (!ensureTSX()) return { filePath, hash, nodes: [], edges: [], error: "TSX grammar unavailable" };
  } else {
    if (!ensureTS()) return { filePath, hash, nodes: [], edges: [], error: "TS grammar unavailable" };
  }

  const parser = isTSX ? tsxParser : tsParser;
  const tree = parser.parse(source);
  const rootNode = tree.rootNode;
  const relativePath = path.relative(root, filePath);

  const nodes: RibbitNode[] = [];
  const edges: RibbitEdge[] = [];
  const fileImports: string[] = [];
  const fileExports: string[] = [];

  // Collect all call expressions from the entire tree
  const allCalls = new Set<string>();
  collectCalls(rootNode, allCalls);

  // File-level node
  const fileNodeId = relativePath;

  // Process top-level statements
  for (const child of rootNode.namedChildren) {
    switch (child.type) {
      // ── Imports ──────────────────────────────────────────────
      case "import_statement": {
        const source = extractImportSource(child);
        if (source) {
          const resolved = resolveImportPath(source, filePath, root);
          fileImports.push(resolved);
          edges.push({ from: fileNodeId, to: resolved, type: "imports" });
        }
        break;
      }

      // ── Exports ──────────────────────────────────────────────
      case "export_statement": {
        const exportNames = extractExportNames(child);
        fileExports.push(...exportNames);

        // Also process the inner declaration
        for (const inner of child.namedChildren) {
          processDeclaration(inner, true);
        }
        break;
      }

      // ── Declarations ────────────────────────────────────────
      case "function_declaration":
      case "generator_function_declaration":
        processDeclaration(child, false);
        break;
      case "class_declaration":
        processDeclaration(child, false);
        break;
      case "interface_declaration":
        processDeclaration(child, false);
        break;
      case "type_alias_declaration":
        processDeclaration(child, false);
        break;
      case "enum_declaration":
        processDeclaration(child, false);
        break;
      case "lexical_declaration":
      case "variable_declaration":
        processDeclaration(child, false);
        break;

      default:
        break;
    }
  }

  function processDeclaration(node: Parser.SyntaxNode, isExported: boolean): void {
    switch (node.type) {
      case "function_declaration":
      case "generator_function_declaration": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;
        const name = nameNode.text;
        const nodeId = `${relativePath}:${name}`;
        const fnCalls = new Set<string>();
        collectCalls(node, fnCalls);

        nodes.push({
          id: nodeId,
          type: "function",
          name,
          file: relativePath,
          language: "typescript",
          hash,
          exports: isExported ? [name] : [],
          imports: [],
          calls: Array.from(fnCalls),
          calledBy: [],
          centrality: 0,
          lastModified: 0,
        });
        if (isExported) {
          edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
        }
        break;
      }

      case "class_declaration": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;
        const name = nameNode.text;
        const nodeId = `${relativePath}:${name}`;
        const classCalls = new Set<string>();
        collectCalls(node, classCalls);
        const extendsName = extractExtends(node);
        const implementsNames = extractImplements(node);

        nodes.push({
          id: nodeId,
          type: "class",
          name,
          file: relativePath,
          language: "typescript",
          hash,
          exports: isExported ? [name] : [],
          imports: [],
          calls: Array.from(classCalls),
          calledBy: [],
          extends: extendsName,
          implements: implementsNames.length > 0 ? implementsNames : undefined,
          centrality: 0,
          lastModified: 0,
        });
        if (extendsName) {
          edges.push({ from: nodeId, to: extendsName, type: "extends" });
        }
        for (const impl of implementsNames) {
          edges.push({ from: nodeId, to: impl, type: "implements" });
        }
        if (isExported) {
          edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
        }
        break;
      }

      case "interface_declaration": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;
        const name = nameNode.text;
        const nodeId = `${relativePath}:${name}`;

        // Interfaces can also extend other interfaces
        let extendsName: string | undefined;
        const extendsClause = node.namedChildren.find(
          (c) => c.type === "extends_type_clause" || c.type === "extends_clause"
        );
        if (extendsClause && extendsClause.namedChildren.length > 0) {
          extendsName = extendsClause.namedChildren[0].text;
        }

        nodes.push({
          id: nodeId,
          type: "interface",
          name,
          file: relativePath,
          language: "typescript",
          hash,
          exports: isExported ? [name] : [],
          imports: [],
          calls: [],
          calledBy: [],
          extends: extendsName,
          centrality: 0,
          lastModified: 0,
        });
        if (extendsName) {
          edges.push({ from: nodeId, to: extendsName, type: "extends" });
        }
        if (isExported) {
          edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
        }
        break;
      }

      case "type_alias_declaration": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;
        const name = nameNode.text;
        const nodeId = `${relativePath}:${name}`;

        nodes.push({
          id: nodeId,
          type: "type",
          name,
          file: relativePath,
          language: "typescript",
          hash,
          exports: isExported ? [name] : [],
          imports: [],
          calls: [],
          calledBy: [],
          centrality: 0,
          lastModified: 0,
        });
        if (isExported) {
          edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
        }
        break;
      }

      case "enum_declaration": {
        const nameNode = node.childForFieldName("name");
        if (!nameNode) break;
        const name = nameNode.text;
        const nodeId = `${relativePath}:${name}`;

        nodes.push({
          id: nodeId,
          type: "type",
          name,
          file: relativePath,
          language: "typescript",
          hash,
          exports: isExported ? [name] : [],
          imports: [],
          calls: [],
          calledBy: [],
          centrality: 0,
          lastModified: 0,
        });
        if (isExported) {
          edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
        }
        break;
      }

      case "lexical_declaration":
      case "variable_declaration": {
        for (const decl of node.namedChildren) {
          if (decl.type === "variable_declarator") {
            const nameNode = decl.childForFieldName("name");
            if (!nameNode) continue;
            const name = nameNode.text;
            const nodeId = `${relativePath}:${name}`;

            // Check if the value is an arrow function / function expression
            const value = decl.childForFieldName("value");
            const isFunc =
              value &&
              (value.type === "arrow_function" ||
                value.type === "function" ||
                value.type === "function_expression");

            const declCalls = new Set<string>();
            collectCalls(decl, declCalls);

            nodes.push({
              id: nodeId,
              type: isFunc ? "function" : "constant",
              name,
              file: relativePath,
              language: "typescript",
              hash,
              exports: isExported ? [name] : [],
              imports: [],
              calls: Array.from(declCalls),
              calledBy: [],
              centrality: 0,
              lastModified: 0,
            });
            if (isExported) {
              edges.push({ from: fileNodeId, to: nodeId, type: "exports" });
            }
          }
        }
        break;
      }

      // For export_clause, names are already captured by extractExportNames
      case "export_clause":
        break;

      default:
        break;
    }
  }

  // Build the file-level RibbitNode
  nodes.unshift({
    id: fileNodeId,
    type: "file",
    name: path.basename(filePath),
    file: relativePath,
    language: "typescript",
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
