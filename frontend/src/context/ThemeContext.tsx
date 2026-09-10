import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// TEMA DO APP (claro / escuro)
// -----------------------------------------------------------------------------
// Só as telas "do app" (Início, Progresso, Ranking, Conteúdos, Atividades...)
// respondem ao tema. Os JOGOS (Equações Espaciais, Trilha da Tabuada, Sudoku,
// Garagem) continuam sempre escuros de propósito: o visual neon/espacial deles
// depende do fundo preto e ficaria estranho no claro.
//
// Cada tela pega as cores por `useTema()` e monta o StyleSheet com elas — os
// tons de acento que já funcionam nos dois fundos (cores de equipe, vermelho de
// erro, verde de acerto) continuam fixos onde estão.
// =============================================================================

export type Tema = 'claro' | 'escuro';

export interface CoresTema {
  fundo: string;         // fundo geral da tela
  superficie: string;    // cards e caixas
  superficieAlt: string; // caixas internas, campos de texto
  texto: string;         // texto principal
  textoFraco: string;    // texto secundário / legendas
  borda: string;
  dourado: string;       // acento principal (escurecido no tema claro pra ter contraste)
  barra: string;         // barra de abas e cabeçalhos
}

const ESCURO: CoresTema = {
  fundo: '#0c0c0c',
  superficie: '#1a1a2e',
  superficieAlt: '#12121f',
  texto: '#ffffff',
  textoFraco: '#8a8a99',
  borda: '#2a2a3e',
  dourado: '#FFD700',
  barra: '#1a1a2e',
};

const CLARO: CoresTema = {
  fundo: '#F1F4F9',
  superficie: '#FFFFFF',
  superficieAlt: '#E9EEF5',
  texto: '#16202B',
  textoFraco: '#5C6B7A',
  borda: '#DBE2EA',
  dourado: '#A97800', // #FFD700 é ilegível sobre branco — escurecido só no claro
  barra: '#FFFFFF',
};

const CHAVE_TEMA = 'temaApp';

interface ThemeContextData {
  tema: Tema;
  cores: CoresTema;
  estaClaro: boolean;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeContextData>({
  tema: 'escuro',
  cores: ESCURO,
  estaClaro: false,
  alternarTema: () => {},
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

  return (
    <ThemeContext.Provider value={{ tema, cores: estaClaro ? CLARO : ESCURO, estaClaro, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTema = () => useContext(ThemeContext);
