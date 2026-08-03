import { useEffect, useState } from "react";
import { TopNav, type Tab } from "./components/TopNav";
import { LessonsView } from "./components/LessonsView";
import { FreeModeView } from "./components/FreeModeView";
import { PackagesView } from "./components/PackagesView";
import { SetupWizard } from "./components/SetupWizard";
import type { EngineStatus } from "./types/global";

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
    recheckEngine().then((status) => {
      if (!status.installed) setTab("setup");
    });
  }, []);

  function goToPackage(packageName: string) {
    setPackageQuery(packageName);
    setTab("packages");
  }

  return (
    <div className="app">
      <TopNav active={tab} onChange={setTab} engineWarning={engineStatus ? !engineStatus.installed : false} />
      <main className="app-main">
        {tab === "lessons" && <LessonsView onGoToPackage={goToPackage} />}
        {tab === "freemode" && <FreeModeView onGoToPackage={goToPackage} />}
        {tab === "packages" && <PackagesView initialQuery={packageQuery} />}
        {tab === "setup" && <SetupWizard status={engineStatus} onRecheck={recheckEngine} />}
      </main>
    </div>
  );
}
