import { useEffect, useRef, useState } from "react";
import { Workspace } from "./Workspace";
import { ImageBankPanel } from "./ImageBankPanel";

interface FreeModeViewProps {
  isActive?: boolean;
  onGoToPackage: (packageName: string) => void;
}

export function FreeModeView({ isActive, onGoToPackage }: FreeModeViewProps) {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>("main.tex");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keyed by file path so switching tabs mid-edit can't drop a pending write —
  // a single shared timer used to save only whichever file was most recently
  // touched, silently discarding any other file's unsaved edit.
  const pendingSavesRef = useRef<Record<string, string>>({});
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => {
    window.api.freeMode.getFiles().then(({ files, lastActiveFile, openTabs }) => {
      setFiles(files);
      const validActive = lastActiveFile in files ? lastActiveFile : Object.keys(files)[0];
      setActiveFile(validActive);
      const validTabs = openTabs.filter((f) => f in files);
      setOpenTabs(validTabs.length > 0 ? validTabs : [validActive]);
      setLoaded(true);
    });
  }, []);

  function flushPendingSaves() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingSavesRef.current;
    pendingSavesRef.current = {};
    return Promise.all(Object.entries(pending).map(([path, content]) => window.api.freeMode.saveFile(path, content)));
  }

  // Flush any unsaved edits right before the window actually closes, so a
  // close a moment after typing can't lose the last few keystrokes to the
  // 500ms debounce below.
  useEffect(() => {
    return window.api.app.onFlushBeforeClose(() => {
      flushPendingSaves().finally(() => window.api.app.confirmFlushComplete());
    });
  }, []);

  function updateCode(value: string) {
    setFiles((prev) => ({ ...prev, [activeFile]: value }));
    pendingSavesRef.current[activeFile] = value;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushPendingSaves, 500);
  }

  // Opening a file (from the sidebar, or a freshly created one) both makes it
  // the active tab and, if it isn't already, adds it to the open tab strip —
  // browsers do the same for links opened from a bookmarks sidebar.
  function openFile(relPath: string) {
    setActiveFile(relPath);
    setOpenTabs((prev) => {
      const next = prev.includes(relPath) ? prev : [...prev, relPath];
      window.api.freeMode.setOpenTabs(next, relPath);
      return next;
    });
  }

  function closeTab(relPath: string) {
    setOpenTabs((prev) => {
      const remaining = prev.filter((f) => f !== relPath);
      const fallback = Object.keys(filesRef.current).slice(0, 1);
      const next = remaining.length > 0 ? remaining : fallback;
      const newActive = relPath === activeFile ? next[next.length - 1] : activeFile;
      if (newActive) setActiveFile(newActive);
      window.api.freeMode.setOpenTabs(next, newActive);
      return next;
    });
  }

  function createFile() {
    const name = prompt("Nome do novo arquivo (ex: capitulo1.tex):", "novo-arquivo.tex");
    if (!name) return;
    const relPath = name.endsWith(".tex") ? name : `${name}.tex`;
    if (files[relPath]) {
      openFile(relPath);
      return;
    }
    const starter = "\\documentclass{article}\n\\begin{document}\n\n\n\n\\end{document}\n";
    setFiles((prev) => ({ ...prev, [relPath]: starter }));
    window.api.freeMode.saveFile(relPath, starter);
    openFile(relPath);
  }

  function deleteFile(relPath: string) {
    if (!confirm(`Excluir "${relPath}"?`)) return;
    delete pendingSavesRef.current[relPath];
    window.api.freeMode.deleteFile(relPath);
    setFiles((prev) => {
      const next = { ...prev };
      delete next[relPath];
      return next;
    });
    setOpenTabs((prev) => {
      const next = prev.filter((f) => f !== relPath);
      const remaining = Object.keys(files).filter((f) => f !== relPath);
      const finalTabs = next.length > 0 ? next : remaining.slice(0, 1);
      if (activeFile === relPath) {
        const newActive = finalTabs[0] ?? remaining[0] ?? "main.tex";
        setActiveFile(newActive);
        window.api.freeMode.setOpenTabs(finalTabs, newActive);
      } else {
        window.api.freeMode.setOpenTabs(finalTabs, activeFile);
      }
      return finalTabs;
    });
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
                onClick={() => openFile(relPath)}
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

        <ImageBankPanel />
      </aside>

      <div className="freemode-main">
        <div className="freemode-tabstrip">
          {openTabs.map((relPath) => (
            <div key={relPath} className={`freemode-tab ${relPath === activeFile ? "active" : ""}`}>
              <button className="freemode-tab-label" onClick={() => setActiveFile(relPath)}>
                {relPath}
              </button>
              {openTabs.length > 1 && (
                <button className="freemode-tab-close" title="Fechar aba" onClick={() => closeTab(relPath)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
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
