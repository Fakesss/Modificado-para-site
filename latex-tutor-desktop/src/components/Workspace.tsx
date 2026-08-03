import { useEffect, useRef, useState } from "react";
import { SplitLayout } from "./SplitLayout";
import { LatexEditor } from "./LatexEditor";
import { PdfPreview } from "./PdfPreview";

interface WorkspaceProps {
  storageKey: string;
  code: string;
  onChange: (value: string) => void;
  engine?: "pdflatex" | "xelatex";
  mainFileName?: string;
  autoCompile?: boolean;
  onGoToPackage?: (packageName: string) => void;
}

export function Workspace({
  storageKey,
  code,
  onChange,
  engine = "pdflatex",
  mainFileName = "main.tex",
  autoCompile = true,
  onGoToPackage
}: WorkspaceProps) {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [missingEngine, setMissingEngine] = useState(false);
  const [missingPackage, setMissingPackage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  async function compile() {
    setCompiling(true);
    setErrors([]);
    setMissingPackage(null);
    try {
      const result = await window.api.compile({
        files: { [mainFileName]: codeRef.current },
        mainFileName,
        engine
      });
      if (result.success && result.pdf) {
        setPdfData(new Uint8Array(result.pdf));
        setMissingEngine(false);
      } else {
        setErrors(result.errors ?? []);
        setMissingEngine(Boolean(result.missingEngine));
        setMissingPackage(result.missingPackage ?? null);
      }
    } finally {
      setCompiling(false);
    }
  }

  useEffect(() => {
    if (!autoCompile) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => compile(), 900);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mainFileName]);

  return (
    <SplitLayout
      storageKey={storageKey}
      left={
        <div className="workspace-left">
          <div className="workspace-toolbar">
            <button onClick={compile} disabled={compiling}>
              {compiling ? "Compilando..." : "▶ Compilar"}
            </button>
            <span className="workspace-toolbar-hint">
              {autoCompile ? "Compilação automática ativada" : ""}
            </span>
          </div>
          <LatexEditor value={code} onChange={onChange} />
        </div>
      }
      right={
        <div className="workspace-right">
          <PdfPreview pdfData={pdfData} />
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
              <strong>Erros de compilação:</strong>
              <pre>{errors.join("\n\n")}</pre>
            </div>
          )}
        </div>
      }
    />
  );
}
