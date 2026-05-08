// Type declarations for tree-sitter packages that lack TypeScript types

declare module 'tree-sitter' {
  class Parser {
    setLanguage(language: Parser.Language): void;
    parse(input: string, oldTree?: Parser.Tree): Parser.Tree;
  }

  namespace Parser {
    interface Language {}

    interface Tree {
      rootNode: SyntaxNode;
      delete(): void;
    }

    interface SyntaxNode {
      type: string;
      text: string;
      startPosition: { row: number; column: number };
      endPosition: { row: number; column: number };
      startIndex: number;
      endIndex: number;
      children: SyntaxNode[];
      namedChildren: SyntaxNode[];
      childCount: number;
      namedChildCount: number;
      parent: SyntaxNode | null;
      firstChild: SyntaxNode | null;
      lastChild: SyntaxNode | null;
      firstNamedChild: SyntaxNode | null;
      lastNamedChild: SyntaxNode | null;
      nextSibling: SyntaxNode | null;
      previousSibling: SyntaxNode | null;
      nextNamedSibling: SyntaxNode | null;
      previousNamedSibling: SyntaxNode | null;
      childForFieldName(fieldName: string): SyntaxNode | null;
      descendantsOfType(type: string | string[], startPosition?: object, endPosition?: object): SyntaxNode[];
    }
  }

  export = Parser;
}

declare module 'tree-sitter-typescript' {
  import Parser from 'tree-sitter';
  const languages: {
    typescript: Parser.Language;
    tsx: Parser.Language;
  };
  export = languages;
}

declare module 'tree-sitter-javascript' {
  import Parser from 'tree-sitter';
  const language: Parser.Language;
  export = language;
}

declare module 'tree-sitter-python' {
  import Parser from 'tree-sitter';
  const language: Parser.Language;
  export = language;
}

declare module 'xxhash-wasm' {
  interface XXHashAPI {
    h32(input: string, seed?: number): string;
    h64(input: string, seed?: number): string;
    h32Raw(input: Uint8Array, seed?: number): number;
    h64Raw(input: Uint8Array, seed?: number): bigint;
  }
  function xxhash(): Promise<XXHashAPI>;
  export default xxhash;
}
