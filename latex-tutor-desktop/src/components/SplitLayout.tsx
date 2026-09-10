import { useCallback, useEffect, useRef, useState } from "react";

interface SplitLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  storageKey: string;
}

const MIN_PANE = 220;

export function SplitLayout({ left, right, storageKey }: SplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem(`${storageKey}:width`);
    return saved ? Number(saved) : 480;
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(`${storageKey}:collapsed`) === "1");
  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:width`, String(rightWidth));
  }, [rightWidth, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:collapsed`, collapsed ? "1" : "0");
  }, [collapsed, storageKey]);

  const onMouseDown = useCallback(() => {
    if (collapsed) return;
    dragging.current = true;
    document.body.style.cursor = "col-resize";
  }, [collapsed]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRightWidth = rect.right - e.clientX;
      const clamped = Math.min(Math.max(newRightWidth, MIN_PANE), rect.width - MIN_PANE);
      setRightWidth(clamped);
    }
    function onUp() {
      dragging.current = false;
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="split-layout">
      <div className="split-pane split-pane-left">{left}</div>
      {!collapsed && (
        <div className="split-handle" onMouseDown={onMouseDown} title="Arraste para redimensionar">
          <div className="split-handle-grip" />
        </div>
      )}
      <div
        className="split-pane split-pane-right"
        style={{ width: collapsed ? 0 : rightWidth, minWidth: collapsed ? 0 : MIN_PANE }}
      >
        {!collapsed && right}
      </div>
      {/* A real flex column, not an absolutely-positioned overlay — this is the
          only way to guarantee it never overlaps toolbar content inside either
          pane, at any window size or zoom level. */}
      <button
        className="split-collapse-btn"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Mostrar pré-visualização" : "Ocultar pré-visualização"}
      >
        {collapsed ? "◀" : "▶"}
      </button>
    </div>
  );
}
