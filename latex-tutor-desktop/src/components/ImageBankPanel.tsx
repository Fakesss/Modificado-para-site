import { useEffect, useState } from "react";
import { getImageBank, subscribeImageBank, loadImageBank, addImagesToBank, deleteImageFromBank } from "../lib/imageBank";
import { getActiveEditor } from "../lib/activeEditor";

function formatSize(sizeKB: number): string {
  if (sizeKB >= 1024) return `${(sizeKB / 1024).toFixed(1)} MB`;
  return `${sizeKB} KB`;
}

export function ImageBankPanel() {
  const [images, setImages] = useState(getImageBank());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadImageBank();
    return subscribeImageBank(setImages);
  }, []);

  async function handleAdd() {
    setBusy(true);
    await addImagesToBank();
    setBusy(false);
  }

  function insertReference(name: string) {
    const editor = getActiveEditor();
    if (!editor) return;
    editor.insertSnippet(`\\includegraphics{${name}}`);
  }

  return (
    <div className="imagebank-panel">
      <div className="imagebank-header">
        <h2>Imagens</h2>
        <button onClick={handleAdd} disabled={busy} title="Adicionar imagens (PNG, JPG, PDF, EPS)">
          {busy ? "…" : "+ Adicionar"}
        </button>
      </div>
      {images.length === 0 ? (
        <p className="imagebank-empty">
          Nenhuma imagem ainda. Envie figuras ou fotos para usar com <code>\includegraphics</code>.
        </p>
      ) : (
        <ul className="imagebank-list">
          {images.map((img) => (
            <li key={img.name}>
              <button
                className="imagebank-item"
                onClick={() => insertReference(img.name)}
                title={`Inserir \\includegraphics{${img.name}} no editor`}
              >
                <span className="imagebank-item-name">{img.name}</span>
                <span className="imagebank-item-size">{formatSize(img.sizeKB)}</span>
              </button>
              <button
                className="imagebank-item-delete"
                onClick={() => deleteImageFromBank(img.name)}
                title="Excluir imagem"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
