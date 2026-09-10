import { useEffect, useState } from "react";
import { PdfPreview } from "./PdfPreview";

export function PdfPopoutWindow() {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  useEffect(() => {
    return window.api.pdfWindow.onData(setPdfData);
  }, []);

  return (
    <div className="pdf-popout">
      <PdfPreview pdfData={pdfData} isPopout emptyMessage="Aguardando a compilação na janela principal…" />
    </div>
  );
}
