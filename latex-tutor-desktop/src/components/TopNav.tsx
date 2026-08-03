export type Tab = "lessons" | "freemode" | "packages" | "setup";

interface TopNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  engineWarning: boolean;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "lessons", label: "Aprender" },
  { id: "freemode", label: "Modo Livre" },
  { id: "packages", label: "Pacotes" },
  { id: "setup", label: "Configuração" }
];

export function TopNav({ active, onChange, engineWarning }: TopNavProps) {
  return (
    <nav className="top-nav">
      <div className="top-nav-brand">LaTeX Tutor</div>
      <div className="top-nav-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`top-nav-tab ${active === tab.id ? "active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {tab.id === "setup" && engineWarning && <span className="top-nav-dot" />}
          </button>
        ))}
      </div>
    </nav>
  );
}
