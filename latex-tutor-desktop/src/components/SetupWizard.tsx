import { useEffect, useState } from "react";
import type { EngineStatus } from "../types/global";
import { getEditorSettings, subscribeEditorSettings, updateEditorSettings } from "../lib/editorSettings";

interface SetupWizardProps {
  status: EngineStatus | null;
  onRecheck: () => void;
}

export function SetupWizard({ status, onRecheck }: SetupWizardProps) {
  const installed = status?.installed ?? false;
  const [settings, setSettings] = useState(getEditorSettings());

  useEffect(() => subscribeEditorSettings(setSettings), []);

  return (
    <div className="setup-wizard">
      <h1>Configuração</h1>

      <h2 className="setup-section-title">Motor LaTeX</h2>

      {installed ? (
        <div className="banner banner-success">
          Motor LaTeX encontrado! Você já pode compilar seus documentos.
        </div>
      ) : (
        <div className="banner banner-warning">
          Nenhum motor LaTeX foi encontrado neste computador ainda. Escolha uma das opções abaixo para instalar
          (é necessário estar conectado à internet apenas nesta etapa única de instalação).
        </div>
      )}

      <div className="setup-cards">
        <div className="setup-card">
          <h2>MiKTeX (recomendado)</h2>
          <p>
            Distribuição LaTeX completa para Windows, com painel próprio (MiKTeX Console) para buscar e instalar
            pacotes adicionais. Instala pacotes automaticamente na primeira vez que são usados.
          </p>
          <button onClick={() => window.api.engine.openInstallPage("miktex")}>Abrir página de instalação</button>
        </div>
        <div className="setup-card">
          <h2>TinyTeX (mais leve)</h2>
          <p>
            Distribuição minimalista baseada no TeX Live. Ocupa menos espaço inicialmente; pacotes extras são
            instalados sob demanda pela aba "Pacotes" deste app.
          </p>
          <button onClick={() => window.api.engine.openInstallPage("tinytex")}>Abrir página de instalação</button>
        </div>
      </div>

      <ol className="setup-steps">
        <li>Clique em um dos botões acima para abrir a página oficial no seu navegador.</li>
        <li>Baixe e execute o instalador (siga as instruções do próprio instalador).</li>
        <li>Volte aqui e clique em "Verificar novamente".</li>
      </ol>

      <button className="setup-recheck-btn" onClick={onRecheck}>
        ↻ Verificar novamente
      </button>

      {status && (
        <details className="setup-details">
          <summary>Detalhes técnicos</summary>
          <pre>{JSON.stringify(status.engines, null, 2)}</pre>
        </details>
      )}

      <h2 className="setup-section-title">Editor</h2>
      <div className="setup-editor-options">
        <label className="setup-editor-option">
          <input
            type="checkbox"
            checked={settings.autoCloseBrackets}
            onChange={(e) => updateEditorSettings({ autoCloseBrackets: e.target.checked })}
          />
          <div>
            <strong>Fechar chaves, colchetes e parênteses automaticamente</strong>
            <p>Ao digitar {"\\frac{"}, o app já adiciona o {"}"} de fechamento para você.</p>
          </div>
        </label>
        <label className="setup-editor-option">
          <input
            type="checkbox"
            checked={settings.tabAutocomplete}
            onChange={(e) => updateEditorSettings({ tabAutocomplete: e.target.checked })}
          />
          <div>
            <strong>Autocompletar comandos com a tecla Tab</strong>
            <p>
              Sugere primeiro o último comando parecido que você usou; se não houver, sugere comandos LaTeX válidos
              do menor para o maior.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}
