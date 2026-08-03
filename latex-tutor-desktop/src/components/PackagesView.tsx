import { useEffect, useMemo, useState } from "react";
import type { PackageInfo } from "../types/global";
import { getActiveEditor, buildUsepackageInsert } from "../lib/activeEditor";

interface PackagesViewProps {
  initialQuery: string;
}

function formatSize(sizeKB: number | null): string {
  if (sizeKB == null) return "tamanho desconhecido";
  if (sizeKB >= 1024 * 1024) return `${(sizeKB / (1024 * 1024)).toFixed(1)} GB`;
  if (sizeKB >= 1024) return `${(sizeKB / 1024).toFixed(1)} MB`;
  return `${sizeKB} KB`;
}

export function PackagesView({ initialQuery }: PackagesViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [manualName, setManualName] = useState("");
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [source, setSource] = useState<"tlmgr" | "miktex" | "bundled">("bundled");
  const [packageManager, setPackageManager] = useState<"tlmgr" | "miktex" | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<Record<string, string>>({});
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      const result = await window.api.packages.list(query);
      setPackages(result.packages);
      setSource(result.source);
      setPackageManager(result.packageManager);
      setTotal(result.total);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, reloadTick]);

  useEffect(() => {
    const off = window.api.packages.onInstallProgress(({ name, chunk }) => {
      setInstalling((prev) => ({ ...prev, [name]: (prev[name] ?? "") + chunk }));
    });
    return off;
  }, []);

  async function install(name: string) {
    setInstalling((prev) => ({ ...prev, [name]: "" }));
    const result = await window.api.packages.install(name);
    setInstalling((prev) => ({ ...prev, [name]: result.success ? "✔ Instalado com sucesso." : `✕ Falhou: ${result.message}` }));
    if (result.success) setReloadTick((t) => t + 1);
  }

  async function uninstall(name: string) {
    if (!confirm(`Remover o pacote "${name}"?`)) return;
    setInstalling((prev) => ({ ...prev, [name]: "" }));
    const result = await window.api.packages.uninstall(name);
    setInstalling((prev) => ({ ...prev, [name]: result.success ? "✔ Removido." : `✕ Falhou: ${result.message}` }));
    if (result.success) setReloadTick((t) => t + 1);
  }

  function addToDocument(name: string) {
    const editor = getActiveEditor();
    if (!editor) {
      setAddFeedback((prev) => ({ ...prev, [name]: "Abra uma aula ou o Modo Livre primeiro." }));
      return;
    }
    const result = editor.addPackage(name);
    setAddFeedback((prev) => ({
      ...prev,
      [name]: result.alreadyPresent ? "Esse pacote já estava no documento atual." : `\\usepackage{${name}} adicionado ao documento atual.`
    }));
    setTimeout(() => setAddFeedback((prev) => ({ ...prev, [name]: "" })), 4000);
  }

  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name)),
    [packages]
  );

  const statusMessage =
    source === "tlmgr"
      ? `Catálogo completo carregado via tlmgr, do TeX Live/TinyTeX (${total} pacotes).`
      : source === "miktex"
      ? `Catálogo carregado via MiKTeX (${total} pacotes).`
      : packageManager === null
      ? "Nenhum motor com gerenciador de pacotes foi encontrado. Mostrando um catálogo offline de referência — instale o MiKTeX ou o TinyTeX na aba Configuração para instalar pacotes de verdade."
      : "Não foi possível carregar a lista completa automaticamente. Mostrando um catálogo offline de referência, mas você ainda pode tentar instalar qualquer pacote digitando o nome dele abaixo.";

  return (
    <div className="packages-view">
      <div className="packages-header">
        <h1>Gerenciador de pacotes</h1>
        <p>{statusMessage}</p>
        <input
          className="packages-search"
          type="text"
          placeholder="Buscar pacote (ex: tikz, beamer, biblatex)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="packages-manual-install">
          <input
            type="text"
            placeholder="Instalar pelo nome exato (caso não apareça na lista)..."
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
          <button
            disabled={!manualName.trim()}
            onClick={() => {
              install(manualName.trim());
              setManualName("");
            }}
          >
            Instalar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Buscando pacotes...</div>
      ) : (
        <ul className="packages-list">
          {sortedPackages.map((pkg) => {
            const isExpanded = expanded === pkg.name;
            return (
              <li key={pkg.name} className="packages-list-item-wrapper">
                <div className="packages-list-item">
                  <button className="packages-item-main" onClick={() => setExpanded(isExpanded ? null : pkg.name)}>
                    <div className="packages-item-title">
                      <strong>{isExpanded ? "▾" : "▸"} {pkg.name}</strong>
                      {pkg.installed && <span className="packages-badge-installed">instalado</span>}
                      {pkg.approximate && <span className="packages-badge-approx">estimado</span>}
                      {pkg.xelatexOnly && <span className="packages-badge-xelatex">requer XeLaTeX</span>}
                    </div>
                    <div className="packages-item-desc">{pkg.shortdesc}</div>
                  </button>
                  <div className="packages-item-size">{formatSize(pkg.sizeKB)}</div>
                  <div className="packages-item-action">
                    {installing[pkg.name] !== undefined ? (
                      <span className="packages-installing">{installing[pkg.name] || "Trabalhando..."}</span>
                    ) : pkg.installed ? (
                      <button className="packages-uninstall-btn" onClick={() => uninstall(pkg.name)}>
                        Remover
                      </button>
                    ) : (
                      <button onClick={() => install(pkg.name)}>Instalar</button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="packages-details">
                    {pkg.xelatexOnly && (
                      <div className="banner banner-warning">
                        Este pacote só funciona compilando com <strong>XeLaTeX</strong>, não com pdflatex.
                      </div>
                    )}
                    <div className="packages-example-title">Exemplo de uso:</div>
                    <pre>{pkg.example}</pre>
                    <div className="lessons-actions-row">
                      <button onClick={() => addToDocument(pkg.name)}>Adicionar \usepackage ao documento atual</button>
                    </div>
                    {addFeedback[pkg.name] && <div className="packages-add-feedback">{addFeedback[pkg.name]}</div>}
                  </div>
                )}
              </li>
            );
          })}
          {sortedPackages.length === 0 && <li className="packages-empty">Nenhum pacote encontrado para "{query}".</li>}
        </ul>
      )}
    </div>
  );
}
