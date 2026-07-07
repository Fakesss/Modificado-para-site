// =============================================================================
// MÉTODO LEITNER — TRILHA DA TABUADA
// -----------------------------------------------------------------------------
// Módulo PURO (sem nenhuma dependência de React Native) com toda a matemática do
// método de repetição espaçada. Toda regra de nível, revisão e seleção de cards
// vive AQUI, num lugar só, coberta pelos testes em leitner.test.ts.
//
// Regras (definidas pelo professor):
// - Erro: card volta para o nível 1.
// - Acerto acima de 10s: mantém o nível (sobe apenas se estiver no nível 1).
// - Acerto entre 5 e 10s: sobe 1 nível.
// - Acerto em até 5s: sobe 1 nível e é registrado como resposta rápida.
// - Nível mínimo 1, máximo 5.
// - Intervalos de revisão por nível: 1→hoje (mesma sessão/próximo treino),
//   2→1 dia, 3→3 dias, 4→7 dias, 5→15 dias.
// =============================================================================

export const NIVEL_MIN = 1;
export const NIVEL_MAX = 5;
export const LIMITE_RAPIDA_SEGUNDOS = 5;   // até aqui = resposta rápida
export const LIMITE_NORMAL_SEGUNDOS = 10;  // até aqui = acerto normal; acima = lento

export const INTERVALOS_REVISAO_DIAS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 3,
  4: 7,
  5: 15,
};

export const NOMES_NIVEIS: Record<number, string> = {
  1: 'Não sabe ainda',
  2: 'Aprendendo',
  3: 'Quase bom',
  4: 'Bom',
  5: 'Dominado',
};

export type ClassificacaoResposta = 'ERRO' | 'LENTA' | 'NORMAL' | 'RAPIDA';

export interface TabuadaCardEstado {
  operacao: string;          // "7x8"
  fator1: number;
  fator2: number;
  nivel: number;             // 1..5
  proximaRevisao: string;    // ISO
  vezesVista: number;
  vezesErrada: number;
  ultimoErroEm: string | null;
}

// ----- Flash card personalizado (criado pelo próprio aluno) -----
// Entra no jogo com operacao = "custom:<id>" e usa a MESMA máquina de estado
// Leitner dos cards fixos (nível, revisão, vezesVista/Errada) — só a seleção de
// sessão e o total de cards (denominador da evolução) precisam saber dele.
export interface FlashcardPersonalizado {
  id: string;
  tipo: 'CONTA' | 'TEXTO';
  enunciado: string;         // "7 x 8" ou "Qual é o dobro de 8?"
  respostaCorreta: number;
  dica?: string | null;
  opcoes?: number[] | null;  // 3-4 alternativas (não precisa incluir a correta)
}

// ----- Universo de cards: tabuada do 1 ao 10, 7x8 e 8x7 são cards distintos -----
export const TOTAL_CARDS = 100;

export function todasAsOperacoes(): { operacao: string; fator1: number; fator2: number }[] {
  const ops: { operacao: string; fator1: number; fator2: number }[] = [];
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      ops.push({ operacao: `${a}x${b}`, fator1: a, fator2: b });
    }
  }
  return ops;
}

function clampNivel(nivel: number): number {
  return Math.max(NIVEL_MIN, Math.min(NIVEL_MAX, Math.round(nivel) || NIVEL_MIN));
}

// ----- Classificação da resposta pelo tempo -----
export function classificarResposta(acertou: boolean, tempoSegundos: number): ClassificacaoResposta {
  if (!acertou) return 'ERRO';
  if (tempoSegundos <= LIMITE_RAPIDA_SEGUNDOS) return 'RAPIDA';
  if (tempoSegundos <= LIMITE_NORMAL_SEGUNDOS) return 'NORMAL';
  return 'LENTA';
}

// ----- Transição de nível -----
export function aplicarResposta(
  nivelAtual: number,
  acertou: boolean,
  tempoSegundos: number
): { nivelDepois: number; classificacao: ClassificacaoResposta } {
  const nivel = clampNivel(nivelAtual);
  const classificacao = classificarResposta(acertou, tempoSegundos);

  let nivelDepois: number;
  if (classificacao === 'ERRO') {
    nivelDepois = NIVEL_MIN;
  } else if (classificacao === 'LENTA') {
    nivelDepois = nivel === NIVEL_MIN ? NIVEL_MIN + 1 : nivel;
  } else {
    nivelDepois = Math.min(NIVEL_MAX, nivel + 1);
  }
  return { nivelDepois, classificacao };
}

// ----- Data da próxima revisão -----
export function calcularProximaRevisao(nivel: number, agoraISO: string): string {
  const dias = INTERVALOS_REVISAO_DIAS[clampNivel(nivel)];
  const d = new Date(agoraISO);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

// ----- Seleção priorizada dos cards de uma sessão -----
// Ordem de prioridade (do professor):
//   1. Cards vencidos para revisão (proximaRevisao <= agora), mais urgentes primeiro
//      (nível mais baixo primeiro; empate: mais vencido primeiro; empate: erro mais recente primeiro).
//   2. Cards errados recentemente (últimos 3 dias) que ainda não venceram.
//   3. Cards vistos de níveis baixos (1-3) ainda não vencidos.
//   4. Cards nunca estudados (mais fáceis primeiro, com leve embaralhamento por blocos).
//   5. Cards dominados/altos não vencidos, só para manutenção (os com revisão mais próxima primeiro).
const DIAS_ERRO_RECENTE = 3;

export function selecionarCardsDaSessao(
  cards: TabuadaCardEstado[],
  agoraISO: string,
  tamanhoSessao: number,
  cardsPersonalizados: FlashcardPersonalizado[] = []
): { operacao: string; fator1: number; fator2: number; personalizado?: FlashcardPersonalizado }[] {
  const agora = new Date(agoraISO).getTime();
  const limiteErroRecente = agora - DIAS_ERRO_RECENTE * 24 * 60 * 60 * 1000;

  const porOperacao = new Map<string, TabuadaCardEstado>();
  cards.forEach(c => porOperacao.set(c.operacao, c));

  const porPersonalizado = new Map<string, FlashcardPersonalizado>();
  cardsPersonalizados.forEach(fc => porPersonalizado.set(`custom:${fc.id}`, fc));

  const universo = [
    ...todasAsOperacoes(),
    ...cardsPersonalizados.map(fc => ({ operacao: `custom:${fc.id}`, fator1: 0, fator2: 0 })),
  ];

  const vencidos: TabuadaCardEstado[] = [];
  const erroRecente: TabuadaCardEstado[] = [];
  const nivelBaixo: TabuadaCardEstado[] = [];
  const naoEstudados: { operacao: string; fator1: number; fator2: number }[] = [];
  const manutencao: TabuadaCardEstado[] = [];

  for (const op of universo) {
    const card = porOperacao.get(op.operacao);
    if (!card || card.vezesVista <= 0) {
      naoEstudados.push(op);
      continue;
    }
    const venceu = new Date(card.proximaRevisao).getTime() <= agora;
    if (venceu) {
      vencidos.push(card);
    } else if (card.ultimoErroEm && new Date(card.ultimoErroEm).getTime() >= limiteErroRecente) {
      erroRecente.push(card);
    } else if (card.nivel <= 3) {
      nivelBaixo.push(card);
    } else {
      manutencao.push(card);
    }
  }

  vencidos.sort((a, b) =>
    a.nivel - b.nivel ||
    new Date(a.proximaRevisao).getTime() - new Date(b.proximaRevisao).getTime() ||
    (b.ultimoErroEm ? new Date(b.ultimoErroEm).getTime() : 0) - (a.ultimoErroEm ? new Date(a.ultimoErroEm).getTime() : 0)
  );
  erroRecente.sort((a, b) =>
    (b.ultimoErroEm ? new Date(b.ultimoErroEm).getTime() : 0) - (a.ultimoErroEm ? new Date(a.ultimoErroEm).getTime() : 0)
  );
  nivelBaixo.sort((a, b) =>
    a.nivel - b.nivel ||
    new Date(a.proximaRevisao).getTime() - new Date(b.proximaRevisao).getTime()
  );
  // Não estudados: mais fáceis primeiro (produto menor), com leve embaralhamento em blocos
  // de 10 pra não ficar uma sequência 100% previsível (1x1, 1x2, 1x3...).
  naoEstudados.sort((a, b) => a.fator1 * a.fator2 - b.fator1 * b.fator2);
  for (let i = 0; i < naoEstudados.length; i += 10) {
    const bloco = naoEstudados.slice(i, i + 10);
    for (let j = bloco.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [bloco[j], bloco[k]] = [bloco[k], bloco[j]];
    }
    naoEstudados.splice(i, bloco.length, ...bloco);
  }
  manutencao.sort((a, b) => new Date(a.proximaRevisao).getTime() - new Date(b.proximaRevisao).getTime());

  const comPersonalizado = (c: { operacao: string; fator1: number; fator2: number }) => {
    const fc = porPersonalizado.get(c.operacao);
    return fc ? { ...c, personalizado: fc } : c;
  };

  const fila = [
    ...vencidos.map(c => comPersonalizado({ operacao: c.operacao, fator1: c.fator1, fator2: c.fator2 })),
    ...erroRecente.map(c => comPersonalizado({ operacao: c.operacao, fator1: c.fator1, fator2: c.fator2 })),
    ...nivelBaixo.map(c => comPersonalizado({ operacao: c.operacao, fator1: c.fator1, fator2: c.fator2 })),
    ...naoEstudados.map(comPersonalizado),
    ...manutencao.map(c => comPersonalizado({ operacao: c.operacao, fator1: c.fator1, fator2: c.fator2 })),
  ];

  return fila.slice(0, Math.max(1, tamanhoSessao));
}

// ----- Evolução Leitner (%) -----
// Fórmula do professor: soma de (nível - 1) ÷ (total de cards × 4) × 100.
// Cards nunca estudados contam como nível 1 (contribuem 0), então:
// todos no nível 1 → 0%; todos no nível 5 → 100%.
export function calcularEvolucaoLeitnerPct(
  cards: TabuadaCardEstado[],
  cardsPersonalizados: FlashcardPersonalizado[] = []
): number {
  let soma = 0;
  const porOperacao = new Map<string, TabuadaCardEstado>();
  cards.forEach(c => porOperacao.set(c.operacao, c));
  const universoCompleto = [
    ...todasAsOperacoes().map(op => op.operacao),
    ...cardsPersonalizados.map(fc => `custom:${fc.id}`),
  ];
  for (const operacao of universoCompleto) {
    const card = porOperacao.get(operacao);
    const nivel = card && card.vezesVista > 0 ? clampNivel(card.nivel) : NIVEL_MIN;
    soma += nivel - 1;
  }
  const totalCards = universoCompleto.length;
  return totalCards > 0 ? (soma / (totalCards * 4)) * 100 : 0;
}

// ----- Contagem de dominados -----
export function contarDominados(cards: TabuadaCardEstado[]): number {
  return cards.filter(c => c.vezesVista > 0 && clampNivel(c.nivel) === NIVEL_MAX).length;
}
