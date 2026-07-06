// =============================================================================
// TESTES DO MÉTODO LEITNER — TRILHA DA TABUADA
// -----------------------------------------------------------------------------
// Valida as regras pedidas pelo professor:
//   - se o aluno errar, o card volta para o nível 1;
//   - se acertar rápido, sobe de nível;
//   - se estiver no nível 5, não passa de 5;
//   - se o card estiver vencido, ele deve aparecer antes dos demais;
//   - a próxima revisão deve ser calculada corretamente conforme o nível.
//
// Sem framework de teste (o projeto não tem jest): usa assert simples do Node.
// Como rodar (da pasta frontend):
//   npx tsc src/services/leitner.ts src/services/leitner.test.ts \
//     --outDir /tmp/leitner-test --module commonjs --target es2019 --skipLibCheck
//   node /tmp/leitner-test/leitner.test.js
// =============================================================================

import {
  aplicarResposta,
  calcularProximaRevisao,
  classificarResposta,
  calcularEvolucaoLeitnerPct,
  contarDominados,
  selecionarCardsDaSessao,
  todasAsOperacoes,
  TabuadaCardEstado,
  FlashcardPersonalizado,
  NIVEL_MAX,
  NIVEL_MIN,
  TOTAL_CARDS,
} from './leitner';

let passaram = 0;
let falharam = 0;

function verificar(nome: string, condicao: boolean, detalhe?: string) {
  if (condicao) {
    passaram++;
    console.log(`  ✓ ${nome}`);
  } else {
    falharam++;
    console.error(`  ✗ FALHOU: ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

function cardTeste(parcial: Partial<TabuadaCardEstado> & { operacao: string }): TabuadaCardEstado {
  const [f1, f2] = parcial.operacao.split('x').map(Number);
  return {
    fator1: f1,
    fator2: f2,
    nivel: 2,
    proximaRevisao: new Date('2026-12-31T00:00:00Z').toISOString(),
    vezesVista: 1,
    vezesErrada: 0,
    ultimoErroEm: null,
    ...parcial,
  };
}

const AGORA = '2026-07-04T12:00:00.000Z';

console.log('\n[1] Erro volta para o nível 1, de qualquer nível');
for (let nivel = NIVEL_MIN; nivel <= NIVEL_MAX; nivel++) {
  const r = aplicarResposta(nivel, false, 3);
  verificar(`erro no nível ${nivel} → nível 1`, r.nivelDepois === 1, `veio ${r.nivelDepois}`);
}

console.log('\n[2] Acerto rápido (até 5s) sobe 1 nível e é marcado como RAPIDA');
{
  const r1 = aplicarResposta(1, true, 3);
  verificar('nível 1 + acerto em 3s → nível 2', r1.nivelDepois === 2);
  verificar('classificação RAPIDA', r1.classificacao === 'RAPIDA');
  const r4 = aplicarResposta(4, true, 5);
  verificar('nível 4 + acerto em 5s (borda) → nível 5', r4.nivelDepois === 5);
  verificar('5.0s ainda é RAPIDA', r4.classificacao === 'RAPIDA');
}

console.log('\n[3] Nível 5 é o teto: não passa de 5');
{
  const r = aplicarResposta(5, true, 2);
  verificar('nível 5 + acerto rápido → continua 5', r.nivelDepois === 5, `veio ${r.nivelDepois}`);
}

console.log('\n[4] Acerto normal (entre 5 e 10s) sobe 1 nível');
{
  const r = aplicarResposta(2, true, 8);
  verificar('nível 2 + acerto em 8s → nível 3', r.nivelDepois === 3);
  verificar('classificação NORMAL', r.classificacao === 'NORMAL');
  const borda = aplicarResposta(3, true, 10);
  verificar('10.0s (borda) ainda sobe → nível 4', borda.nivelDepois === 4);
}

console.log('\n[5] Acerto lento (acima de 10s) mantém o nível, exceto nível 1 que sobe pra 2');
{
  const r3 = aplicarResposta(3, true, 12);
  verificar('nível 3 + acerto em 12s → continua 3', r3.nivelDepois === 3);
  verificar('classificação LENTA', r3.classificacao === 'LENTA');
  const r1 = aplicarResposta(1, true, 15);
  verificar('nível 1 + acerto lento → sobe pra 2', r1.nivelDepois === 2);
  const r5 = aplicarResposta(5, true, 20);
  verificar('nível 5 + acerto lento → continua 5', r5.nivelDepois === 5);
}

console.log('\n[6] Próxima revisão calculada conforme o nível (0/1/3/7/15 dias)');
{
  const esperados: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 15 };
  for (let nivel = 1; nivel <= 5; nivel++) {
    const prox = new Date(calcularProximaRevisao(nivel, AGORA)).getTime();
    const esperado = new Date(AGORA).getTime() + esperados[nivel] * 24 * 60 * 60 * 1000;
    verificar(`nível ${nivel} → +${esperados[nivel]} dia(s)`, prox === esperado,
      `esperado ${new Date(esperado).toISOString()}, veio ${new Date(prox).toISOString()}`);
  }
}

console.log('\n[7] Card vencido aparece antes dos demais');
{
  const vencido = cardTeste({ operacao: '7x8', nivel: 3, proximaRevisao: '2026-07-01T00:00:00Z' });
  const emDia = cardTeste({ operacao: '2x2', nivel: 2, proximaRevisao: '2026-12-01T00:00:00Z' });
  const selecao = selecionarCardsDaSessao([vencido, emDia], AGORA, 10);
  verificar('vencido (7x8) é o primeiro da fila', selecao[0].operacao === '7x8',
    `primeiro foi ${selecao[0].operacao}`);
  const posVencido = selecao.findIndex(s => s.operacao === '7x8');
  const posEmDia = selecao.findIndex(s => s.operacao === '2x2');
  verificar('vencido vem antes do card em dia', posVencido < (posEmDia === -1 ? 999 : posEmDia));
}

console.log('\n[8] Entre vencidos, nível mais baixo vem primeiro; sessão respeita o tamanho');
{
  const v1 = cardTeste({ operacao: '9x9', nivel: 4, proximaRevisao: '2026-07-01T00:00:00Z' });
  const v2 = cardTeste({ operacao: '6x7', nivel: 1, proximaRevisao: '2026-07-02T00:00:00Z' });
  const v3 = cardTeste({ operacao: '8x8', nivel: 2, proximaRevisao: '2026-07-03T00:00:00Z' });
  const selecao = selecionarCardsDaSessao([v1, v2, v3], AGORA, 2);
  verificar('sessão de tamanho 2 retorna 2 cards', selecao.length === 2);
  verificar('nível 1 vencido vem primeiro', selecao[0].operacao === '6x7');
  verificar('nível 2 vencido vem em segundo', selecao[1].operacao === '8x8');
}

console.log('\n[9] Cards nunca estudados entram quando não há vencidos suficientes');
{
  const selecao = selecionarCardsDaSessao([], AGORA, 10);
  verificar('sem histórico, a sessão é preenchida com 10 não estudados', selecao.length === 10);
  const universo = new Set(todasAsOperacoes().map(o => o.operacao));
  verificar('todos pertencem ao universo 1..10 × 1..10', selecao.every(s => universo.has(s.operacao)));
}

console.log('\n[10] Evolução Leitner (%) — fórmula do professor');
{
  const todosNivel1 = todasAsOperacoes().map(op =>
    cardTeste({ operacao: op.operacao, nivel: 1, vezesVista: 1 }));
  verificar('todos no nível 1 → 0%', calcularEvolucaoLeitnerPct(todosNivel1) === 0);

  const todosNivel5 = todasAsOperacoes().map(op =>
    cardTeste({ operacao: op.operacao, nivel: 5, vezesVista: 1 }));
  verificar('todos no nível 5 → 100%', calcularEvolucaoLeitnerPct(todosNivel5) === 100);

  verificar('nenhum card estudado → 0%', calcularEvolucaoLeitnerPct([]) === 0);

  const metadeNivel3 = todasAsOperacoes().slice(0, 50).map(op =>
    cardTeste({ operacao: op.operacao, nivel: 3, vezesVista: 1 }));
  // 50 cards no nível 3 = 50×2 pontos; 50 não estudados = 0. 100/(100×4)×100 = 25%
  verificar('metade no nível 3 → 25%', calcularEvolucaoLeitnerPct(metadeNivel3) === 25,
    `veio ${calcularEvolucaoLeitnerPct(metadeNivel3)}`);
}

console.log('\n[11] Contagem de dominados e universo de cards');
{
  verificar('universo tem exatamente 100 operações', todasAsOperacoes().length === TOTAL_CARDS);
  const cards = [
    cardTeste({ operacao: '7x8', nivel: 5, vezesVista: 4 }),
    cardTeste({ operacao: '6x9', nivel: 5, vezesVista: 2 }),
    cardTeste({ operacao: '2x3', nivel: 4, vezesVista: 3 }),
  ];
  verificar('2 cards no nível 5 → dominados = 2', contarDominados(cards) === 2);
}

console.log('\n[12] Classificação nas bordas de tempo');
{
  verificar('5.0s → RAPIDA', classificarResposta(true, 5.0) === 'RAPIDA');
  verificar('5.01s → NORMAL', classificarResposta(true, 5.01) === 'NORMAL');
  verificar('10.0s → NORMAL', classificarResposta(true, 10.0) === 'NORMAL');
  verificar('10.01s → LENTA', classificarResposta(true, 10.01) === 'LENTA');
  verificar('erro com qualquer tempo → ERRO', classificarResposta(false, 1) === 'ERRO');
}

console.log('\n[13] Flash cards personalizados entram no universo da sessão e da evolução');
{
  const dica: FlashcardPersonalizado = { id: 'abc', tipo: 'TEXTO', enunciado: 'Qual é o dobro de 8?', respostaCorreta: 16, dica: 'Some 8 + 8', opcoes: [14, 15, 16, 18] };

  // tamanhoSessao=10: cobre o bloco inteiro de embaralhamento (blocos de 10), então o
  // card personalizado (que ordena para o início por ter fator1*fator2 = 0) é
  // garantido estar entre os 10 primeiros mesmo após o embaralhamento do bloco.
  const selecao = selecionarCardsDaSessao([], AGORA, 10, [dica]);
  verificar('card personalizado nunca estudado pode entrar na sessão',
    selecao.some(s => s.operacao === 'custom:abc'));
  const item = selecao.find(s => s.operacao === 'custom:abc');
  verificar('card selecionado carrega a referência ao personalizado', item?.personalizado?.id === 'abc');

  const semPersonalizado = calcularEvolucaoLeitnerPct([], []);
  const comPersonalizadoNaoEstudado = calcularEvolucaoLeitnerPct([], [dica]);
  verificar('personalizado nunca estudado não muda a % (denominador cresce, numerador não)',
    semPersonalizado === 0 && comPersonalizadoNaoEstudado === 0);

  const cardCustomDominado = cardTeste({ operacao: 'custom:abc', fator1: 0, fator2: 0, nivel: 5, vezesVista: 3 });
  const pctComCustomDominado = calcularEvolucaoLeitnerPct([cardCustomDominado], [dica]);
  // 1 personalizado dominado (nível 5) entre 101 cards no total: 4/(101×4)×100
  const esperado = Math.round((4 / (101 * 4)) * 100 * 10) / 10;
  verificar('1 personalizado dominado entre 101 cards (100 fixos + 1) calcula corretamente',
    Math.round(pctComCustomDominado * 10) / 10 === esperado,
    `esperado ${esperado}, veio ${pctComCustomDominado}`);

  const vencidoCustom: FlashcardPersonalizado = { id: 'xyz', tipo: 'CONTA', enunciado: '12 ÷ 3', respostaCorreta: 4 };
  const cardVencidoCustom = cardTeste({ operacao: 'custom:xyz', fator1: 0, fator2: 0, nivel: 2, proximaRevisao: '2020-01-01T00:00:00Z' });
  const selecaoComVencido = selecionarCardsDaSessao([cardVencidoCustom], AGORA, 3, [vencidoCustom]);
  verificar('personalizado vencido aparece primeiro (mesma prioridade dos fixos)',
    selecaoComVencido[0].operacao === 'custom:xyz');
}

console.log(`\n========================================`);
console.log(`RESULTADO: ${passaram} passaram, ${falharam} falharam`);
console.log(`========================================\n`);
if (falharam > 0) process.exit(1);
