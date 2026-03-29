import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router'; 
import * as api from '../../src/services/api';
import { RankingItem, Turma } from '../../src/types';

export default function Ranking() {
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
    } catch (error) {
      console.error('Error loading ranking:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTurma]);

  const loadRanking = async (turmaId: string | null) => {
    try {
      const data = turmaId
        ? await api.getRankingPorTurma(turmaId)
        : await api.getRankingGeral();
      
      const sortedData = (data || []).sort((a: RankingItem, b: RankingItem) => b.pontosTotais - a.pontosTotais);
      setRanking(sortedData);
    } catch (error) {
      console.error('Error loading ranking:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRanking(selectedTurma);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="trophy" size={28} color="#FFD700" />
        <Text style={styles.title}>Ranking das Equipes</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterButton, !selectedTurma && styles.filterButtonActive]}
          onPress={() => setSelectedTurma(null)}
        >
          <Text style={[styles.filterText, !selectedTurma && styles.filterTextActive]}>Geral</Text>
        </TouchableOpacity>
        {turmas.map((turma) => (
          <TouchableOpacity
            key={turma.id}
            style={[styles.filterButton, selectedTurma === turma.id && styles.filterButtonActive]}
            onPress={() => setSelectedTurma(turma.id)}
          >
            <Text style={[styles.filterText, selectedTurma === turma.id && styles.filterTextActive]}>{turma.nome}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {/* ==================================================== */}
        {/* PÓDIO NOVO - DELICADO E ARREDONDADO */}
        {/* ==================================================== */}
        <View style={styles.podiumContainer}>
          {/* 2º LUGAR */}
          <View style={styles.podiumItem}>
            {ranking.length >= 2 ? (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: ranking[1].cor }]}>
                  <Text style={styles.teamNamePillText} numberOfLines={1}>{ranking[1].nome}</Text>
                </View>
                <View style={[styles.podiumBox, styles.podiumBox2, { backgroundColor: ranking[1].cor + '25' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: ranking[1].cor }]}>
                    <Text style={styles.insidePositionText}>2º</Text>
                  </View>
                  <Ionicons name="medal" size={28} color={ranking[1].cor} />
                  <Text style={[styles.podiumPoints, { color: ranking[1].cor }]}>{ranking[1].pontosTotais} pts</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: '#333' }]}><Text style={styles.teamNamePillText}>-</Text></View>
                <View style={[styles.podiumBox, styles.podiumBox2, { backgroundColor: '#33333330' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: '#333' }]}><Text style={[styles.insidePositionText, {color: '#888'}]}>2º</Text></View>
                  <Ionicons name="medal-outline" size={28} color="#555" />
                  <Text style={[styles.podiumPoints, { color: '#555' }]}>- pts</Text>
                </View>
              </>
            )}
          </View>

          {/* 1º LUGAR */}
          <View style={[styles.podiumItem, { zIndex: 2 }]}>
            {ranking.length >= 1 ? (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: ranking[0].cor }]}>
                  <Text style={styles.teamNamePillText} numberOfLines={1}>{ranking[0].nome}</Text>
                </View>
                <View style={[styles.podiumBox, styles.podiumBox1, { backgroundColor: ranking[0].cor + '25' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: ranking[0].cor, width: 44, height: 44, borderRadius: 22 }]}>
                    <Text style={[styles.insidePositionText, { fontSize: 18 }]}>1º</Text>
                  </View>
                  <Ionicons name="trophy" size={36} color={ranking[0].cor} />
                  <Text style={[styles.podiumPoints, { color: ranking[0].cor, fontSize: 16 }]}>{ranking[0].pontosTotais} pts</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: '#333' }]}><Text style={styles.teamNamePillText}>-</Text></View>
                <View style={[styles.podiumBox, styles.podiumBox1, { backgroundColor: '#33333330' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: '#333', width: 44, height: 44, borderRadius: 22 }]}><Text style={[styles.insidePositionText, {color: '#888', fontSize: 18}]}>1º</Text></View>
                  <Ionicons name="trophy-outline" size={36} color="#555" />
                  <Text style={[styles.podiumPoints, { color: '#555', fontSize: 16 }]}>- pts</Text>
                </View>
              </>
            )}
          </View>

          {/* 3º LUGAR */}
          <View style={styles.podiumItem}>
            {ranking.length >= 3 ? (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: ranking[2].cor }]}>
                  <Text style={styles.teamNamePillText} numberOfLines={1}>{ranking[2].nome}</Text>
                </View>
                <View style={[styles.podiumBox, styles.podiumBox3, { backgroundColor: ranking[2].cor + '25' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: ranking[2].cor }]}>
                    <Text style={styles.insidePositionText}>3º</Text>
                  </View>
                  <Ionicons name="medal" size={24} color={ranking[2].cor} />
                  <Text style={[styles.podiumPoints, { color: ranking[2].cor }]}>{ranking[2].pontosTotais} pts</Text>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.teamNamePill, { backgroundColor: '#333' }]}><Text style={styles.teamNamePillText}>-</Text></View>
                <View style={[styles.podiumBox, styles.podiumBox3, { backgroundColor: '#33333330' }]}>
                  <View style={[styles.insidePositionCircle, { backgroundColor: '#333' }]}><Text style={[styles.insidePositionText, {color: '#888'}]}>3º</Text></View>
                  <Ionicons name="medal-outline" size={24} color="#555" />
                  <Text style={[styles.podiumPoints, { color: '#555' }]}>- pts</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* LISTA COMPLETA */}
        <Text style={styles.sectionTitle}>Classificação Completa</Text>
        {ranking.map((item, index) => {
          const posicaoReal = index + 1;
          return (
            <View key={item.id} style={[styles.rankingItem, { borderLeftColor: item.cor, borderLeftWidth: 4 }]}>
              <View style={[styles.positionBadge, { backgroundColor: item.cor }]}>
                <Text style={styles.positionBadgeText}>{posicaoReal}º</Text>
              </View>
              <View style={styles.rankingInfo}>
                <Text style={styles.teamName}>Equipe {item.nome}</Text>
                <Text style={[styles.teamPoints, { color: item.cor }]}>
                  {item.pontosTotais} pontos
                </Text>
              </View>
              <Ionicons
                name={posicaoReal === 1 ? 'trophy' : posicaoReal <= 3 ? 'medal' : 'ribbon'}
                size={24}
                color={item.cor}
              />
            </View>
          );
        })}

        {ranking.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum dado de ranking disponível</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  filterContainer: { maxHeight: 50 },
  filterContent: { paddingHorizontal: 16, gap: 10 },
  filterButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1a1a2e' },
  filterButtonActive: { backgroundColor: '#FFD700' },
  filterText: { color: '#888', fontWeight: '600' },
  filterTextActive: { color: '#000' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  
  // ESTILOS DO PÓDIO DELICADO
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 32, paddingHorizontal: 4 },
  podiumItem: { flex: 1, alignItems: 'center', marginHorizontal: 6 },
  
  teamNamePill: { width: '100%', paddingVertical: 6, borderRadius: 20, alignItems: 'center', marginBottom: 8, zIndex: 10 },
  teamNamePillText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
  
  podiumBox: { width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  podiumBox1: { height: 140 },
  podiumBox2: { height: 120 },
  podiumBox3: { height: 100 },
  
  insidePositionCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  insidePositionText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  
  podiumPoints: { fontWeight: 'bold', fontSize: 14 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  rankingItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  positionBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  positionBadgeText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  rankingInfo: { flex: 1 },
  teamName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  teamPoints: { fontSize: 14, marginTop: 4 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
