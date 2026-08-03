import { useState } from "react";
import { drawings, drawingCategories } from "../drawings/data";
import { Workspace } from "./Workspace";

interface DrawingsViewProps {
  isActive?: boolean;
  onGoToPackage: (packageName: string) => void;
}

export function DrawingsView({ isActive, onGoToPackage }: DrawingsViewProps) {
  const [selectedId, setSelectedId] = useState(drawings[0].id);
  const [code, setCode] = useState(drawings[0].code);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const drawing = drawings.find((d) => d.id === selectedId)!;

  function selectDrawing(id: string) {
    setSelectedId(id);
    setCode(drawings.find((d) => d.id === id)!.code);
    setSaveMessage(null);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setSaveMessage("Código copiado para a área de transferência.");
    setTimeout(() => setSaveMessage(null), 3000);
  }

  async function saveAsNewFreeModeFile() {
    const base = drawing.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const relPath = `${base || "desenho"}.tex`;
    await window.api.freeMode.saveFile(relPath, code);
    setSaveMessage(`Salvo no Modo Livre como "${relPath}".`);
    setTimeout(() => setSaveMessage(null), 4000);
  }

  return (
    <div className="drawings-view">
      <aside className="drawings-sidebar">
        <h2>Biblioteca de desenhos</h2>
        {drawingCategories.map((category) => (
          <div key={category} className="drawings-category">
            <div className="drawings-category-title">{category}</div>
            <ul className="drawings-list">
              {drawings
                .filter((d) => d.category === category)
                .map((d) => (
                  <li key={d.id}>
                    <button
                      className={`drawings-list-item ${d.id === selectedId ? "active" : ""}`}
                      onClick={() => selectDrawing(d.id)}
                    >
                      {d.title}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </aside>

      <div className="drawings-main">
        <div className="drawings-header">
          <h1>{drawing.title}</h1>
          <div className="lessons-actions-row">
            <button onClick={copyCode}>Copiar código</button>
            <button onClick={saveAsNewFreeModeFile}>Usar no Modo Livre</button>
            <button onClick={() => setCode(drawing.code)}>Restaurar original</button>
          </div>
          {saveMessage && <div className="drawings-save-message">{saveMessage}</div>}
        </div>

        <Workspace
          storageKey="drawings-workspace"
          jobKey="drawings"
          isActive={isActive}
          code={code}
          onChange={setCode}
          engine={drawing.engine}
          suggestedPdfName={drawing.title}
          onGoToPackage={onGoToPackage}
        />
      </div>
    </div>
  );
}
