import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { linter, lintGutter, forceLinting, type Diagnostic } from "@codemirror/lint";
import type { DiagnosticItem } from "../lib/latexLint";

export interface LatexEditorHandle {
  scrollToLine: (line: number) => void;
}

interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics?: DiagnosticItem[];
}

export const LatexEditor = forwardRef<LatexEditorHandle, LatexEditorProps>(function LatexEditor(
  { value, onChange, diagnostics },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const diagnosticsRef = useRef<DiagnosticItem[]>(diagnostics ?? []);

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
      }
    }),
    []
  );

  useEffect(() => {
    if (!hostRef.current) return;

    const lintSource = (view: EditorView): Diagnostic[] => {
      const docLines = view.state.doc.lines;
      return diagnosticsRef.current
        .filter((d) => d.line != null && d.line >= 1 && d.line <= docLines)
        .map((d) => {
          const line = view.state.doc.line(d.line as number);
          return { from: line.from, to: line.to, severity: d.severity, message: d.message };
        });
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        StreamLanguage.define(stex),
        EditorView.lineWrapping,
        lintGutter(),
        linter(lintSource, { delay: 250 }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
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

  return <div className="latex-editor" ref={hostRef} />;
});
