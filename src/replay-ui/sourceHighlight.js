import { useEffect, useState } from "react";
import * as TreeSitter from "web-tree-sitter";
import parserWasmUrl from "../../node_modules/web-tree-sitter/tree-sitter.wasm?url";
import cssWasmUrl from "../../node_modules/tree-sitter-wasms/out/tree-sitter-css.wasm?url";
import htmlWasmUrl from "../../node_modules/tree-sitter-wasms/out/tree-sitter-html.wasm?url";
import javascriptWasmUrl from "../../node_modules/tree-sitter-wasms/out/tree-sitter-javascript.wasm?url";
import jsonWasmUrl from "../../node_modules/tree-sitter-wasms/out/tree-sitter-json.wasm?url";
import tsxWasmUrl from "../../node_modules/tree-sitter-wasms/out/tree-sitter-tsx.wasm?url";

const encoder = new TextEncoder();
const Parser = TreeSitter.default || TreeSitter["module.exports"] || TreeSitter;
let initialized = null;
const languages = new Map();

function assetPath(url) {
  if (typeof window !== "undefined" || !url.startsWith("/")) return url;
  if (typeof process === "undefined" || !process.cwd) return url;
  return `${process.cwd()}${url}`;
}

const grammars = {
  css: assetPath(cssWasmUrl),
  html: assetPath(htmlWasmUrl),
  javascript: assetPath(javascriptWasmUrl),
  json: assetPath(jsonWasmUrl),
  tsx: assetPath(tsxWasmUrl),
};

const keywordTypes = new Set([
  "as", "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
  "for", "from", "function", "if", "import", "in", "instanceof", "let", "new",
  "of", "return", "static", "switch", "throw", "try", "typeof", "var", "void",
  "while", "with", "yield", "@media", "@keyframes", "@import", "@supports",
]);

const constantTypes = new Set([
  "false", "null", "super", "this", "true", "undefined",
]);

const operatorTypes = new Set([
  "!", "!=", "!==", "%", "%=", "&", "&&", "&=", "*", "**", "**=", "*=", "+",
  "++", "+=", "-", "--", "-=", ".", "...", "/", "/=", ":", "::", "<", "<<",
  "<<=", "<=", "=", "==", "===", "=>", ">", ">=", ">>", ">>=", ">>>", ">>>=",
  "?", "??", "|", "|=", "||", "~",
]);

const punctuationTypes = new Set([
  "(", ")", "[", "]", "{", "}", ",", ";",
]);

function plainLines(source) {
  return source.split("\n").map((text) => [{ text, className: "" }]);
}

function languageName(path = "") {
  if (/\.css$/i.test(path)) return "css";
  if (/\.html?$/i.test(path)) return "html";
  if (/\.json$/i.test(path)) return "json";
  if (/\.[cm]?tsx?$/i.test(path) || /\.jsx$/i.test(path)) return "tsx";
  if (/\.[cm]?jsx?$/i.test(path)) return "javascript";
  return "";
}

async function loadLanguage(name) {
  if (!name || !grammars[name]) return null;
  if (!languages.has(name)) {
    initialized ||= Parser.init({ locateFile: () => assetPath(parserWasmUrl) });
    languages.set(name, initialized.then(() => Parser.Language.load(grammars[name])));
  }
  return languages.get(name);
}

function byteToIndexMap(source) {
  const map = [0];
  let byteOffset = 0;
  for (let index = 0; index < source.length;) {
    const codePoint = source.codePointAt(index);
    const value = String.fromCodePoint(codePoint);
    const nextIndex = index + value.length;
    const bytes = encoder.encode(value).length;
    for (let step = 1; step <= bytes; step += 1) {
      map[byteOffset + step] = nextIndex;
    }
    byteOffset += bytes;
    index = nextIndex;
  }
  return map;
}

function fieldName(node) {
  const parent = node.parent;
  if (!parent) return "";
  if (typeof parent.fieldNameForChild !== "function") return "";
  const index = parent.children.findIndex((child) => child.equals(node));
  return index < 0 ? "" : parent.fieldNameForChild(index) || "";
}

function isField(node, name) {
  const candidate = node.parent?.childForFieldName?.(name);
  return Boolean(candidate?.equals(node));
}

function identifierClass(node) {
  const field = fieldName(node);
  const parent = node.parent?.type || "";
  if (/jsx_(opening|closing|self_closing)_element/.test(parent)) return "syntax-tag";
  if (node.type === "class_name" || node.type === "id_name") return "syntax-class";
  if (field === "tag_name" || node.type === "tag_name") return "syntax-tag";
  if (field === "attribute" || node.type === "attribute_name") return "syntax-property";
  if ((field === "name" || isField(node, "name")) && /class/.test(parent)) return "syntax-class";
  if ((field === "name" || isField(node, "name")) && /(function|method)/.test(parent)) {
    return "syntax-function";
  }
  if (/property|attribute/.test(node.type) || field === "property") return "syntax-property";
  if (/type_identifier|class_name/.test(node.type)) return "syntax-class";
  if (/function|method/.test(node.type)) return "syntax-function";
  return "syntax-variable";
}

function nodeClass(node) {
  const type = node.type;
  if (node.isError) return "syntax-error";
  if (/comment/.test(type)) return "syntax-comment";
  if (/string|template|character|quoted_attribute_value/.test(type)) return "syntax-string";
  if (/regex/.test(type)) return "syntax-regexp";
  if (/number|integer|float|integer_value/.test(type)) return "syntax-number";
  if (constantTypes.has(type)) return "syntax-constant";
  if (type === "plain_value") return "syntax-constant";
  if (keywordTypes.has(type)) return "syntax-keyword";
  if (operatorTypes.has(type)) return "syntax-operator";
  if (punctuationTypes.has(type)) return "syntax-punctuation";
  if (/identifier|selector|class_name|id_name|tag_name|attribute_name|property_name/.test(type)) {
    return identifierClass(node);
  }
  return "";
}

function priority(className) {
  if (className === "syntax-comment") return 8;
  if (className === "syntax-string" || className === "syntax-regexp") return 7;
  if (className === "syntax-error") return 6;
  if (className === "syntax-keyword" || className === "syntax-constant") return 5;
  if (className === "syntax-number") return 4;
  if (className === "syntax-function" || className === "syntax-class") return 3;
  if (className === "syntax-property" || className === "syntax-tag") return 2;
  if (className === "syntax-operator" || className === "syntax-punctuation") return 1;
  return 0;
}

function rangesFromTree(root, source) {
  const byteMap = byteToIndexMap(source);
  const ranges = [];
  const visit = (node) => {
    const className = nodeClass(node);
    const start = byteMap[node.startIndex] ?? node.startIndex;
    const end = byteMap[node.endIndex] ?? node.endIndex;
    if (className && end > start) ranges.push({ className, end, priority: priority(className), start });
    node.children.forEach(visit);
  };
  visit(root);
  return ranges;
}

function classAt(ranges, start, end) {
  const candidates = ranges.filter((range) => range.start <= start && range.end >= end);
  candidates.sort((a, b) => b.priority - a.priority || (a.end - a.start) - (b.end - b.start));
  return candidates[0]?.className || "";
}

function highlightedLines(source, ranges) {
  const boundaries = new Set([0, source.length]);
  ranges.forEach((range) => {
    boundaries.add(range.start);
    boundaries.add(range.end);
  });
  source.split("\n").reduce((offset, line) => {
    boundaries.add(offset);
    boundaries.add(offset + line.length);
    return offset + line.length + 1;
  }, 0);

  const points = [...boundaries].filter((point) => point >= 0 && point <= source.length).sort((a, b) => a - b);
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (end <= start) continue;
    segments.push({ className: classAt(ranges, start, end), text: source.slice(start, end) });
  }

  const lines = [[]];
  segments.forEach((segment) => {
    const parts = segment.text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines.at(-1).push({ className: segment.className, text: part });
    });
  });
  return lines;
}

export async function highlightSource(path, source) {
  const language = await loadLanguage(languageName(path));
  if (!language || !source) return plainLines(source);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  const lines = tree ? highlightedLines(source, rangesFromTree(tree.rootNode, source)) : plainLines(source);
  tree?.delete();
  parser.delete();
  return lines;
}

export function useTreeSitterHighlight(path, source) {
  const [lines, setLines] = useState(() => plainLines(source));
  useEffect(() => {
    let active = true;
    setLines(plainLines(source));
    highlightSource(path, source)
      .then((nextLines) => {
        if (active) setLines(nextLines);
      })
      .catch(() => {
        if (active) setLines(plainLines(source));
      });
    return () => {
      active = false;
    };
  }, [path, source]);
  return lines;
}
