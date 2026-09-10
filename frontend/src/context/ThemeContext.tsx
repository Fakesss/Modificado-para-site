import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// TEMA DO APP (claro / escuro)
// -----------------------------------------------------------------------------
// O tema não troca só o fundo: cada cor de acento tem uma versão para cada
// tema. No escuro elas são neon (brilham no preto); no claro viram tons
// SÓLIDOS e mais fechados, que é o que funciona sobre branco — nada de amarelo
// ou ciano fluorescente em cima de papel branco.
//
// Cada tela pega as cores por `useTema()` e monta o StyleSheet com elas.
// Cores que vêm do banco (cor da equipe, por exemplo) passam por
// `corParaTema()`, que escurece automaticamente o que for claro demais.
//
// Os jogos de fundo escuro por natureza — Equações Espaciais (página web) e
// Matemática Turbo (o dos lasers) — continuam sempre escuros de propósito.
// =============================================================================

export type Tema = 'claro' | 'escuro';

export interface CoresTema {
  // --- estrutura ---
  fundo: string;         // fundo geral da tela
  superficie: string;    // cards e caixas
  superficieAlt: string; // caixas internas, campos de texto
  texto: string;         // texto principal
  textoFraco: string;    // texto secundário / legendas
  borda: string;
  barra: string;         // barra de abas e cabeçalhos
  veu: string;           // escurecido por trás de janelas/modais
  sobreAcento: string;   // texto por cima de um botão pintado de acento

  // --- acentos (neon no escuro, sólido no claro) ---
  dourado: string;   // #FFD700
  ambar: string;     // #FFB300
  sucesso: string;   // #32CD32
  erro: string;      // #E74C3C
  laranja: string;   // #FF4500
  azul: string;      // #4169E1
  ciano: string;     // #00BFFF / #00FFFF
  roxo: string;      // #9B59B6 / #BB99FF
  rosa: string;      // #FF69B4
}

const ESCURO: CoresTema = {
  fundo: '#0c0c0c',
  superficie: '#1a1a2e',
  superficieAlt: '#12121f',
  texto: '#ffffff',
  textoFraco: '#8a8a99',
  borda: '#2a2a3e',
  barra: '#1a1a2e',
  veu: 'rgba(0,0,0,0.85)',
  sobreAcento: '#000000',

  dourado: '#FFD700',
  ambar: '#FFB300',
  sucesso: '#32CD32',
  erro: '#E74C3C',
  laranja: '#FF4500',
  azul: '#4169E1',
  ciano: '#00BFFF',
  roxo: '#BB99FF',
  rosa: '#FF69B4',
};

const CLARO: CoresTema = {
  fundo: '#F1F4F9',
  superficie: '#FFFFFF',
  superficieAlt: '#E9EEF5',
  texto: '#16202B',
  textoFraco: '#5C6B7A',
  borda: '#DBE2EA',
  barra: '#FFFFFF',
  veu: 'rgba(22,32,43,0.45)',
  sobreAcento: '#FFFFFF',

  dourado: '#B07A00',  // o #FFD700 some no branco
  ambar: '#B26A00',
  sucesso: '#1E8E3E',
  erro: '#C0392B',
  laranja: '#D84315',
  azul: '#2952CC',
  ciano: '#0277BD',
  roxo: '#7B3FA0',
  rosa: '#C2185B',
};

// -----------------------------------------------------------------------------
// corParaTema — cores que vêm do banco (equipes) podem ser neon demais para o
// tema claro. Aqui a cor é convertida para HSL e, no claro, tem o brilho
// limitado (fica sólida em vez de fluorescente). No escuro volta igualzinha.
// -----------------------------------------------------------------------------
export function corParaTema(cor: string | undefined, estaClaro: boolean, brilhoMax = 0.42): string {
  if (!cor) return '#888888';
  if (!estaClaro) return cor;

  const hex = cor.replace('#', '');
  if (hex.length !== 6 && hex.length !== 3) return cor;
  const cheio = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;

  const r = parseInt(cheio.slice(0, 2), 16) / 255;
  const g = parseInt(cheio.slice(2, 4), 16) / 255;
  const b = parseInt(cheio.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return cor;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  if (l <= brilhoMax) return cor;      // já é escura o bastante
  const novoL = brilhoMax;
  const novoS = Math.min(1, Math.max(s, 0.45)); // mantém a cor viva ao escurecer

  const c = (1 - Math.abs(2 * novoL - 1)) * novoS;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = novoL - c / 2;
  let [r2, g2, b2] = [0, 0, 0];
  if (h < 60) [r2, g2, b2] = [c, x, 0];
  else if (h < 120) [r2, g2, b2] = [x, c, 0];
  else if (h < 180) [r2, g2, b2] = [0, c, x];
  else if (h < 240) [r2, g2, b2] = [0, x, c];
  else if (h < 300) [r2, g2, b2] = [x, 0, c];
  else [r2, g2, b2] = [c, 0, x];

  const par = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${par(r2)}${par(g2)}${par(b2)}`;
}

// -----------------------------------------------------------------------------
// textoSobre — devolve preto ou branco, o que der mais contraste em cima da cor
// recebida. Usado nas etiquetas pintadas com a cor da equipe: no tema escuro a
// cor é clara (texto preto), no claro ela vem escurecida (texto branco).
// -----------------------------------------------------------------------------
export function textoSobre(cor: string | undefined): string {
  if (!cor) return '#ffffff';
  const hex = cor.replace('#', '');
  const cheio = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (cheio.length !== 6) return '#ffffff';
  const r = parseInt(cheio.slice(0, 2), 16);
  const g = parseInt(cheio.slice(2, 4), 16);
  const b = parseInt(cheio.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return '#ffffff';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#101820' : '#ffffff';
}

const CHAVE_TEMA = 'temaApp';

interface ThemeContextData {
  tema: Tema;
  cores: CoresTema;
  estaClaro: boolean;
  alternarTema: () => void;
  /** Ajusta uma cor dinâmica (equipe, avatar) para o tema atual. */
  corEquipe: (cor?: string) => string;
}

const ThemeContext = createContext<ThemeContextData>({
  tema: 'escuro',
  cores: ESCURO,
  estaClaro: false,
  alternarTema: () => {},
  corEquipe: (cor?: string) => cor || '#888888',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>('escuro');

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_TEMA)
      .then((salvo) => { if (salvo === 'claro' || salvo === 'escuro') setTema(salvo); })
      .catch(() => {});
  }, []);

  const alternarTema = useCallback(() => {
    setTema((atual) => {
      const novo: Tema = atual === 'escuro' ? 'claro' : 'escuro';
      AsyncStorage.setItem(CHAVE_TEMA, novo).catch(() => {});
      return novo;
    });
  }, []);

  const estaClaro = tema === 'claro';
  const corEquipe = useCallback((cor?: string) => corParaTema(cor, estaClaro), [estaClaro]);

  return (
    <ThemeContext.Provider value={{ tema, cores: estaClaro ? CLARO : ESCURO, estaClaro, alternarTema, corEquipe }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTema = () => useContext(ThemeContext);
