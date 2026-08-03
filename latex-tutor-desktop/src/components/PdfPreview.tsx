import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfPreviewProps {
  pdfData: Uint8Array | null;
  emptyMessage?: string;
}

export function PdfPreview({ pdfData, emptyMessage }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.1);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let renderTasks: any[] = [];

    async function render() {
      if (!containerRef.current) return;
      const wrapper = wrapperRef.current;
      const prevScrollTop = wrapper?.scrollTop ?? 0;
      const prevScrollLeft = wrapper?.scrollLeft ?? 0;

      containerRef.current.innerHTML = "";
      if (!pdfData) {
        setNumPages(0);
        return;
      }

      const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice() });
      const pdf = await loadingTask.promise;
      if (cancelled) return;
      setNumPages(pdf.numPages);

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: zoom });
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page";
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        containerRef.current?.appendChild(canvas);
        const task = page.render({ canvasContext: ctx, viewport });
        renderTasks.push(task);
        await task.promise;
      }

      // Recompiling replaces every canvas, which would otherwise reset the
      // reader back to the top of page 1 on every keystroke — restore
      // wherever they were scrolled to instead.
      if (wrapper) {
        wrapper.scrollTop = prevScrollTop;
        wrapper.scrollLeft = prevScrollLeft;
      }
    }

    render();

    return () => {
      cancelled = true;
      renderTasks.forEach((t) => t.cancel());
    };
  }, [pdfData, zoom]);

  return (
    <div className="pdf-preview">
      <div className="pdf-preview-toolbar">
        <span>{numPages > 0 ? `${numPages} página(s)` : "Sem PDF ainda"}</span>
        <div className="pdf-zoom-controls">
          <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>+</button>
        </div>
      </div>
      <div className="pdf-preview-pages-wrapper" ref={wrapperRef}>
        {/* This container is only ever touched imperatively (pdf.js appends canvases
            directly), so it must never also hold React-rendered children — mixing the
            two causes React and our manual DOM writes to fight over the same nodes. */}
        <div className="pdf-preview-pages" ref={containerRef} />
        {!pdfData && <div className="pdf-preview-empty">{emptyMessage ?? "Compile para ver o resultado aqui."}</div>}
      </div>
    </div>
  );
}
