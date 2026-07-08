// =============================================================================
// DESAFIO FLASH CARDS — geração de questões e rótulos de dificuldade
// -----------------------------------------------------------------------------
// Módulo PURO (sem nenhuma dependência de React Native), no mesmo espírito do
// leitner.ts. A PONTUAÇÃO REAL do desafio é sempre calculada no servidor (ver
// _calcular_pontuacao_desafio em backend/server.py) — os pesos aqui servem só
// pra rotular visualmente cada tabuada como fácil/média/difícil na tela de
// configuração, e precisam ser mantidos iguais aos do backend por consistência.
// =============================================================================

import { todasAsOperacoes } from './leitner';

export interface QuestaoDesafio {
  operacao: string;
  fator1: number;
  fator2: number;
}

export const PESO_TABUADA: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1 };

export const QUANTIDADES_DESAFIO = [15, 20, 30] as const;
export type QuantidadeDesafio = typeof QUANTIDADES_DESAFIO[number];

export function rotuloDificuldade(tabuada: number): 'Fácil' | 'Média' | 'Difícil' {
  const peso = PESO_TABUADA[tabuada] ?? 1;
  return peso >= 3 ? 'Difícil' : peso === 2 ? 'Média' : 'Fácil';
}

export function corDificuldade(tabuada: number): string {
  const peso = PESO_TABUADA[tabuada] ?? 1;
  return peso >= 3 ? '#FF7055' : peso === 2 ? '#FFD700' : '#32CD32';
}

export function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Sorteia `quantidade` questões usando SOMENTE as tabuadas selecionadas. Um card
// "pertence" à tabuada X se X aparece como fator1 OU fator2 (então "tabuada do 6"
// inclui tanto 6×7 quanto 7×6 — o jeito tradicional de estudar uma tabuada).
// Se o total de cards elegíveis for menor que a quantidade pedida (poucas
// tabuadas escolhidas + partida grande), repete o baralho embaralhado quantas
// vezes precisar pra sempre completar o total sem travar.
export function gerarQuestoesDesafio(tabuadasSelecionadas: number[], quantidade: number): QuestaoDesafio[] {
  const selecionadas = new Set(tabuadasSelecionadas);
  const elegiveis = todasAsOperacoes().filter(op => selecionadas.has(op.fator1) || selecionadas.has(op.fator2));
  if (elegiveis.length === 0) return [];

  let baralho: QuestaoDesafio[] = [];
  while (baralho.length < quantidade) {
    baralho = baralho.concat(embaralhar(elegiveis));
  }
  return baralho.slice(0, Math.max(1, quantidade));
}

// =============================================================================
// ESTIMATIVA DE PONTUAÇÃO AO VIVO
// -----------------------------------------------------------------------------
// Espelha EXATAMENTE a fórmula do backend (_calcular_pontuacao_desafio, em
// backend/server.py) pra mostrar uma prévia consistente da pontuação enquanto o
// aluno joga. A pontuação REAL e persistida sempre vem do servidor no fim da
// partida (enviarTabuadaDesafioResultado) — isto aqui nunca é a fonte da verdade,
// só feedback visual. Chamando com questoesRespondidas = todas as questões da
// partida, o resultado é idêntico ao que o servidor vai calcular.
// =============================================================================
export interface EstimativaPontuacao {
  pesoMedio: number;
  pontuacaoBase: number;
  bonusTempo: number;
  pontuacaoFinal: number;
}

const BONUS_TEMPO_MAX = 30;
const BONUS_TEMPO_REFERENCIA_SEG = 12;

export function estimarPontuacaoDesafio(
  tabuadasSelecionadas: number[],
  questoesRespondidas: number,
  acertos: number,
  tempoAcumuladoSegundos: number
): EstimativaPontuacao {
  const validas = Array.from(new Set(tabuadasSelecionadas.filter(t => t >= 1 && t <= 10)));
  const tabuadas = validas.length > 0 ? validas : [1];
  const pesoMedio = tabuadas.reduce((soma, t) => soma + (PESO_TABUADA[t] ?? 1), 0) / tabuadas.length;
  const pontuacaoBase = Math.round(acertos * pesoMedio * 10 * 10) / 10;
  const tempoMedioPorQuestao = questoesRespondidas > 0 ? tempoAcumuladoSegundos / questoesRespondidas : 0;
  const fracaoBonus = Math.max(0, 1 - Math.min(1, tempoMedioPorQuestao / BONUS_TEMPO_REFERENCIA_SEG));
  const bonusTempo = Math.round(BONUS_TEMPO_MAX * fracaoBonus * 10) / 10;
  return {
    pesoMedio: Math.round(pesoMedio * 100) / 100,
    pontuacaoBase,
    bonusTempo,
    pontuacaoFinal: Math.round((pontuacaoBase + bonusTempo) * 10) / 10,
  };
}

// Pontos-base ganhos por UMA resposta certa (constante durante toda a partida,
// já que a fórmula usa o peso médio das tabuadas escolhidas, não o peso da
// questão individual) — usado no efeito "+N pts" a cada resposta.
export function pontosPorAcerto(tabuadasSelecionadas: number[]): number {
  const validas = Array.from(new Set(tabuadasSelecionadas.filter(t => t >= 1 && t <= 10)));
  const tabuadas = validas.length > 0 ? validas : [1];
  const pesoMedio = tabuadas.reduce((soma, t) => soma + (PESO_TABUADA[t] ?? 1), 0) / tabuadas.length;
  return Math.round(pesoMedio * 10);
}
