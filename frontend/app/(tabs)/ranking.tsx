import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router'; 
import { useTema, CoresTema, textoSobre } from '../../src/context/ThemeContext';
import * as api from '../../src/services/api';
import { RankingItem, Turma } from '../../src/types';

export default function Ranking() {
  const { cores, corEquipe } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [selectedTurma, setSelectedTurma] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [turmasData] = await Promise.all([api.getTurmas()]);
      const turmasOrdenadas = (turmasData || []).sort((a, b) => 
        a.nome.localeCompare(b.nome, undefined, { numeric: true, sensitivity: 'base' })
      );
      setTurmas(turmasOrdenadas);
      await loadRanking(selectedTurma);
    } catch (error) { console.error('Error loading ranking:', error); } 
    finally { setLoading(false); }
  }, [selectedTurma]);

  const loadRanking = async (turmaId: string | null) => {
    try {
      const data = turmaId ? await api.getRankingPorTurma(turmaId) : await api.getRankingGeral();
      const sortedData = (data || []).sort((a: RankingItem, b: RankingItem) => b.pontosTotais - a.pontosTotais);
      setRanking(sortedData);
    } catch (error) { console.error('Error loading ranking:', error); }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRanking(selectedTurma);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={cores.dourado} /></View>
      </SafeAreaView>
    );
  }

  // 🚨 MATEMÁTICA RELATIVA TAMBÉM APLICADA AQUI
  const p1 = ranking.length > 0 ? ranking[0].pontosTotais : 0;
  const p2 = ranking.length > 1 ? ranking[1].pontosTotais : 0;
  const p3 = ranking.length > 2 ? ranking[2].pontosTotais : 0;

  const getDynamicHeights = () => {
    if (p1 === 0) return { 1: 140, 2: 115, 3: 90 };
    if ((p1 - p3) <= p1 * 0.10) return { 1: 140, 2: 115, 3: 90 };

    const h1 = 140;
    const ratio2 = p2 / p1;
    const h2 = 95 + (ratio2 * 35); 
    
    const ratio3 = p2 > 0 ? (p3 / p2) : 0;
    const maxH3 = h2 - 10;
    const h3 = 75 + (ratio3 * (maxH3 - 75)); 

    return { 1: h1, 2: h2, 3: h3 };
  };

  const heights = getDynamicHeights();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={28} color={cores.dourado} />
        <Text style={styles.title}>Ranking das Equipes</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={styles.filterContent}>
        <TouchableOpacity style={[styles.filterButton, !selectedTurma && styles.filterButtonActive]} onPress={() => setSelectedTurma(null)}>
          <Text style={[styles.filterText, !selectedTurma && styles.filterTextActive]}>Geral</Text>
        </TouchableOpacity>
        {turmas.map((turma) => (
          <TouchableOpacity key={turma.id} style={[styles.filterButton, selectedTurma === turma.id && styles.filterButtonActive]} onPress={() => setSelectedTurma(turma.id)}>
            <Text style={[styles.filterText, selectedTurma === turma.id && styles.filterTextActive]}>{turma.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.dourado} />}>
        
        <View style={styles.podiumContainer}>
          {/* 2º LUGAR */}
          <View style={styles.podiumItem}>
            {ranking.length >= 2 ? (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: corEquipe(ranking[1].cor) }]}><Text style={[styles.teamNamePillText, { color: textoSobre(corEquipe(ranking[1].cor)) }]} numberOfLines={1}>{ranking[1].nome}</Text></View>
                <View style={[styles.podiumBox, { height: heights[2], backgroundColor: corEquipe(ranking[1].cor) + '25' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: corEquipe(ranking[1].cor) }]}><Text style={[styles.insidePositionText, { color: textoSobre(corEquipe(ranking[1].cor)) }]}>2º</Text></View>
                  <Ionicons name="medal" size={28} color={corEquipe(ranking[1].cor)} />
                  <Text style={[styles.podiumPoints, { color: corEquipe(ranking[1].cor) }]}>{ranking[1].pontosTotais} pts</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: cores.borda }]}><Text style={[styles.teamNamePillText, { color: cores.textoFraco }]}>-</Text></View>
                <View style={[styles.podiumBox, { height: 115, backgroundColor: cores.borda + '30' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: cores.borda }]}><Text style={[styles.insidePositionText, {color: cores.textoFraco}]}>2º</Text></View>
                  <Ionicons name="medal-outline" size={28} color={cores.textoFraco} />
                  <Text style={[styles.podiumPoints, { color: cores.textoFraco }]}>- pts</Text>
                </View>
              </>
            )}
          </View>

          {/* 1º LUGAR */}
          <View style={[styles.podiumItem, { zIndex: 2 }]}>
            {ranking.length >= 1 ? (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: corEquipe(ranking[0].cor) }]}><Text style={[styles.teamNamePillText, { color: textoSobre(corEquipe(ranking[0].cor)) }]} numberOfLines={1}>{ranking[0].nome}</Text></View>
                <View style={[styles.podiumBox, { height: heights[1], backgroundColor: corEquipe(ranking[0].cor) + '25' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: corEquipe(ranking[0].cor) }]}><Text style={[styles.insidePositionText, { color: textoSobre(corEquipe(ranking[0].cor)) }]}>1º</Text></View>
                  <Ionicons name="trophy" size={32} color={corEquipe(ranking[0].cor)} />
                  <Text style={[styles.podiumPoints, { color: corEquipe(ranking[0].cor) }]}>{ranking[0].pontosTotais} pts</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: cores.borda }]}><Text style={[styles.teamNamePillText, { color: cores.textoFraco }]}>-</Text></View>
                <View style={[styles.podiumBox, { height: 140, backgroundColor: cores.borda + '30' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: cores.borda }]}><Text style={[styles.insidePositionText, {color: cores.textoFraco}]}>1º</Text></View>
                  <Ionicons name="trophy-outline" size={32} color={cores.textoFraco} />
                  <Text style={[styles.podiumPoints, { color: cores.textoFraco }]}>- pts</Text>
                </View>
              </>
            )}
          </View>

          {/* 3º LUGAR */}
          <View style={styles.podiumItem}>
            {ranking.length >= 3 ? (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: corEquipe(ranking[2].cor) }]}><Text style={[styles.teamNamePillText, { color: textoSobre(corEquipe(ranking[2].cor)) }]} numberOfLines={1}>{ranking[2].nome}</Text></View>
                <View style={[styles.podiumBox, { height: heights[3], backgroundColor: corEquipe(ranking[2].cor) + '25' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: corEquipe(ranking[2].cor) }]}><Text style={[styles.insidePositionText, { color: textoSobre(corEquipe(ranking[2].cor)) }]}>3º</Text></View>
                  <Ionicons name="medal" size={28} color={corEquipe(ranking[2].cor)} />
                  <Text style={[styles.podiumPoints, { color: corEquipe(ranking[2].cor) }]}>{ranking[2].pontosTotais} pts</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: cores.borda }]}><Text style={[styles.teamNamePillText, { color: cores.textoFraco }]}>-</Text></View>
                <View style={[styles.podiumBox, { height: 90, backgroundColor: cores.borda + '30' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: cores.borda }]}><Text style={[styles.insidePositionText, {color: cores.textoFraco}]}>3º</Text></View>
                  <Ionicons name="medal-outline" size={28} color={cores.textoFraco} />
                  <Text style={[styles.podiumPoints, { color: cores.textoFraco }]}>- pts</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Classificação Completa</Text>
        {ranking.map((item, index) => {
          const posicaoReal = index + 1;
          return (
            <View key={item.id} style={[styles.rankingItem, { borderLeftColor: corEquipe(item.cor), borderLeftWidth: 4 }]}>
              <View style={[styles.positionBadge, { backgroundColor: corEquipe(item.cor) }]}><Text style={[styles.positionBadgeText, { color: textoSobre(corEquipe(item.cor)) }]}>{posicaoReal}º</Text></View>
              <View style={styles.rankingInfo}>
                <Text style={styles.teamName}>Equipe {item.nome}</Text>
                <Text style={[styles.teamPoints, { color: corEquipe(item.cor) }]}>{item.pontosTotais} pontos</Text>
              </View>
              <Ionicons name={posicaoReal === 1 ? 'trophy' : posicaoReal <= 3 ? 'medal' : 'ribbon'} size={24} color={corEquipe(item.cor)} />
            </View>
          );
        })}

        {ranking.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={cores.textoFraco} />
            <Text style={styles.emptyText}>Nenhum dado de ranking disponível</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: cores.texto },
  filterContainer: { maxHeight: 50 },
  filterContent: { paddingHorizontal: 16, gap: 10 },
  filterButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: cores.superficie },
  filterButtonActive: { backgroundColor: cores.dourado },
  filterText: { color: cores.textoFraco, fontWeight: '600' },
  filterTextActive: { color: cores.sobreAcento },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 32, paddingHorizontal: 4 },
  podiumItem: { flex: 1, alignItems: 'center', marginHorizontal: 6 },
  teamNamePill: { width: '92%', alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8, zIndex: 10, minHeight: 38, borderWidth: 1, borderColor: cores.superficie },
  teamNamePillText: { color: cores.texto, fontWeight: 'bold', fontSize: 13, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  podiumBox: { width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  insidePositionCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  insidePositionText: { color: cores.texto, fontWeight: 'bold', fontSize: 14 },
  podiumPoints: { fontWeight: 'bold', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: cores.texto, marginBottom: 16 },
  rankingItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficie, borderRadius: 12, padding: 16, marginBottom: 12 },
  positionBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  positionBadgeText: { color: cores.texto, fontWeight: 'bold', fontSize: 14 },
  rankingInfo: { flex: 1 },
  teamName: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  teamPoints: { fontSize: 14, marginTop: 4 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: cores.textoFraco, fontSize: 16, marginTop: 16 },
});
