import { useEffect, useMemo, useRef, useState } from "react";
import { SplitLayout } from "./SplitLayout";
import { LatexEditor, type LatexEditorHandle } from "./LatexEditor";
import { PdfPreview } from "./PdfPreview";
import { computeLocalDiagnostics, type DiagnosticItem } from "../lib/latexLint";
import { registerActiveEditor } from "../lib/activeEditor";
import type { CompileDiagnostic } from "../types/global";

type Status = "editing" | "compiling" | "updated" | "error";

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
  const [status, setStatus] = useState<Status>("editing");
  const [errors, setErrors] = useState<string[]>([]);
  const [compileDiagnostics, setCompileDiagnostics] = useState<CompileDiagnostic[]>([]);
  const [missingEngine, setMissingEngine] = useState(false);
  const [missingPackage, setMissingPackage] = useState<string | null>(null);
  const [autoCompile, setAutoCompile] = useState(() => readBoolPref(`${storageKey}:autoCompile`, true));
  const [pdfSaveState, setPdfSaveState] = useState<"idle" | "working" | "success" | "error">("idle");
  const [pdfSaveMessage, setPdfSaveMessage] = useState<string | null>(null);
  const [savedPdfPath, setSavedPdfPath] = useState<string | null>(null);

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
        setErrors([]);
        setCompileDiagnostics(result.diagnostics ?? []);
        setStatus("updated");
      } else {
        setErrors(result.errors ?? []);
        setMissingEngine(Boolean(result.missingEngine));
        setMissingPackage(result.missingPackage ?? null);
        setCompileDiagnostics(result.diagnostics ?? []);
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

  return (
    <SplitLayout
      storageKey={storageKey}
      left={
        <div className="workspace-left">
          <div className="workspace-toolbar">
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
          <LatexEditor ref={editorRef} value={code} onChange={onChange} diagnostics={mergedDiagnostics} />
          {mergedDiagnostics.length > 0 && (
            <div className="workspace-error-panel">
              <div className="workspace-error-panel-title">
                {mergedDiagnostics.filter((d) => d.severity === "error").length} erro(s),{" "}
                {mergedDiagnostics.filter((d) => d.severity === "warning").length} aviso(s)
              </div>
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
            </div>
          )}
        </div>
      }
      right={
        <div className="workspace-right">
          <PdfPreview pdfData={pdfData} />
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
              Pacote <code>{missingPackage}</code> não está instalado.{" "}
              <button onClick={() => onGoToPackage?.(missingPackage)}>Instalar pacote</button>
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
