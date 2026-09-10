import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api';
import { TabuadaEvolucao, TabuadaRelatorioLinha, Turma } from '../../src/types';
import GraficoLinha from '../../src/components/GraficoLinha';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

// =============================================================================
// RELATÓRIO DA TRILHA DA TABUADA — visão do professor
// Lista de alunos com filtro por turma e ranking por EVOLUÇÃO (não por
// velocidade); tocar num aluno abre o relatório individual completo, com os
// mesmos gráficos reais que o aluno vê em "Minha Evolução".
// =============================================================================

export default function AdminTabuadaRelatorio() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const [linhas, setLinhas] = useState<TabuadaRelatorioLinha[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionada, setTurmaSelecionada] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
  const [alunoDetalhe, setAlunoDetalhe] = useState<TabuadaEvolucao | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  useEffect(() => {
    api.getTurmas().then(setTurmas);
  }, []);

  useEffect(() => {
    setCarregando(true);
    api.getTabuadaRelatorio(turmaSelecionada || undefined).then((dados) => {
      setLinhas(Array.isArray(dados) ? dados : []);
      setCarregando(false);
    });
  }, [turmaSelecionada]);

  const abrirDetalhe = async (alunoId: string) => {
    setCarregandoDetalhe(true);
    setAlunoDetalhe(null);
    const d = await api.getTabuadaRelatorioAluno(alunoId);
    setAlunoDetalhe(d);
    setCarregandoDetalhe(false);
  };

  // ---------- Relatório individual do aluno ----------
  if (alunoDetalhe || carregandoDetalhe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setAlunoDetalhe(null); setCarregandoDetalhe(false); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={cores.ambar} />
          </TouchableOpacity>
          <Text style={styles.title}>Relatório do Aluno</Text>
          <View style={{ width: 40 }} />
        </View>

        {carregandoDetalhe || !alunoDetalhe ? (
          <ActivityIndicator size="large" color={cores.ambar} style={{ marginTop: 60 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.alunoHeader}>
              <View style={styles.alunoAvatar}><Ionicons name="person" size={30} color={cores.ambar} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alunoNome}>{alunoDetalhe.aluno?.nome}</Text>
                <Text style={styles.alunoTurma}>{alunoDetalhe.aluno?.turma || 'Sem turma'}</Text>
              </View>
            </View>

            <View style={styles.resumoFicha}>
              <Text style={styles.fichaLinha}>Cards dominados: <Text style={styles.fichaValor}>{alunoDetalhe.dominados}/{alunoDetalhe.totalCards}</Text></Text>
              <Text style={styles.fichaLinha}>Evolução Leitner: <Text style={styles.fichaValor}>{alunoDetalhe.evolucaoPct.toFixed(1)}%</Text></Text>
              <Text style={styles.fichaLinha}>Tempo médio (acertos): <Text style={styles.fichaValor}>{alunoDetalhe.tempoMedio.toFixed(1)}s</Text></Text>
              <Text style={styles.fichaLinha}>Treinos feitos: <Text style={styles.fichaValor}>{alunoDetalhe.totalSessoes}</Text> ({alunoDetalhe.totalRespostas} respostas)</Text>
              {(alunoDetalhe.totalDicasUsadas > 0 || alunoDetalhe.totalOpcoesUsadas > 0) && (
                <Text style={styles.fichaLinha}>Ajuda usada: <Text style={styles.fichaValor}>{alunoDetalhe.totalDicasUsadas} dica{alunoDetalhe.totalDicasUsadas !== 1 ? 's' : ''} · {alunoDetalhe.totalOpcoesUsadas} opç{alunoDetalhe.totalOpcoesUsadas !== 1 ? 'ões' : 'ão'}</Text></Text>
              )}
              {alunoDetalhe.tabuadasDificeis.length > 0 && (
                <Text style={styles.fichaLinha}>Maior dificuldade: <Text style={[styles.fichaValor, { color: cores.laranja }]}>tabuada {alunoDetalhe.tabuadasDificeis.map(t => `do ${t.tabuada}`).join(' e ')}</Text></Text>
              )}
              {alunoDetalhe.ultimosErros.length > 0 && (
                <Text style={styles.fichaLinha}>Últimos erros: <Text style={[styles.fichaValor, { color: cores.laranja }]}>{alunoDetalhe.ultimosErros.map(op => op.replace('x', ' × ')).join(', ')}</Text></Text>
              )}
              <View style={styles.recomendacaoBox}>
                <Ionicons name="bulb" size={16} color={cores.dourado} />
                <Text style={styles.recomendacaoTexto}>{alunoDetalhe.recomendacao}</Text>
              </View>
            </View>

            <GraficoLinha titulo="Evolução Leitner (%)" pontos={alunoDetalhe.evolucaoPorSessao} cor={cores.ambar} unidade="%" maxYFixo={100} />
            <GraficoLinha titulo="Acertos por treino (%)" pontos={alunoDetalhe.acertosPorSessao} cor={cores.sucesso} unidade="%" maxYFixo={100} />
            <GraficoLinha titulo="Tempo médio por treino (s)" pontos={alunoDetalhe.tempoPorSessao} cor={cores.ciano} unidade="s" />
            <GraficoLinha titulo="Cards dominados por treino" pontos={alunoDetalhe.dominadosPorSessao} cor={cores.roxo} maxYFixo={100} />

            {alunoDetalhe.operacoesDificeis.length > 0 && (
              <View style={styles.cardInfo}>
                <Text style={styles.cardInfoTitulo}>Operações com mais erros</Text>
                {alunoDetalhe.operacoesDificeis.map(op => (
                  <View key={op.operacao} style={styles.linhaDificuldade}>
                    <Text style={styles.dificuldadeOp}>{op.operacao.replace('x', ' × ')}</Text>
                    <Text style={styles.dificuldadeErros}>{op.erros} erro{op.erros > 1 ? 's' : ''} em {op.total}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ---------- Lista geral (ranking por evolução) ----------
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={cores.ambar} />
        </TouchableOpacity>
        <Text style={styles.title}>Trilha da Tabuada — Turmas</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtroContainer} contentContainerStyle={styles.filtroContent}>
        <TouchableOpacity
          style={[styles.filtroChip, turmaSelecionada === '' && styles.filtroChipAtivo]}
          onPress={() => setTurmaSelecionada('')}
        >
          <Text style={[styles.filtroTexto, turmaSelecionada === '' && styles.filtroTextoAtivo]}>Todas as turmas</Text>
        </TouchableOpacity>
        {turmas.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.filtroChip, turmaSelecionada === t.id && styles.filtroChipAtivo]}
            onPress={() => setTurmaSelecionada(t.id)}
          >
            <Text style={[styles.filtroTexto, turmaSelecionada === t.id && styles.filtroTextoAtivo]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {carregando ? (
        <ActivityIndicator size="large" color={cores.ambar} style={{ marginTop: 60 }} />
      ) : linhas.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="school-outline" size={44} color={cores.textoFraco} />
          <Text style={styles.vazioTexto}>Nenhum aluno treinou ainda{turmaSelecionada ? ' nesta turma' : ''}.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.legendaRanking}>Ranking por evolução no método (não por velocidade)</Text>
          {linhas.map(aluno => (
            <TouchableOpacity key={aluno.id} style={styles.linhaAluno} onPress={() => abrirDetalhe(aluno.id)}>
              <Text style={[styles.posicao, aluno.posicao <= 3 && { color: cores.dourado }]}>#{aluno.posicao}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.linhaNome}>{aluno.nome}</Text>
                <Text style={styles.linhaTurma}>{aluno.turma || 'Sem turma'}</Text>
                <View style={styles.linhaBarraFundo}>
                  <View style={[styles.linhaBarraCheia, { width: `${aluno.evolucaoPct}%` }]} />
                </View>
                <View style={styles.linhaStatsRow}>
                  <Text style={styles.linhaStat}>{aluno.evolucaoPct.toFixed(1)}% evolução</Text>
                  <Text style={styles.linhaStat}>{aluno.dominados}/{aluno.totalCards} dominados</Text>
                  {aluno.pioresTabuadas.length > 0 && (
                    <Text style={[styles.linhaStat, { color: cores.laranja }]}>difícil: {aluno.pioresTabuadas.map(f => `×${f}`).join(' ')}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={cores.textoFraco} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: cores.borda },
  backButton: { padding: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: cores.texto, flex: 1, textAlign: 'center' },
  filtroContainer: { maxHeight: 50, marginTop: 12 },
  filtroContent: { paddingHorizontal: 16, gap: 10 },
  filtroChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: cores.superficie },
  filtroChipAtivo: { backgroundColor: cores.ambar },
  filtroTexto: { color: cores.textoFraco, fontWeight: '600', fontSize: 12 },
  filtroTextoAtivo: { color: cores.sobreAcento },
  scroll: { padding: 16, paddingBottom: 50 },
  legendaRanking: { color: cores.textoFraco, fontSize: 11, marginBottom: 10, textAlign: 'center' },
  vazio: { alignItems: 'center', padding: 40, gap: 12 },
  vazioTexto: { color: cores.textoFraco, fontSize: 14, textAlign: 'center' },
  linhaAluno: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cores.superficie, borderRadius: 14, padding: 14, marginBottom: 10 },
  posicao: { color: cores.textoFraco, fontSize: 16, fontWeight: '900', minWidth: 34 },
  linhaNome: { color: cores.texto, fontSize: 15, fontWeight: '800' },
  linhaTurma: { color: cores.textoFraco, fontSize: 11, marginTop: 1 },
  linhaBarraFundo: { height: 6, backgroundColor: cores.fundo, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  linhaBarraCheia: { height: '100%', backgroundColor: cores.ambar, borderRadius: 3 },
  linhaStatsRow: { flexDirection: 'row', gap: 12, marginTop: 5, flexWrap: 'wrap' },
  linhaStat: { color: cores.textoFraco, fontSize: 11, fontWeight: '600' },
  alunoHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  alunoAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: cores.superficie, alignItems: 'center', justifyContent: 'center' },
  alunoNome: { color: cores.texto, fontSize: 19, fontWeight: '900' },
  alunoTurma: { color: cores.textoFraco, fontSize: 13 },
  resumoFicha: { backgroundColor: cores.superficie, borderRadius: 14, padding: 16, marginBottom: 14, gap: 6 },
  fichaLinha: { color: cores.textoFraco, fontSize: 13 },
  fichaValor: { color: cores.texto, fontWeight: '800' },
  recomendacaoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cores.superficieAlt, borderRadius: 10, padding: 10, marginTop: 8 },
  recomendacaoTexto: { color: cores.dourado, fontSize: 12, fontWeight: '700', flex: 1 },
  cardInfo: { backgroundColor: cores.superficie, borderRadius: 14, padding: 14, marginBottom: 14 },
  cardInfoTitulo: { color: cores.ambar, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  linhaDificuldade: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: cores.borda },
  dificuldadeOp: { color: cores.texto, fontSize: 15, fontWeight: '800' },
  dificuldadeErros: { color: cores.laranja, fontSize: 12, fontWeight: '600' },
});
