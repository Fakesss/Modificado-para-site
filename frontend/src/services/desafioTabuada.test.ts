// =============================================================================
// TESTES DO DESAFIO FLASH CARDS
// -----------------------------------------------------------------------------
// Sem framework de teste (o projeto não tem jest): usa assert simples do Node.
// Como rodar (da pasta frontend):
//   npx tsc src/services/leitner.ts src/services/desafioTabuada.ts src/services/desafioTabuada.test.ts \
//     --outDir /tmp/desafio-test --module commonjs --target es2019 --skipLibCheck
//   node /tmp/desafio-test/desafioTabuada.test.js
// =============================================================================

import { gerarQuestoesDesafio, rotuloDificuldade, corDificuldade, estimarPontuacaoDesafio, pontosPorAcerto, PESO_TABUADA } from './desafioTabuada';

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

console.log('\n[1] gerarQuestoesDesafio devolve exatamente a quantidade pedida');
{
  for (const qtd of [15, 20, 30]) {
    const questoes = gerarQuestoesDesafio([6, 7], qtd);
    verificar(`${qtd} questões pedidas -> ${questoes.length} devolvidas`, questoes.length === qtd);
  }
}

console.log('\n[2] Toda questão pertence a alguma tabuada selecionada (fator1 OU fator2)');
{
  const selecionadas = [3, 9];
  const questoes = gerarQuestoesDesafio(selecionadas, 30);
  const todasValidas = questoes.every(q => selecionadas.includes(q.fator1) || selecionadas.includes(q.fator2));
  verificar('todas as 30 questões pertencem à tabuada do 3 ou do 9', todasValidas);
}

console.log('\n[3] "Tabuada do 6" inclui tanto 6×N quanto N×6');
{
  const questoes = gerarQuestoesDesafio([6], 100);
  const tem6x7 = questoes.some(q => q.operacao === '6x7');
  const tem7x6 = questoes.some(q => q.operacao === '7x6');
  verificar('universo de "tabuada do 6" tem 6x7 e 7x6 (19 cards distintos, sem repetir 6x6)', tem6x7 && tem7x6);
}

console.log('\n[4] Poucas tabuadas + partida grande: não trava e ainda completa a quantidade pedida');
{
  const questoes = gerarQuestoesDesafio([1], 30);
  verificar('tabuada 1 sozinha (19 cards elegíveis) ainda gera 30 questões', questoes.length === 30);
}

console.log('\n[5] Nenhuma tabuada selecionada -> não gera questão nenhuma (sem travar)');
{
  const questoes = gerarQuestoesDesafio([], 20);
  verificar('lista vazia de tabuadas -> 0 questões', questoes.length === 0);
}

console.log('\n[6] Rótulos e cores de dificuldade batem com os pesos usados no backend');
{
  verificar('tabuada 1 é Fácil (peso 1)', rotuloDificuldade(1) === 'Fácil' && PESO_TABUADA[1] === 1);
  verificar('tabuada 10 é Fácil (peso 1)', rotuloDificuldade(10) === 'Fácil' && PESO_TABUADA[10] === 1);
  verificar('tabuada 3 é Média (peso 2)', rotuloDificuldade(3) === 'Média' && PESO_TABUADA[3] === 2);
  verificar('tabuada 6 é Difícil (peso 3)', rotuloDificuldade(6) === 'Difícil' && PESO_TABUADA[6] === 3);
  verificar('tabuada 9 é Difícil (peso 3)', rotuloDificuldade(9) === 'Difícil' && PESO_TABUADA[9] === 3);
  verificar('cor da tabuada 6 é vermelha (difícil)', corDificuldade(6) === '#FF7055');
  verificar('cor da tabuada 1 é verde (fácil)', corDificuldade(1) === '#32CD32');
}

console.log('\n[7] estimarPontuacaoDesafio (placar ao vivo): dificuldade pesa mais que velocidade');
{
  // Mesmo cenário validado no backend (_calcular_pontuacao_desafio): tabuada
  // difícil respondida devagar (bônus de tempo zerado) ainda vence tabuada
  // fácil respondida no limite da velocidade (bônus de tempo máximo).
  const dificilLento = estimarPontuacaoDesafio([6, 7, 8, 9], 20, 20, 20 * 12);
  const facilRapido = estimarPontuacaoDesafio([1, 2, 10], 20, 20, 20 * 0.1);
  verificar(
    'tabuada difícil (lenta) supera tabuada fácil (rapidíssima)',
    dificilLento.pontuacaoFinal > facilRapido.pontuacaoFinal,
    `difícil=${dificilLento.pontuacaoFinal} vs fácil=${facilRapido.pontuacaoFinal}`
  );
}

console.log('\n[8] estimarPontuacaoDesafio: fórmula bate com o esperado (peso médio × acertos × 10 + bônus)');
{
  const est = estimarPontuacaoDesafio([1], 10, 10, 0); // tabuada 1 (peso 1), 10/10 acertos, tempo 0 (bônus máximo)
  verificar('pontuação base = 10 acertos × peso 1 × 10 = 100', est.pontuacaoBase === 100, `base=${est.pontuacaoBase}`);
  verificar('bônus de tempo máximo (30) quando tempo médio por questão é 0', est.bonusTempo === 30, `bonus=${est.bonusTempo}`);
  verificar('pontuação final = base + bônus = 130', est.pontuacaoFinal === 130, `final=${est.pontuacaoFinal}`);
}

console.log('\n[9] pontosPorAcerto = peso médio das tabuadas escolhidas × 10');
{
  verificar('tabuada 1 (peso 1) dá 10 pontos por acerto', pontosPorAcerto([1]) === 10);
  verificar('tabuada 6 (peso 3) dá 30 pontos por acerto', pontosPorAcerto([6]) === 30);
  verificar('tabuadas 1 e 6 (peso médio 2) dão 20 pontos por acerto', pontosPorAcerto([1, 6]) === 20);
}

console.log(`\n========================================`);
console.log(`RESULTADO: ${passaram} passaram, ${falharam} falharam`);
console.log(`========================================\n`);
if (falharam > 0) process.exit(1);
