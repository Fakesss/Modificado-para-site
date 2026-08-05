import { useEffect, useMemo, useRef, useState } from "react";
import { SplitLayout } from "./SplitLayout";
import { LatexEditor, type LatexEditorHandle } from "./LatexEditor";
import { PdfPreview } from "./PdfPreview";
import { computeLocalDiagnostics, type DiagnosticItem } from "../lib/latexLint";
import { registerActiveEditor } from "../lib/activeEditor";
import { getImageNames } from "../lib/imageBank";
import { isPdfWindowDetached, subscribePdfWindowState, sendPdfData, closePdfWindow } from "../lib/pdfWindow";
import type { CompileDiagnostic } from "../types/global";

type Status = "editing" | "compiling" | "updated" | "error";
type ErrorPanelMode = "expanded" | "minimized" | "hidden";
type InlineInstallState = "idle" | "installing" | "success" | "error";

interface WorkspaceProps {
  storageKey: string;
  jobKey: string;
  code: string;
  onChange: (value: string) => void;
  engine?: "pdflatex" | "xelatex";
  mainFileName?: string;
  isActive?: boolean;
  suggestedPdfName?: string;
  onGoToPackage?: (packageName: string) => void;
}

function readBoolPref(key: string, fallback: boolean) {
  const saved = localStorage.getItem(key);
  return saved === null ? fallback : saved === "1";
}

function findUsepackageLine(code: string, pkgName: string): number | null {
  const lines = code.split("\n");
  const re = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{\\s*${pkgName}\\s*\\}`);
  const idx = lines.findIndex((line) => re.test(line));
  return idx === -1 ? null : idx + 1;
}

interface HistoryEntry {
  id: number;
  time: number;
  code: string;
  preview: string;
}

// Summarize a snapshot by showing the line where it first diverges from the
// previous snapshot — cheap to compute and usually points at the actual edit,
// without needing a real diff algorithm.
function summarizeChange(previousCode: string, code: string): string {
  let i = 0;
  const len = Math.min(previousCode.length, code.length);
  while (i < len && previousCode[i] === code[i]) i++;
  const lineStart = code.lastIndexOf("\n", i) + 1;
  let lineEnd = code.indexOf("\n", i);
  if (lineEnd === -1) lineEnd = code.length;
  const line = code.slice(lineStart, lineEnd).trim();
  return line || "(linha em branco)";
}

function relativeTime(timestamp: number): string {
  const diffSeconds = Math.round((Date.now() - timestamp) / 1000);
  if (diffSeconds < 5) return "agora mesmo";
  if (diffSeconds < 60) return `há ${diffSeconds} s`;
  if (diffSeconds < 3600) return `há ${Math.round(diffSeconds / 60)} min`;
  if (diffSeconds < 86400) return `há ${Math.round(diffSeconds / 3600)} h`;
  return `há ${Math.round(diffSeconds / 86400)} d`;
}

export function Workspace({
  storageKey,
  jobKey,
  code,
  onChange,
  engine = "pdflatex",
  mainFileName = "main.tex",
  isActive = true,
  suggestedPdfName,
  onGoToPackage
}: WorkspaceProps) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfDetached, setPdfDetached] = useState(isPdfWindowDetached());
  const [status, setStatus] = useState<Status>("editing");
  const [errors, setErrors] = useState<string[]>([]);
  const [compileDiagnostics, setCompileDiagnostics] = useState<CompileDiagnostic[]>([]);
  const [missingEngine, setMissingEngine] = useState(false);
  const [missingPackage, setMissingPackage] = useState<string | null>(null);
  const [incompatiblePackage, setIncompatiblePackage] = useState<string | null>(null);
  const [autoCompile, setAutoCompile] = useState(() => readBoolPref(`${storageKey}:autoCompile`, true));
  const [pdfSaveState, setPdfSaveState] = useState<"idle" | "working" | "success" | "error">("idle");
  const [pdfSaveMessage, setPdfSaveMessage] = useState<string | null>(null);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);

  const [errorPanelMode, setErrorPanelMode] = useState<ErrorPanelMode>(
    () => (localStorage.getItem(`${storageKey}:errorPanelMode`) as ErrorPanelMode) || "expanded"
  );
  const [autoOpenErrors, setAutoOpenErrors] = useState(() => readBoolPref(`${storageKey}:autoOpenErrors`, true));
  const hadDiagnosticsRef = useRef(false);

  const [inlineInstall, setInlineInstall] = useState<{ name: string; state: InlineInstallState; log: string } | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const lastSnapshotRef = useRef(code);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  const requestIdRef = useRef(0);
  const editorRef = useRef<LatexEditorHandle>(null);

  const localDiagnostics = useMemo(() => computeLocalDiagnostics(code), [code]);
  const mergedDiagnostics: DiagnosticItem[] = useMemo(
    () => [...localDiagnostics, ...compileDiagnostics],
    [localDiagnostics, compileDiagnostics]
  );

  async function compile() {
    const requestId = ++requestIdRef.current;
    setStatus("compiling");
    try {
      const result = await window.api.compile({
        jobKey,
        files: { [mainFileName]: codeRef.current },
        mainFileName,
        engine
      });
      if (result.cancelled || requestId !== requestIdRef.current) return; // superseded by a newer edit

      if (result.success && result.pdf) {
        setPdfData(new Uint8Array(result.pdf));
        setMissingEngine(false);
        setMissingPackage(null);
        setIncompatiblePackage(null);
        setErrors([]);
        setCompileDiagnostics(result.diagnostics ?? []);
        setStatus("updated");
      } else {
        setErrors(result.errors ?? []);
        setMissingEngine(Boolean(result.missingEngine));
        const missing = result.missingPackage ?? null;
        setMissingPackage(missing);
        setIncompatiblePackage(missing ? null : result.incompatiblePackage ?? null);

        // Surface the offending \usepackage{} line itself as a diagnostic, so
        // the editor highlights exactly what's wrong instead of only a banner.
        const extraDiagnostics: CompileDiagnostic[] = [...(result.diagnostics ?? [])];
        const badPkg = missing ?? result.incompatiblePackage ?? null;
        if (badPkg) {
          const line = findUsepackageLine(codeRef.current, badPkg);
          if (line != null) {
            extraDiagnostics.push({
              line,
              severity: "error",
              message: missing
                ? `Pacote "${badPkg}" não está instalado.`
                : `Pacote "${badPkg}" está instalado, mas não é compatível com o motor de compilação atual (${engine}).`,
              rawMessage: ""
            });
          }
        }
        setCompileDiagnostics(extraDiagnostics);
        setStatus("error");
      }
    } catch {
      if (requestId !== requestIdRef.current) return;
      setStatus("error");
    }
  }

  useEffect(() => {
    setStatus("editing");
    // Compiler-reported line markers can go stale the instant the user types
    // again (line numbers shift), so drop them immediately and let the fresh
    // compile replace them; the local static checks stay live in the meantime.
    setCompileDiagnostics([]);
    if (!autoCompile) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => compile(), 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mainFileName, autoCompile]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:autoCompile`, autoCompile ? "1" : "0");
  }, [autoCompile, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:errorPanelMode`, errorPanelMode);
  }, [errorPanelMode, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:autoOpenErrors`, autoOpenErrors ? "1" : "0");
  }, [autoOpenErrors, storageKey]);

  useEffect(() => subscribePdfWindowState(setPdfDetached), []);

  // Only the tab the user is actually looking at should drive the detached
  // popout window's contents — otherwise a background auto-compile in a
  // hidden tab would silently replace what's showing in the floating window.
  // Re-sends on `pdfDetached` too: a compile that finished before the popout
  // even existed would otherwise never reach it, since sending only happens
  // when `pdfData` itself changes.
  useEffect(() => {
    if (isActive) sendPdfData(pdfData);
  }, [pdfData, isActive, pdfDetached]);

  // Record a version-history checkpoint once the user pauses for a bit,
  // rather than on every keystroke — gives a browsable trail of past states
  // to fall back to, on top of CodeMirror's own linear undo/redo stack.
  useEffect(() => {
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      if (code !== lastSnapshotRef.current && code.trim().length > 0) {
        const preview = summarizeChange(lastSnapshotRef.current, code);
        lastSnapshotRef.current = code;
        setHistoryEntries((prev) => [{ id: Date.now(), time: Date.now(), code, preview }, ...prev].slice(0, 15));
      }
    }, 2500);
    return () => {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, [code]);

  useEffect(() => {
    if (!historyOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (historyPanelRef.current && !historyPanelRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [historyOpen]);

  function restoreSnapshot(entry: HistoryEntry) {
    if (code !== lastSnapshotRef.current) {
      const preview = summarizeChange(lastSnapshotRef.current, code);
      setHistoryEntries((prev) => [{ id: Date.now(), time: Date.now(), code, preview }, ...prev].slice(0, 15));
    }
    lastSnapshotRef.current = entry.code;
    onChange(entry.code);
    setHistoryOpen(false);
  }

  // Only pop the panel open automatically the instant it goes from "no
  // problems" to "some problems" — never fight the user's own minimize/close.
  useEffect(() => {
    const hasNow = mergedDiagnostics.length > 0;
    if (hasNow && !hadDiagnosticsRef.current && autoOpenErrors) {
      setErrorPanelMode("expanded");
    }
    hadDiagnosticsRef.current = hasNow;
  }, [mergedDiagnostics.length, autoOpenErrors]);

  // Register as "the current document" for the Pacotes tab's \usepackage{}
  // insert action, but only while this Workspace is the one the user is
  // actually looking at.
  useEffect(() => {
    if (!isActive) return;
    registerActiveEditor({
      engine,
      addPackage: (pkgName: string) => {
        const already = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{\\s*${pkgName}\\s*\\}`).test(codeRef.current);
        if (already) return { added: false, alreadyPresent: true };
        const lines = codeRef.current.split("\n");
        let insertAt = 0;
        let lastUsepackage = -1;
        let docClassLine = -1;
        lines.forEach((line, idx) => {
          if (/^\s*\\usepackage/.test(line)) lastUsepackage = idx;
          if (docClassLine === -1 && /^\s*\\documentclass/.test(line)) docClassLine = idx;
        });
        insertAt = lastUsepackage !== -1 ? lastUsepackage + 1 : docClassLine !== -1 ? docClassLine + 1 : 0;
        lines.splice(insertAt, 0, `\\usepackage{${pkgName}}`);
        onChange(lines.join("\n"));
        return { added: true, alreadyPresent: false };
      },
      insertSnippet: (snippet: string) => {
        onChange(codeRef.current ? `${codeRef.current}\n\n${snippet}\n` : snippet);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, engine]);

  useEffect(() => {
    const off = window.api.packages.onInstallProgress(({ name, chunk }) => {
      setInlineInstall((prev) => (prev && prev.name === name ? { ...prev, log: prev.log + chunk } : prev));
    });
    return off;
  }, []);

  async function installMissingPackageInline(name: string) {
    setInlineInstall({ name, state: "installing", log: "" });
    const result = await window.api.packages.install(name);
    if (result.success) {
      setInlineInstall({ name, state: "success", log: result.message });
      compile(); // recompile automatically now that the package should be available
    } else {
      setInlineInstall({ name, state: "error", log: result.message });
    }
  }

  async function handleDownloadPdf() {
    setPdfSaveState("working");
    setPdfSaveMessage(null);
    try {
      const result = await window.api.compile({
        jobKey: `${jobKey}:export`,
        files: { [mainFileName]: codeRef.current },
        mainFileName,
        engine
      });
      if (!result.success || !result.pdf) {
        setPdfSaveState("error");
        setPdfSaveMessage("Não foi possível gerar o PDF porque o documento tem erros que impedem a compilação.");
        return;
      }
      const suggested = suggestedPdfName ?? mainFileName.replace(/\.tex$/, "");
      const saveResult = await window.api.pdf.save(new Uint8Array(result.pdf), suggested);
      if (saveResult.cancelled) {
        setPdfSaveState("idle");
        return;
      }
      if (!saveResult.success) {
        setPdfSaveState("error");
        setPdfSaveMessage(saveResult.message ?? "Não foi possível salvar o arquivo.");
        return;
      }
      setSavedPdfPath(saveResult.filePath ?? null);
      setPdfSaveState("success");
    } catch (err) {
      setPdfSaveState("error");
      setPdfSaveMessage(String(err));
    }
  }

  const statusLabel: Record<Status, string> = {
    editing: "Editando…",
    compiling: "Compilando…",
    updated: "Atualizado",
    error: "Erro"
  };

  const errorCount = mergedDiagnostics.filter((d) => d.severity === "error").length;
  const warningCount = mergedDiagnostics.filter((d) => d.severity === "warning").length;
  const diagnosticsSummary = `${errorCount} erro(s), ${warningCount} aviso(s)`;

  return (
    <SplitLayout
      storageKey={storageKey}
      left={
        <div className="workspace-left">
          <div className="workspace-toolbar">
            <div className="workspace-undo-redo">
              <button title="Desfazer (Ctrl+Z)" onClick={() => editorRef.current?.undo()}>
                ↶
              </button>
              <button title="Refazer (Ctrl+Y)" onClick={() => editorRef.current?.redo()}>
                ↷
              </button>
            </div>
            <div className="workspace-history" ref={historyPanelRef}>
              <button
                className="workspace-history-toggle"
                title="Histórico de versões recentes"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                🕘 Histórico
              </button>
              {historyOpen && (
                <div className="workspace-history-panel">
                  {historyEntries.length === 0 ? (
                    <div className="workspace-history-empty">Nenhuma alteração registrada ainda.</div>
                  ) : (
                    <ul>
                      {historyEntries.map((entry) => (
                        <li key={entry.id}>
                          <button onClick={() => restoreSnapshot(entry)}>
                            <span className="workspace-history-time">{relativeTime(entry.time)}</span>
                            <span className="workspace-history-preview">{entry.preview}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <button onClick={compile} disabled={status === "compiling"}>
              ▶ Atualizar
            </button>
            <label className="workspace-autocompile-toggle">
              <input type="checkbox" checked={autoCompile} onChange={(e) => setAutoCompile(e.target.checked)} />
              Compilar automaticamente
            </label>
            <span className={`workspace-status workspace-status-${status}`}>
              <span className="workspace-status-dot" />
              {statusLabel[status]}
            </span>
            <div className="workspace-download">
              <button onClick={handleDownloadPdf} disabled={pdfSaveState === "working"}>
                {pdfSaveState === "working" ? "Gerando PDF…" : "⬇ Baixar PDF"}
              </button>
              {pdfSaveState === "success" && savedPdfPath && (
                <span className="workspace-download-feedback success">
                  PDF salvo!
                  <button onClick={() => window.api.pdf.open(savedPdfPath)}>Abrir</button>
                  <button onClick={() => window.api.pdf.reveal(savedPdfPath)}>Mostrar na pasta</button>
                </span>
              )}
              {pdfSaveState === "error" && <span className="workspace-download-feedback error">{pdfSaveMessage}</span>}
            </div>
          </div>
          <LatexEditor ref={editorRef} value={code} onChange={onChange} diagnostics={mergedDiagnostics} getImageNames={getImageNames} />

          {mergedDiagnostics.length > 0 && errorPanelMode === "hidden" && (
            <button className="workspace-error-indicator" onClick={() => setErrorPanelMode("expanded")}>
              ⚠ {diagnosticsSummary} — clique para ver detalhes
            </button>
          )}

          {mergedDiagnostics.length > 0 && errorPanelMode !== "hidden" && (
            <div className="workspace-error-panel">
              <div className="workspace-error-panel-header">
                <span className="workspace-error-panel-title">{diagnosticsSummary}</span>
                <label className="workspace-error-panel-autoopen">
                  <input type="checkbox" checked={autoOpenErrors} onChange={(e) => setAutoOpenErrors(e.target.checked)} />
                  Abrir automaticamente
                </label>
                <div className="workspace-error-panel-controls">
                  <button
                    onClick={() => setErrorPanelMode(errorPanelMode === "minimized" ? "expanded" : "minimized")}
                    title={errorPanelMode === "minimized" ? "Expandir" : "Minimizar"}
                  >
                    {errorPanelMode === "minimized" ? "▾" : "▁"}
                  </button>
                  <button onClick={() => setErrorPanelMode("hidden")} title="Fechar">
                    ✕
                  </button>
                </div>
              </div>
              {errorPanelMode === "expanded" && (
                <ul>
                  {mergedDiagnostics.map((d, i) => (
                    <li key={i} className={`workspace-error-item severity-${d.severity}`}>
                      <button
                        onClick={() => d.line != null && editorRef.current?.scrollToLine(d.line)}
                        disabled={d.line == null}
                      >
                        {d.line != null ? `Linha ${d.line}` : "—"}: {d.message}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      }
      right={
        <div className="workspace-right">
          {pdfDetached && isActive ? (
            <div className="workspace-pdf-detached-placeholder">
              <p>📤 A pré-visualização está aberta em outra janela.</p>
              <button onClick={closePdfWindow}>🗗 Reencaixar aqui</button>
            </div>
          ) : (
            <PdfPreview pdfData={pdfData} />
          )}
          {status === "error" && pdfData && (
            <div className="banner banner-warning">Mostrando a última versão válida — o código atual tem erros.</div>
          )}
          {missingEngine && (
            <div className="banner banner-warning">
              Nenhum motor LaTeX foi encontrado. Vá em <strong>Configuração</strong> para instalar.
            </div>
          )}
          {missingPackage && (
            <div className="banner banner-warning">
              <div>
                Pacote <code>{missingPackage}</code> não está instalado — por isso a compilação falhou.
              </div>
              {inlineInstall?.name === missingPackage && inlineInstall.state === "installing" && (
                <div className="workspace-inline-install-progress">Instalando {missingPackage}…</div>
              )}
              {inlineInstall?.name === missingPackage && inlineInstall.state === "success" && (
                <div className="workspace-inline-install-progress success">✔ Instalado! Recompilando…</div>
              )}
              {inlineInstall?.name === missingPackage && inlineInstall.state === "error" && (
                <div className="workspace-inline-install-progress error">✕ Falhou: {inlineInstall.log}</div>
              )}
              {(!inlineInstall || inlineInstall.name !== missingPackage || inlineInstall.state === "error") && (
                <div className="lessons-actions-row">
                  <button onClick={() => installMissingPackageInline(missingPackage)}>Instalar agora</button>
                  <button onClick={() => onGoToPackage?.(missingPackage)}>Ver na aba Pacotes</button>
                </div>
              )}
            </div>
          )}
          {incompatiblePackage && (
            <div className="banner banner-warning">
              Pacote <code>{incompatiblePackage}</code> está instalado, mas não é compatível com o motor de compilação
              atual (<code>{engine}</code>). Ele precisa de XeLaTeX ou LuaLaTeX — instalar de novo não vai resolver.
            </div>
          )}
          {errors.length > 0 && (
            <div className="banner banner-error">
              <strong>Log de compilação:</strong>
              <pre>{errors.join("\n\n")}</pre>
            </div>
          )}
        </div>
      }
    />
  );
}
