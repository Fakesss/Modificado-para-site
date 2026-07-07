import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../src/services/api';
import { TabuadaEvolucao } from '../src/types';
import GraficoLinha from '../src/components/GraficoLinha';

// =============================================================================
// MINHA EVOLUÇÃO — acompanhamento do aluno na Trilha da Tabuada
// Todos os números e gráficos vêm do histórico REAL de respostas (calculados no
// servidor a partir de db.tabuada_respostas) — nada é simulado.
// =============================================================================

export default function MinhaEvolucaoTabuada() {
  const router = useRouter();
  const [dados, setDados] = useState<TabuadaEvolucao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async () => {
    const d = await api.getTabuadaEvolucao();
    setDados(d);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

  const aoAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFB300" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!dados) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#FFB300" /></TouchableOpacity>
          <Text style={styles.headerTitulo}>Minha Evolução</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.vazioCentro}>
          <Ionicons name="cloud-offline-outline" size={44} color="#665" />
          <Text style={styles.vazioTexto}>Não foi possível carregar seus dados agora. Tente novamente.</Text>
          <TouchableOpacity style={styles.btnTentar} onPress={() => { setCarregando(true); carregar(); }}>
            <Text style={styles.btnTentarTexto}>TENTAR DE NOVO</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pctDominados = (dados.dominados / dados.totalCards) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={26} color="#FFB300" /></TouchableOpacity>
        <Text style={styles.headerTitulo}>Minha Evolução</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor="#FFB300" />}
      >
        {dados.totalRespostas === 0 ? (
          <View style={styles.vazioCentro}>
            <Ionicons name="rocket-outline" size={44} color="#FFB300" />
            <Text style={styles.vazioTexto}>Você ainda não fez nenhum treino. Complete seu primeiro treino da Trilha da Tabuada e volte aqui pra ver seu progresso!</Text>
          </View>
        ) : (
          <>
            {/* Destaques */}
            <View style={styles.destaquesRow}>
              <View style={styles.destaqueBox}>
                <Text style={styles.destaqueValor}>{dados.evolucaoPct.toFixed(1)}%</Text>
                <Text style={styles.destaqueLabel}>Evolução Leitner</Text>
              </View>
              <View style={styles.destaqueBox}>
                <Text style={[styles.destaqueValor, { color: '#32CD32' }]}>{dados.dominados}/{dados.totalCards}</Text>
                <Text style={styles.destaqueLabel}>Cards dominados</Text>
              </View>
            </View>
            <View style={styles.destaquesRow}>
              <View style={styles.destaqueBox}>
                <Text style={[styles.destaqueValor, { color: '#7FD4FF' }]}>{dados.tempoMedio.toFixed(1)}s</Text>
                <Text style={styles.destaqueLabel}>Tempo médio (acertos)</Text>
              </View>
              <View style={styles.destaqueBox}>
                <Text style={[styles.destaqueValor, { color: '#BB99FF' }]}>{dados.totalSessoes}</Text>
                <Text style={styles.destaqueLabel}>Treinos feitos</Text>
              </View>
            </View>

            {/* Barra de dominados */}
            <View style={styles.barraCard}>
              <View style={styles.barraFundo}>
                <View style={[styles.barraCheia, { width: `${pctDominados}%` }]} />
              </View>
              <Text style={styles.barraLegenda}>Rumo aos {dados.totalCards} cards dominados!</Text>
            </View>

            {(dados.totalDicasUsadas > 0 || dados.totalOpcoesUsadas > 0) && (
              <View style={styles.cardInfo}>
                <Text style={styles.cardInfoTitulo}>Ajuda usada nos seus treinos</Text>
                <Text style={styles.cardInfoTexto}>
                  {dados.totalDicasUsadas} dica{dados.totalDicasUsadas !== 1 ? 's' : ''} · {dados.totalOpcoesUsadas} opç{dados.totalOpcoesUsadas !== 1 ? 'ões' : 'ão'}
                </Text>
              </View>
            )}

            {/* Gráficos — sempre com dados reais, um ponto por treino feito */}
            <GraficoLinha titulo="Evolução Leitner (%)" pontos={dados.evolucaoPorSessao} cor="#FFB300" unidade="%" maxYFixo={100} />
            <GraficoLinha titulo="Acertos por treino (%)" pontos={dados.acertosPorSessao} cor="#32CD32" unidade="%" maxYFixo={100} />
            <GraficoLinha titulo="Tempo médio por treino (s)" pontos={dados.tempoPorSessao} cor="#7FD4FF" unidade="s" />
            <GraficoLinha titulo="Cards dominados por treino" pontos={dados.dominadosPorSessao} cor="#BB99FF" maxYFixo={100} />

            {/* Dificuldades principais */}
            {dados.operacoesDificeis.length > 0 && (
              <View style={styles.cardInfo}>
                <Text style={styles.cardInfoTitulo}>Precisa revisar mais</Text>
                {dados.operacoesDificeis.map(op => (
                  <View key={op.operacao} style={styles.linhaDificuldade}>
                    <Text style={styles.dificuldadeOp}>{op.operacao.replace('x', ' × ')}</Text>
                    <Text style={styles.dificuldadeErros}>{op.erros} erro{op.erros > 1 ? 's' : ''} em {op.total}</Text>
                  </View>
                ))}
              </View>
            )}

            {dados.cardsVencidos.length > 0 && (
              <View style={styles.cardInfo}>
                <Text style={styles.cardInfoTitulo}>Esperando sua revisão hoje</Text>
                <Text style={styles.cardInfoTexto}>{dados.cardsVencidos.map(op => op.replace('x', ' × ')).join('   ')}</Text>
              </View>
            )}

            <View style={[styles.cardInfo, styles.cardRecomendacao]}>
              <Ionicons name="bulb" size={18} color="#FFD700" />
              <Text style={styles.recomendacaoTexto}>{dados.recomendacao}</Text>
            </View>

            <TouchableOpacity style={styles.btnTreinar} onPress={() => router.back()}>
              <Ionicons name="play" size={18} color="#1a1200" />
              <Text style={styles.btnTreinarTexto}>VOLTAR E TREINAR</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b04' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#332a10' },
  headerTitulo: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  scroll: { padding: 16, paddingBottom: 50 },
  vazioCentro: { alignItems: 'center', padding: 40, gap: 14 },
  vazioTexto: { color: '#887', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  btnTentar: { backgroundColor: '#332a10', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  btnTentarTexto: { color: '#FFB300', fontWeight: '800', fontSize: 12 },
  destaquesRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  destaqueBox: { flex: 1, backgroundColor: '#14142e', borderRadius: 14, borderWidth: 1, borderColor: '#26264a', paddingVertical: 16, alignItems: 'center' },
  destaqueValor: { color: '#FFB300', fontSize: 24, fontWeight: '900' },
  destaqueLabel: { color: '#889', fontSize: 11, marginTop: 3 },
  barraCard: { marginBottom: 16 },
  barraFundo: { height: 12, backgroundColor: '#14142e', borderRadius: 6, borderWidth: 1, borderColor: '#26264a', overflow: 'hidden' },
  barraCheia: { height: '100%', backgroundColor: '#32CD32', borderRadius: 6 },
  barraLegenda: { color: '#667', fontSize: 10, textAlign: 'center', marginTop: 5 },
  cardInfo: { backgroundColor: '#14142e', borderRadius: 14, borderWidth: 1, borderColor: '#26264a', padding: 14, marginBottom: 14 },
  cardInfoTitulo: { color: '#FFB300', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  cardInfoTexto: { color: '#CCD', fontSize: 14, fontWeight: '600', lineHeight: 22 },
  linhaDificuldade: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#1e1e3a' },
  dificuldadeOp: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  dificuldadeErros: { color: '#FF7055', fontSize: 12, fontWeight: '600' },
  cardRecomendacao: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e1a08', borderColor: '#443a10' },
  recomendacaoTexto: { color: '#FFD700', fontSize: 13, fontWeight: '700', flex: 1 },
  btnTreinar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFB300', borderRadius: 14, paddingVertical: 14, marginTop: 6 },
  btnTreinarTexto: { color: '#1a1200', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
