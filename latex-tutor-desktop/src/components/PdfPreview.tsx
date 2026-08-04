import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getActiveEditor } from "../lib/activeEditor";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Pages are rendered once (per pdfData change) into a bitmap at this fixed
// resolution, displayed on screen at "native" size (1 PDF pt = 1 CSS px at
// zoom=1). Interactive zoom is then just a CSS `zoom` on a wrapper — cheap and
// smooth, no re-render of pdf.js pages on every wheel tick. `zoom` isn't
// standard CSS, but this only ever runs inside Electron/Chromium.
const RENDER_SCALE = 2;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const PT_PER_CM = 72 / 2.54;

interface PageInfo {
  width: number; // native px (= PDF points) at scale 1
  height: number;
}

type OriginChoice = "bottom-left" | "top-left" | "center" | "custom";
type Point = { xAbs: number; yAbs: number; xDisp: number; yDisp: number };

interface PdfPreviewProps {
  pdfData: Uint8Array | null;
  emptyMessage?: string;
}

function formatCm(v: number) {
  return `${v.toFixed(2)} cm`;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function PdfPreview({ pdfData, emptyMessage }: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageInfos, setPageInfos] = useState<PageInfo[]>([]);
  const [, forceTick] = useState(0); // re-render on scroll so rulers/grid stay in sync

  // --- Coordinate tool state ---
  const [coordMode, setCoordMode] = useState(false);
  const [origin, setOrigin] = useState<OriginChoice>("bottom-left");
  const [customOrigin, setCustomOrigin] = useState<{ x: number; y: number } | null>(null);
  const [pickingCustomOrigin, setPickingCustomOrigin] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSpacingCm, setGridSpacingCm] = useState(1);
  const [cursorCm, setCursorCm] = useState<{ x: number; y: number } | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

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
        setPageInfos([]);
        return;
      }

      const loadingTask = pdfjsLib.getDocument({ data: pdfData.slice() });
      const pdf = await loadingTask.promise;
      if (cancelled) return;
      setNumPages(pdf.numPages);

      const infos: PageInfo[] = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const nativeViewport = page.getViewport({ scale: 1 });
        infos.push({ width: nativeViewport.width, height: nativeViewport.height });

        const renderViewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.className = "pdf-page";
        canvas.dataset.pageIndex = String(pageNum - 1);
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        canvas.style.width = `${nativeViewport.width}px`;
        canvas.style.height = `${nativeViewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        containerRef.current?.appendChild(canvas);
        const task = page.render({ canvasContext: ctx, viewport: renderViewport });
        renderTasks.push(task);
        await task.promise;
      }
      if (!cancelled) setPageInfos(infos);

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
  }, [pdfData]);

  const applyZoom = useCallback((newZoomRaw: number, anchorClientX?: number, anchorClientY?: number) => {
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoomRaw));
    const wrapper = wrapperRef.current;
    setZoomState((oldZoom) => {
      if (!wrapper || newZoom === oldZoom) return newZoom;
      const rect = wrapper.getBoundingClientRect();
      const localX = (anchorClientX ?? rect.left + rect.width / 2) - rect.left;
      const localY = (anchorClientY ?? rect.top + rect.height / 2) - rect.top;
      const contentX = (wrapper.scrollLeft + localX) / oldZoom;
      const contentY = (wrapper.scrollTop + localY) / oldZoom;
      requestAnimationFrame(() => {
        if (!wrapperRef.current) return;
        wrapperRef.current.scrollLeft = contentX * newZoom - localX;
        wrapperRef.current.scrollTop = contentY * newZoom - localY;
      });
      return newZoom;
    });
  }, []);

  // Ctrl+wheel (also how Chromium reports trackpad pinch gestures) zooms,
  // centered on the cursor; plain wheel/trackpad-scroll pans as usual.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.01);
      setZoomState((z) => {
        applyZoom(z * factor, e.clientX, e.clientY);
        return z;
      });
    }
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // Click-and-drag panning (useful with a plain mouse, not just a trackpad).
  const panRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  function onWrapperMouseDown(e: React.MouseEvent) {
    if (coordMode || e.button !== 0) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, startLeft: wrapper.scrollLeft, startTop: wrapper.scrollTop };
  }
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const pan = panRef.current;
      const wrapper = wrapperRef.current;
      if (!pan || !wrapper) return;
      wrapper.scrollLeft = pan.startLeft - (e.clientX - pan.startX);
      wrapper.scrollTop = pan.startTop - (e.clientY - pan.startY);
    }
    function onUp() {
      panRef.current = null;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function fitWidth() {
    const wrapper = wrapperRef.current;
    if (!wrapper || pageInfos.length === 0) return;
    applyZoom((wrapper.clientWidth - 32) / pageInfos[0].width);
  }
  function fitPage() {
    const wrapper = wrapperRef.current;
    if (!wrapper || pageInfos.length === 0) return;
    const { width, height } = pageInfos[0];
    applyZoom(Math.min((wrapper.clientWidth - 32) / width, (wrapper.clientHeight - 32) / height));
  }

  // --- Coordinate tool helpers (all scoped to page 1 — see note in the UI) ---

  function getPage0Rect() {
    const canvas = containerRef.current?.querySelector<HTMLCanvasElement>('canvas[data-page-index="0"]');
    return canvas ? canvas.getBoundingClientRect() : null;
  }

  function pointFromClient(clientX: number, clientY: number): Point | null {
    const rect = getPage0Rect();
    const info = pageInfos[0];
    if (!rect || !info || rect.width === 0 || rect.height === 0) return null;
    const xPx = ((clientX - rect.left) / rect.width) * info.width;
    const yPx = ((clientY - rect.top) / rect.height) * info.height;
    const widthCm = info.width / PT_PER_CM;
    const heightCm = info.height / PT_PER_CM;
    const xAbs = xPx / PT_PER_CM;
    const yAbs = heightCm - yPx / PT_PER_CM;

    let xDisp = xAbs;
    let yDisp = yAbs;
    if (origin === "top-left") {
      yDisp = yAbs - heightCm;
    } else if (origin === "center") {
      xDisp = xAbs - widthCm / 2;
      yDisp = yAbs - heightCm / 2;
    } else if (origin === "custom" && customOrigin) {
      xDisp = xAbs - customOrigin.x;
      yDisp = yAbs - customOrigin.y;
    }
    return { xAbs, yAbs, xDisp, yDisp };
  }

  function onCoordMouseMove(e: React.MouseEvent) {
    if (!coordMode) return;
    const p = pointFromClient(e.clientX, e.clientY);
    setCursorCm(p ? { x: p.xDisp, y: p.yDisp } : null);
  }

  function onCoordClick(e: React.MouseEvent) {
    if (!coordMode) return;
    const p = pointFromClient(e.clientX, e.clientY);
    if (!p) return;
    if (pickingCustomOrigin) {
      setCustomOrigin({ x: p.xAbs, y: p.yAbs });
      setOrigin("custom");
      setPickingCustomOrigin(false);
      return;
    }
    setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2500);
  }

  function insertSnippet(text: string) {
    const editor = getActiveEditor();
    if (!editor) {
      copyText("sem-editor", text);
      return;
    }
    editor.insertSnippet(text);
  }

  const localCode =
    points.length === 2
      ? `\\draw[->] (${round2(points[0].xDisp)},${round2(points[0].yDisp)}) -- (${round2(points[1].xDisp)},${round2(points[1].yDisp)});`
      : null;
  const pageCode =
    points.length === 2
      ? `\\draw[->]\n  ([xshift=${round2(points[0].xAbs)}cm,yshift=${round2(points[0].yAbs)}cm]current page.south west)\n  --\n  ([xshift=${round2(points[1].xAbs)}cm,yshift=${round2(points[1].yAbs)}cm]current page.south west);`
      : null;
  const distance =
    points.length === 2 ? Math.hypot(points[1].xAbs - points[0].xAbs, points[1].yAbs - points[0].yAbs) : null;
  const midpoint =
    points.length === 2
      ? { x: (points[0].xDisp + points[1].xDisp) / 2, y: (points[0].yDisp + points[1].yDisp) / 2 }
      : null;

  // The grid overlay lives inside the `zoom`-scaled container, so its
  // background-size is specified in native (unzoomed) px — the CSS zoom
  // scales it automatically along with the pages, keeping it aligned.
  const nativeGridPx = gridSpacingCm * PT_PER_CM;

  // Rulers: simple rect-derived tick marks (no numeric labels — the live
  // cursor readout already gives the exact value) kept in sync with
  // scroll/zoom by re-measuring the actual rendered page rect on each render.
  const wrapperRect = coordMode ? wrapperRef.current?.getBoundingClientRect() ?? null : null;
  const page0Rect = coordMode ? getPage0Rect() : null;
  const hTicks: { pos: number; major: boolean }[] = [];
  const vTicks: { pos: number; major: boolean }[] = [];
  if (wrapperRect && page0Rect && pageInfos[0]) {
    const pxPerCm = PT_PER_CM * zoom;
    const widthCm = Math.ceil(pageInfos[0].width / PT_PER_CM);
    const heightCm = Math.ceil(pageInfos[0].height / PT_PER_CM);
    const originX = page0Rect.left - wrapperRect.left;
    const originYBottom = page0Rect.bottom - wrapperRect.top;
    for (let k = 0; k <= widthCm; k++) {
      const pos = originX + k * pxPerCm;
      if (pos >= -1 && pos <= wrapperRect.width + 1) hTicks.push({ pos, major: k % 5 === 0 });
    }
    for (let k = 0; k <= heightCm; k++) {
      const pos = originYBottom - k * pxPerCm;
      if (pos >= -1 && pos <= wrapperRect.height + 1) vTicks.push({ pos, major: k % 5 === 0 });
    }
  }

  return (
    <div className="pdf-preview">
      <div className="pdf-preview-toolbar">
        <span>{numPages > 0 ? `${numPages} página(s)` : "Sem PDF ainda"}</span>
        <div className="pdf-zoom-controls">
          <button onClick={() => applyZoom(zoom - 0.1)} title="Reduzir zoom">
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => applyZoom(zoom + 0.1)} title="Ampliar zoom">
            +
          </button>
          <button onClick={fitWidth} title="Ajustar à largura">
            Largura
          </button>
          <button onClick={fitPage} title="Ver página inteira">
            Página
          </button>
          <button
            className={coordMode ? "active" : ""}
            onClick={() => setCoordMode((v) => !v)}
            title="Ferramenta de coordenadas"
          >
            📐 Coordenadas
          </button>
        </div>
      </div>

      {coordMode && (
        <div className="coord-toolbar">
          <label>
            Origem:{" "}
            <select value={origin} onChange={(e) => setOrigin(e.target.value as OriginChoice)}>
              <option value="bottom-left">Canto inferior esquerdo</option>
              <option value="top-left">Canto superior esquerdo</option>
              <option value="center">Centro da página</option>
              <option value="custom" disabled={!customOrigin}>
                Ponto personalizado
              </option>
            </select>
          </label>
          <button className={pickingCustomOrigin ? "active" : ""} onClick={() => setPickingCustomOrigin((v) => !v)}>
            {pickingCustomOrigin ? "Clique na página…" : "Definir origem personalizada"}
          </button>
          <label>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Malha
          </label>
          <label>
            Espaçamento:{" "}
            <input
              type="number"
              min={0.2}
              step={0.5}
              value={gridSpacingCm}
              onChange={(e) => setGridSpacingCm(Math.max(0.2, Number(e.target.value) || 1))}
              style={{ width: 50 }}
            />{" "}
            cm
          </label>
          {points.length > 0 && <button onClick={() => setPoints([])}>Limpar pontos ({points.length})</button>}
          <span className="coord-toolbar-hint">Medidas consideram a 1ª página do documento.</span>
        </div>
      )}

      <div className="pdf-preview-body">
        {coordMode && (
          <>
            <div className="pdf-ruler-corner" />
            <div className="pdf-ruler-h">
              {hTicks.map((t) => (
                <span key={t.pos} className={`pdf-ruler-tick ${t.major ? "major" : ""}`} style={{ left: t.pos }} />
              ))}
            </div>
            <div className="pdf-ruler-v">
              {vTicks.map((t) => (
                <span key={t.pos} className={`pdf-ruler-tick ${t.major ? "major" : ""}`} style={{ top: t.pos }} />
              ))}
            </div>
          </>
        )}
        <div
          className={`pdf-preview-pages-wrapper ${coordMode ? "coord-mode" : ""}`}
          ref={wrapperRef}
          onMouseDown={onWrapperMouseDown}
          onMouseMove={onCoordMouseMove}
          onClick={onCoordClick}
          onMouseLeave={() => setCursorCm(null)}
          onScroll={() => coordMode && forceTick((n) => n + 1)}
        >
          <div className="pdf-preview-pages-zoom" style={{ zoom }}>
            {/* This container is only ever touched imperatively (pdf.js appends
                canvases directly), so it must never also hold React-rendered
                children — mixing the two causes React and our manual DOM writes
                to fight over the same nodes. The grid overlay is a sibling
                instead, sharing the same `zoom` scaling safely. */}
            <div className="pdf-preview-pages" ref={containerRef} />
            {coordMode && showGrid && pdfData && (
              <div className="coord-grid-overlay" style={{ backgroundSize: `${nativeGridPx}px ${nativeGridPx}px` }} />
            )}
          </div>
          {!pdfData && <div className="pdf-preview-empty">{emptyMessage ?? "Compile para ver o resultado aqui."}</div>}
        </div>
      </div>

      {coordMode && (
        <div className="coord-readout">
          {cursorCm && (
            <div>
              Cursor: x = {formatCm(cursorCm.x)}, y = {formatCm(cursorCm.y)}
            </div>
          )}
          {points.length === 1 && <div>1 ponto marcado — clique em outro ponto para medir a distância.</div>}
          {points.length === 2 && distance != null && midpoint && (
            <div className="coord-readout-result">
              <div>
                Distância: {formatCm(distance)} · Ponto médio: ({round2(midpoint.x)}, {round2(midpoint.y)})
              </div>
              <div className="coord-code-block">
                <div className="coord-code-label">Coordenadas locais (dentro do tikzpicture):</div>
                <pre>{localCode}</pre>
                <div className="lessons-actions-row">
                  <button onClick={() => copyText("local", localCode!)}>Copiar</button>
                  <button onClick={() => insertSnippet(localCode!)}>Inserir no editor</button>
                </div>
              </div>
              <div className="coord-code-block">
                <div className="coord-code-label">Posição absoluta na página (overlay/current page):</div>
                <pre>{pageCode}</pre>
                <div className="lessons-actions-row">
                  <button onClick={() => copyText("page", pageCode!)}>Copiar</button>
                  <button onClick={() => insertSnippet(pageCode!)}>Inserir no editor</button>
                </div>
              </div>
              {copyFeedback && <div className="coord-copy-feedback">Copiado!</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
