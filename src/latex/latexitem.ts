import type { Editor } from "obsidian";

export type LatexItem = {
  display: string;
  value: string;
  offset?: number;
};

export const PREDEFINED_LATEX: Array<LatexItem> = [
  { display: "Expectation", value: "\\mathbb{E}" },
  { display: "Variance", value: "\\mathbb{V}" },
  { display: "Paranthesis", value: "\\left( \\right)", offset: 6 },
];

export const insertLatexItem = (item: LatexItem, editor: Editor) => {
  const cursor = editor.getCursor("from");

  editor.replaceRange(item.value, cursor, cursor);

  editor.focus();

  const offset = item.offset ?? item.value.length;
  editor.setCursor({
    line: cursor.line,
    ch: cursor.ch + offset,
  });
};
