import { useEffect, useState } from "react";
import { TopNav, type Tab } from "./components/TopNav";
import { LessonsView } from "./components/LessonsView";
import { FreeModeView } from "./components/FreeModeView";
import { DrawingsView } from "./components/DrawingsView";
import { PackagesView } from "./components/PackagesView";
import { SetupWizard } from "./components/SetupWizard";
import { PdfPopoutWindow } from "./components/PdfPopoutWindow";
import type { EngineStatus } from "./types/global";

const isPdfPopout = window.location.hash === "#pdf-popout";

export default function App() {
  const [tab, setTab] = useState<Tab>("lessons");
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [packageQuery, setPackageQuery] = useState("");

  async function recheckEngine() {
    const status = await window.api.engine.status();
    setEngineStatus(status);
    return status;
  }

  useEffect(() => {
    if (isPdfPopout) return;
    recheckEngine().then((status) => {
      if (!status.installed) setTab("setup");
    });
  }, []);

  function goToPackage(packageName: string) {
    setPackageQuery(packageName);
    setTab("packages");
  }

  // The detached PDF preview window loads this very same bundle (there's no
  // separate entry point), just at a "#pdf-popout" URL — render only the
  // minimal popout view for it instead of the full tabbed app.
  if (isPdfPopout) {
    return <PdfPopoutWindow />;
  }

  // Lessons/Modo Livre/Desenhos stay mounted (just hidden) instead of being
  // unmounted on tab switch: this preserves scroll/zoom/cursor state, and keeps
  // the shared "active editor" registry (used by the Pacotes tab to insert
  // \usepackage{} into "the current document") pointing at a live component.
  return (
    <div className="app">
      <TopNav active={tab} onChange={setTab} engineWarning={engineStatus ? !engineStatus.installed : false} />
      <main className="app-main">
        <div style={{ display: tab === "lessons" ? "flex" : "none", flex: 1, minHeight: 0, width: "100%" }}>
          <LessonsView isActive={tab === "lessons"} onGoToPackage={goToPackage} />
        </div>
        <div style={{ display: tab === "freemode" ? "flex" : "none", flex: 1, minHeight: 0, width: "100%" }}>
          <FreeModeView isActive={tab === "freemode"} onGoToPackage={goToPackage} />
        </div>
        <div style={{ display: tab === "drawings" ? "flex" : "none", flex: 1, minHeight: 0, width: "100%" }}>
          <DrawingsView isActive={tab === "drawings"} onGoToPackage={goToPackage} />
        </div>
        {tab === "packages" && <PackagesView initialQuery={packageQuery} />}
        {tab === "setup" && <SetupWizard status={engineStatus} onRecheck={recheckEngine} />}
      </main>
    </div>
  );
}
