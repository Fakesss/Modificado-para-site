import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as api from '../src/services/api';
import { TabuadaDesafioResultado } from '../src/types';
import { corDificuldade, QUANTIDADES_DESAFIO, QuantidadeDesafio } from '../src/services/desafioTabuada';

// =============================================================================
// RANKING DO DESAFIO FLASH CARDS — segmentado por quantidade de questões
// (15/20/30), já que partidas de tamanhos diferentes não são comparáveis.
// Ordenado por pontuação final, sempre calculada pelo servidor.
// =============================================================================

function formatarTempo(segundosTotais: number): string {
  const s = Math.max(0, Math.round(segundosTotais));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

export default function DesafioFlashCardsRanking() {
  const router = useRouter();
  const [quantidade, setQuantidade] = useState<QuantidadeDesafio>(15);
  const [linhas, setLinhas] = useState<TabuadaDesafioResultado[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async (q: QuantidadeDesafio) => {
    setCarregando(true);
    const dados = await api.getTabuadaDesafioRanking(q);
    setLinhas(Array.isArray(dados) ? dados : []);
    setCarregando(false);
  }, []);

  // useFocusEffect já cobre a carga inicial (mount em foco), a troca de aba
  // (quantidade muda) e o retorno à tela vindo de outra rota — sem duplicar fetch.
  useFocusEffect(useCallback(() => { carregar(quantidade); }, [quantidade, carregar]));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFB300" />
        </TouchableOpacity>
        <Text style={styles.title}>Ranking — Desafio Flash Cards</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filtroRow}>
        {QUANTIDADES_DESAFIO.map(q => (
          <TouchableOpacity
            key={q}
            style={[styles.filtroChip, quantidade === q && styles.filtroChipAtivo]}
            onPress={() => setQuantidade(q)}
          >
            <Text style={[styles.filtroTexto, quantidade === q && styles.filtroTextoAtivo]}>{q} Questões</Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color="#FFB300" style={{ marginTop: 60 }} />
      ) : linhas.length === 0 ? (
        <View style={styles.vazio}>
          <Ionicons name="podium-outline" size={44} color="#665" />
          <Text style={styles.vazioTexto}>Ninguém completou um desafio de {quantidade} questões ainda. Seja o primeiro!</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {linhas.map((linha, i) => (
            <View key={linha.id || i} style={styles.linha}>
              <Text style={[styles.posicao, i < 3 && { color: '#FFD700' }]}>#{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{linha.nome}</Text>
                {linha.turma ? <Text style={styles.turma}>{linha.turma}</Text> : null}
                <View style={styles.badgesRow}>
                  {linha.tabuadas.map(t => (
                    <View key={t} style={[styles.badge, { borderColor: corDificuldade(t) }]}>
                      <Text style={[styles.badgeTexto, { color: corDificuldade(t) }]}>{t}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.stat}>{linha.acertos}/{linha.quantidadeQuestoes} acertos</Text>
                  <Text style={styles.stat}>⏱ {formatarTempo(linha.tempoTotalSegundos)}</Text>
                  <Text style={styles.stat}>⚡ {linha.tempoMedioPorQuestao.toFixed(1)}s/questão</Text>
                </View>
              </View>
              <Text style={styles.pontuacao}>{linha.pontuacaoFinal.toFixed(0)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  backButton: { padding: 8 },
  title: { fontSize: 15, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
  filtroRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  filtroChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1a1a2e' },
  filtroChipAtivo: { backgroundColor: '#FFB300' },
  filtroTexto: { color: '#888', fontWeight: '700', fontSize: 12 },
  filtroTextoAtivo: { color: '#1a1200' },
  vazio: { alignItems: 'center', padding: 40, gap: 14 },
  vazioTexto: { color: '#667', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  scroll: { padding: 16, paddingBottom: 50 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginBottom: 10 },
  posicao: { color: '#888', fontSize: 16, fontWeight: '900', minWidth: 34 },
  nome: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  turma: { color: '#777', fontSize: 11, marginTop: 1 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  badge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeTexto: { fontWeight: '900', fontSize: 10 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  stat: { color: '#998', fontSize: 11, fontWeight: '600' },
  pontuacao: { color: '#FFD700', fontSize: 20, fontWeight: '900' },
});
