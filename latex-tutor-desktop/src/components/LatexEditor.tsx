import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorView, ViewUpdate, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { history, historyKeymap, defaultKeymap, indentWithTab, undo, redo } from "@codemirror/commands";
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap, StreamLanguage } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  acceptCompletion,
  selectedCompletion,
  type CompletionContext,
  type CompletionResult
} from "@codemirror/autocomplete";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { linter, lintGutter, forceLinting, type Diagnostic } from "@codemirror/lint";
import type { DiagnosticItem } from "../lib/latexLint";
import { suggestCommands, recordCommandUsage } from "../lib/latexCommands";
import { getEditorSettings, subscribeEditorSettings } from "../lib/editorSettings";

export interface LatexEditorHandle {
  scrollToLine: (line: number) => void;
  undo: () => void;
  redo: () => void;
  insertAtCursor: (text: string) => void;
}

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics?: DiagnosticItem[];
  getImageNames?: () => string[];
}

function acceptCompletionAndRecord(view: EditorView): boolean {
  const sel = selectedCompletion(view.state);
  const accepted = acceptCompletion(view);
  if (accepted && sel) recordCommandUsage(sel.label);
  return accepted;
}

function makeCompletionSource(getImageNames?: () => string[]) {
  return function completionSource(context: CompletionContext): CompletionResult | null {
    const imgMatch = context.matchBefore(/\\includegraphics(?:\[[^\]]*\])?\{[^}]*/);
    if (imgMatch && getImageNames) {
      const braceIdx = imgMatch.text.lastIndexOf("{");
      const partial = imgMatch.text.slice(braceIdx + 1);
      const from = imgMatch.from + braceIdx + 1;
      const names = getImageNames().filter((n) => n.toLowerCase().includes(partial.toLowerCase()));
      if (names.length === 0 && !context.explicit) return null;
      return { from, options: names.map((n) => ({ label: n, type: "file" })), filter: false };
    }

    const word = context.matchBefore(/\\[a-zA-Z]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    const options = suggestCommands(word.text).map((cmd) => ({ label: cmd, type: "keyword" }));
    if (options.length === 0) return null;
    return { from: word.from, options, filter: false };
  };
}

// Best-effort MRU tracking for commands typed out by hand (not just accepted
// from the completion popup): if the user just typed the "{" that closes off
// a \command, treat that as "used" too.
function detectManualCommandUsage(update: ViewUpdate) {
  const insertedText = update.state.sliceDoc(
    update.state.selection.main.from - 1,
    update.state.selection.main.from
  );
  if (insertedText !== "{") return;
  const before = update.state.sliceDoc(Math.max(0, update.state.selection.main.from - 40), update.state.selection.main.from - 1);
  const m = before.match(/\\([a-zA-Z]+)$/);
  if (m) recordCommandUsage(`\\${m[1]}`);
}

export const LatexEditor = forwardRef<LatexEditorHandle, LatexEditorProps>(function LatexEditor(
  { value, onChange, diagnostics, getImageNames },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const diagnosticsRef = useRef<DiagnosticItem[]>(diagnostics ?? []);
  const closeBracketsCompartment = useRef(new Compartment()).current;
  const tabCompletionCompartment = useRef(new Compartment()).current;

  useImperativeHandle(
    ref,
    () => ({
      scrollToLine(lineNumber: number) {
        const view = viewRef.current;
        if (!view) return;
        const clamped = Math.min(Math.max(1, lineNumber), view.state.doc.lines);
        const line = view.state.doc.line(clamped);
        view.dispatch({
          selection: { anchor: line.from, head: line.to },
          effects: EditorView.scrollIntoView(line.from, { y: "center" })
        });
        view.focus();
      },
      undo() {
        if (viewRef.current) undo(viewRef.current);
      },
      redo() {
        if (viewRef.current) redo(viewRef.current);
      },
      insertAtCursor(text: string) {
        const view = viewRef.current;
        if (!view) return;
        const pos = view.state.selection.main.head;
        view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } });
        view.focus();
      }
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current) return;

    const settings = getEditorSettings();
    const lintSource = (view: EditorView): Diagnostic[] => {
      const docLines = view.state.doc.lines;
      return diagnosticsRef.current
        .filter((d) => d.line != null && d.line >= 1 && d.line <= docLines)
        .map((d) => {
          const line = view.state.doc.line(d.line as number);
          return { from: line.from, to: line.to, severity: d.severity, message: d.message };
        });
    };

    const tabCompletionExtension = () => [
      autocompletion({ override: [makeCompletionSource(getImageNames)] }),
      keymap.of([{ key: "Tab", run: acceptCompletionAndRecord }])
    ];

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBracketsCompartment.of(settings.autoCloseBrackets ? closeBrackets() : []),
        tabCompletionCompartment.of(settings.tabAutocomplete ? tabCompletionExtension() : autocompletion()),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        StreamLanguage.define(stex),
        EditorView.lineWrapping,
        lintGutter(),
        linter(lintSource, { delay: 250 }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            detectManualCommandUsage(update);
            onChangeRef.current(update.state.doc.toString());
          }
        })
      ]
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor in sync when `value` changes from outside (e.g. switching
  // lessons or opening a different free-mode file), without fighting the
  // user's own typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value }
      });
    }
  }, [value]);

  useEffect(() => {
    diagnosticsRef.current = diagnostics ?? [];
    const view = viewRef.current;
    if (view) forceLinting(view);
  }, [diagnostics]);

  useEffect(() => {
    return subscribeEditorSettings((settings) => {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: [
          closeBracketsCompartment.reconfigure(settings.autoCloseBrackets ? closeBrackets() : []),
          tabCompletionCompartment.reconfigure(
            settings.tabAutocomplete
              ? [autocompletion({ override: [makeCompletionSource(getImageNames)] }), keymap.of([{ key: "Tab", run: acceptCompletionAndRecord }])]
              : autocompletion()
          )
        ]
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="latex-editor" ref={hostRef} />;
});
