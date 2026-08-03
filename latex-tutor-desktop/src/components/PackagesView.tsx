import { useEffect, useMemo, useState } from "react";
import type { PackageInfo } from "../types/global";

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
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [source, setSource] = useState<"tlmgr" | "bundled">("bundled");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<Record<string, string>>({});

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      setLoading(true);
      const result = await window.api.packages.list(query);
      setPackages(result.packages);
      setSource(result.source);
      setTotal(result.total);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

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
  }

  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name)),
    [packages]
  );

  return (
    <div className="packages-view">
      <div className="packages-header">
        <h1>Gerenciador de pacotes</h1>
        <p>
          {source === "bundled"
            ? "Mostrando catálogo offline de referência (tamanhos aproximados). Instale o motor LaTeX para ver o catálogo completo e tamanhos reais."
            : `Catálogo completo do TeX Live carregado via tlmgr (${total} pacotes).`}
        </p>
        <input
          className="packages-search"
          type="text"
          placeholder="Buscar pacote (ex: tikz, beamer, biblatex)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading">Buscando pacotes...</div>
      ) : (
        <ul className="packages-list">
          {sortedPackages.map((pkg) => (
            <li key={pkg.name} className="packages-list-item">
              <div className="packages-item-main">
                <div className="packages-item-title">
                  <strong>{pkg.name}</strong>
                  {pkg.installed && <span className="packages-badge-installed">instalado</span>}
                  {pkg.approximate && <span className="packages-badge-approx">estimado</span>}
                </div>
                <div className="packages-item-desc">{pkg.shortdesc}</div>
              </div>
              <div className="packages-item-size">{formatSize(pkg.sizeKB)}</div>
              <div className="packages-item-action">
                {pkg.installed ? (
                  <span className="packages-installed-check">✔</span>
                ) : installing[pkg.name] !== undefined ? (
                  <span className="packages-installing">{installing[pkg.name] || "Instalando..."}</span>
                ) : (
                  <button onClick={() => install(pkg.name)}>Instalar</button>
                )}
              </div>
            </li>
          ))}
          {sortedPackages.length === 0 && <li className="packages-empty">Nenhum pacote encontrado para "{query}".</li>}
        </ul>
      )}
    </div>
  );
}
