import { useEffect, useRef, useState } from "react";
import { Workspace } from "./Workspace";

interface FreeModeViewProps {
  isActive?: boolean;
  onGoToPackage: (packageName: string) => void;
}

export function FreeModeView({ isActive, onGoToPackage }: FreeModeViewProps) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>("main.tex");
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.api.freeMode.getFiles().then(({ files, lastActiveFile }) => {
      setFiles(files);
      setActiveFile(lastActiveFile in files ? lastActiveFile : Object.keys(files)[0]);
      setLoaded(true);
    });
  }, []);

  function updateCode(value: string) {
    setFiles((prev) => ({ ...prev, [activeFile]: value }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      window.api.freeMode.saveFile(activeFile, value);
    }, 500);
  }

  function createFile() {
    const name = prompt("Nome do novo arquivo (ex: capitulo1.tex):", "novo-arquivo.tex");
    if (!name) return;
    const relPath = name.endsWith(".tex") ? name : `${name}.tex`;
    if (files[relPath]) {
      setActiveFile(relPath);
      return;
    }
    const starter = "\\documentclass{article}\n\\begin{document}\n\n\n\n\\end{document}\n";
    setFiles((prev) => ({ ...prev, [relPath]: starter }));
    window.api.freeMode.saveFile(relPath, starter);
    setActiveFile(relPath);
  }

  function deleteFile(relPath: string) {
    if (!confirm(`Excluir "${relPath}"?`)) return;
    window.api.freeMode.deleteFile(relPath);
    setFiles((prev) => {
      const next = { ...prev };
      delete next[relPath];
      return next;
    });
    if (activeFile === relPath) {
      const remaining = Object.keys(files).filter((f) => f !== relPath);
      setActiveFile(remaining[0] ?? "main.tex");
    }
  }

  if (!loaded) return <div className="loading">Carregando seus arquivos...</div>;

  return (
    <div className="freemode-view">
      <aside className="freemode-sidebar">
        <div className="freemode-sidebar-header">
          <h2>Seus arquivos</h2>
          <button onClick={createFile} title="Novo arquivo">
            + Novo
          </button>
        </div>
        <ul className="freemode-file-list">
          {Object.keys(files).map((relPath) => (
            <li key={relPath}>
              <button
                className={`freemode-file-item ${relPath === activeFile ? "active" : ""}`}
                onClick={() => setActiveFile(relPath)}
              >
                {relPath}
              </button>
              {relPath !== "main.tex" && (
                <button className="freemode-file-delete" onClick={() => deleteFile(relPath)} title="Excluir">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <div className="freemode-main">
        <Workspace
          storageKey="freemode-workspace"
          jobKey="freemode"
          isActive={isActive}
          code={files[activeFile] ?? ""}
          onChange={updateCode}
          mainFileName={activeFile}
          suggestedPdfName={activeFile.replace(/\.tex$/, "")}
          onGoToPackage={onGoToPackage}
        />
      </div>
    </div>
  );
}
