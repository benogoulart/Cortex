import type { FileEntry, Symbol, SymbolKind } from "../types/index.js";

export type ParseMode = "symbols" | "imports" | "all";

export interface Parser {
  parseFile(file: FileEntry, content: string): void;
}

let parserInstance: Parser | null = null;

export function getParser(): Parser {
  if (!parserInstance) {
    parserInstance = createTreeSitterParser();
  }
  return parserInstance;
}

export function setParser(parser: Parser): void {
  parserInstance = parser;
}

function createTreeSitterParser(): Parser {
  try {
    const TreeSitter = require("tree-sitter");
    const TypeScriptLanguage = require("tree-sitter-typescript").typescript;
    const JavaScriptLanguage = require("tree-sitter-javascript");

    const tsParser = new TreeSitter();
    const jsParser = new TreeSitter();

    tsParser.setLanguage(TypeScriptLanguage);
    jsParser.setLanguage(JavaScriptLanguage);

    return {
      parseFile(file: FileEntry, content: string): void {
        const parser = file.language === "typescript" ? tsParser : jsParser;
        const tree = parser.parse(content);
        const root = tree.rootNode;

        file.symbols = extractSymbolsFromAST(root, content);
        file.imports = extractImportsFromAST(root);
        file.exports = extractExportsFromAST(root);
      },
    };
  } catch {
    return createFallbackParser();
  }
}

function extractSymbolsFromAST(root: any, content: string): Symbol[] {
  const symbols: Symbol[] = [];
  const lines = content.split("\n");

  function walk(node: any) {
    const type = node.type;

    if (
      type === "export_statement" ||
      type === "ambient_declaration"
    ) {
      for (const child of node.namedChildren) {
        walkDeclaration(child, symbols, lines, true);
      }
      return;
    }

    if (
      type === "class_declaration" ||
      type === "function_declaration" ||
      type === "interface_declaration" ||
      type === "type_alias_declaration" ||
      type === "enum_declaration" ||
      type === "lexical_declaration" ||
      type === "variable_declaration" ||
      type === "method_definition" ||
      type === "arrow_function" ||
      type === "function"
    ) {
      walkDeclaration(node, symbols, lines, false);
      return;
    }

    if (type === "class_body" || type === "statement_block" || type === "program") {
      for (const child of node.namedChildren) {
        walk(child);
      }
      return;
    }

    if (type === "class_declaration") {
      const body = node.childForFieldName("body");
      if (body) {
        for (const child of body.namedChildren) {
          walk(child);
        }
      }
      return;
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  function walkDeclaration(
    node: any,
    symbols: Symbol[],
    lines: string[],
    exported: boolean
  ) {
    const type = node.type;
    const line = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    const nameNode =
      node.childForFieldName("name") ??
      node.namedChildren.find(
        (c: any) =>
          c.type === "identifier" ||
          c.type === "type_identifier" ||
          c.type === "property_identifier"
      );

    const name = nameNode?.text ?? "<anonymous>";

    let kind: SymbolKind | null = null;
    let signature: string | undefined;

    switch (type) {
      case "class_declaration":
      case "class":
        kind = "class";
        break;
      case "function_declaration":
      case "function":
        kind = "function";
        signature = extractFunctionSignature(node, lines);
        break;
      case "interface_declaration":
        kind = "interface";
        break;
      case "type_alias_declaration":
        kind = "type";
        break;
      case "enum_declaration":
        kind = "enum";
        break;
      case "lexical_declaration":
      case "variable_declaration": {
        const decl = node.namedChildren[0];
        if (decl?.type === "lexical_pattern" || decl?.type === "variable_declarator") {
          const init = decl.childForFieldName("value");
          if (init?.type === "arrow_function" || init?.type === "function") {
            kind = "function";
            signature = extractFunctionSignature(init, lines);
          } else {
            kind = exported ? "constant" : "variable";
          }
        } else {
          kind = exported ? "constant" : "variable";
        }
        break;
      }
      case "method_definition":
        kind = "method";
        signature = extractFunctionSignature(node, lines);
        break;
      default:
        return;
    }

    symbols.push({
      name,
      kind,
      line,
      endLine,
      exported,
      signature,
    });
  }

  walk(root);
  return symbols;
}

function extractFunctionSignature(node: any, lines: string[]): string | undefined {
  const startLine = node.startPosition.row;
  const endLine = node.endPosition.row;
  if (endLine - startLine > 3) return undefined;
  return lines.slice(startLine, endLine + 1).join(" ").trim();
}

function extractImportsFromAST(root: any): string[] {
  const imports: string[] = [];

  function walk(node: any) {
    if (node.type === "import_statement") {
      const sourceNode = node.namedChildren.find(
        (c: any) => c.type === "string" || c.type === "import_specifier"
      );
      if (sourceNode) {
        const text = sourceNode.text.replace(/['"]/g, "");
        imports.push(text);
      }
    }

    if (node.type === "call_expression") {
      const funcNode = node.namedChildren[0];
      if (funcNode?.text === "require") {
        const argNode = node.namedChildren[1];
        if (argNode?.type === "arguments") {
          const strNode = argNode.namedChildren[0];
          if (strNode?.type === "string") {
            imports.push(strNode.text.replace(/['"]/g, ""));
          }
        }
      }
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(root);
  return imports;
}

function extractExportsFromAST(root: any): string[] {
  const exports: string[] = [];

  function walk(node: any) {
    if (node.type === "export_statement") {
      for (const child of node.namedChildren) {
        if (
          child.type === "function_declaration" ||
          child.type === "class_declaration" ||
          child.type === "interface_declaration" ||
          child.type === "type_alias_declaration" ||
          child.type === "enum_declaration"
        ) {
          const nameNode =
            child.childForFieldName("name") ??
            child.namedChildren.find(
              (c: any) =>
                c.type === "identifier" || c.type === "type_identifier"
            );
          if (nameNode) {
            exports.push(nameNode.text);
          }
        }

        if (child.type === "export_clause") {
          for (const spec of child.namedChildren) {
            if (spec.type === "export_specifier") {
              const nameNode = spec.namedChildren.find(
                (c: any) => c.type === "identifier" || c.type === "type_identifier"
              );
              if (nameNode) {
                exports.push(nameNode.text);
              }
            }
          }
        }
      }

      const sourceNode = node.namedChildren.find(
        (c: any) => c.type === "string"
      );
      if (sourceNode) {
        exports.push(`* from ${sourceNode.text.replace(/['"]/g, "")}`);
      }
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(root);
  return exports;
}

function createFallbackParser(): Parser {
  return {
    parseFile(file: FileEntry, content: string): void {
      file.symbols = extractSymbolsFallback(content);
      file.imports = extractImportsFallback(content);
      file.exports = extractExportsFallback(content);
    },
  };
}

function extractSymbolsFallback(content: string): FileEntry["symbols"] {
  const symbols: FileEntry["symbols"] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const classMatch = line.match(
      /^(export\s+)?(abstract\s+)?class\s+(\w+)/
    );
    if (classMatch) {
      symbols.push({
        name: classMatch[3],
        kind: "class",
        line: lineNum,
        exported: !!classMatch[1],
      });
      continue;
    }

    const interfaceMatch = line.match(/^(export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[2],
        kind: "interface",
        line: lineNum,
        exported: !!interfaceMatch[1],
      });
      continue;
    }

    const typeMatch = line.match(/^(export\s+)?type\s+(\w+)/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[2],
        kind: "type",
        line: lineNum,
        exported: !!typeMatch[1],
      });
      continue;
    }

    const enumMatch = line.match(/^(export\s+)?(const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[3],
        kind: "enum",
        line: lineNum,
        exported: !!enumMatch[1],
      });
      continue;
    }

    const fnMatch = line.match(
      /^(export\s+)?(async\s+)?function\s+(\w+)/
    );
    if (fnMatch) {
      symbols.push({
        name: fnMatch[3],
        kind: "function",
        line: lineNum,
        exported: !!fnMatch[1],
      });
      continue;
    }

    const constMatch = line.match(
      /^(export\s+)?(const|let|var)\s+(\w+)\s*[=:]/
    );
    if (constMatch) {
      symbols.push({
        name: constMatch[3],
        kind: constMatch[2] === "const" ? "constant" : "variable",
        line: lineNum,
        exported: !!constMatch[1],
      });
      continue;
    }
  }

  return symbols;
}

function extractImportsFallback(content: string): string[] {
  const imports: string[] = [];
  const importRegex =
    /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
  const requireRegex =
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

function extractExportsFallback(content: string): string[] {
  const exports: string[] = [];
  const exportRegex =
    /^export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/gm;

  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }

  const reExportRegex = /^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm;
  while ((match = reExportRegex.exec(content)) !== null) {
    exports.push(`* from ${match[1]}`);
  }

  return exports;
}
