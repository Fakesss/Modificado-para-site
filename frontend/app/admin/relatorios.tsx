import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Turma, Equipe } from '../../src/types';

export default function AdminRelatorios() {
  const router = useRouter();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [bnccErros, setBnccErros] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadBNCC();
  }, [selectedTurma, selectedEquipe]);

  const loadData = async () => {
    try {
      const [turmasData, equipesData, rankingData, usuariosData] = await Promise.all([
        api.getTurmas(),
        api.getEquipes(),
        api.getRankingGeral(),
        api.getRelatorioUsuarios(),
      ]);
      setTurmas(turmasData);
      setEquipes(equipesData);
      setRanking(rankingData);
      setUsuarios(usuariosData);
      await loadBNCC();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBNCC = async () => {
    try {
      const data = await api.getBNCCErros(
        selectedTurma || undefined,
        selectedEquipe || undefined
      );
      setBnccErros(data);
    } catch (error) {
      console.error('Error loading BNCC:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {/* Ranking Section */}
        <Text style={styles.sectionTitle}>Ranking das Equipes</Text>
        <View style={styles.rankingContainer}>
          {ranking.map((item) => (
            <View key={item.id} style={[styles.rankingItem, { borderLeftColor: item.cor }]}>
              <View style={[styles.positionBadge, { backgroundColor: item.cor }]}>
                <Text style={styles.positionText}>{item.posicao}º</Text>
              </View>
              <Text style={styles.rankingName}>Equipe {item.nome}</Text>
              <Text style={[styles.rankingPoints, { color: item.cor }]}>
                {item.pontosTotais} pts
              </Text>
            </View>
          ))}
        </View>

        {/* BNCC Errors Section */}
        <Text style={styles.sectionTitle}>Habilidades BNCC Mais Erradas</Text>
        
        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                !selectedTurma && !selectedEquipe && styles.filterButtonActive,
              ]}
              onPress={() => {
                setSelectedTurma('');
                setSelectedEquipe('');
              }}
            >
              <Text
                style={[
                  styles.filterText,
                  !selectedTurma && !selectedEquipe && styles.filterTextActive,
                ]}
              >
                Geral
              </Text>
            </TouchableOpacity>
            {turmas.map((turma) => (
              <TouchableOpacity
                key={turma.id}
                style={[
                  styles.filterButton,
                  selectedTurma === turma.id && styles.filterButtonActive,
                ]}
                onPress={() => {
                  setSelectedTurma(selectedTurma === turma.id ? '' : turma.id);
                  setSelectedEquipe('');
                }}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedTurma === turma.id && styles.filterTextActive,
                  ]}
                >
                  {turma.nome}
                </Text>
              </TouchableOpacity>
            ))}
            {equipes.map((equipe) => (
              <TouchableOpacity
                key={equipe.id}
                style={[
                  styles.filterButton,
                  { borderColor: equipe.cor },
                  selectedEquipe === equipe.id && { backgroundColor: equipe.cor },
                ]}
                onPress={() => {
                  setSelectedEquipe(selectedEquipe === equipe.id ? '' : equipe.id);
                  setSelectedTurma('');
                }}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: selectedEquipe === equipe.id ? '#000' : equipe.cor },
                  ]}
                >
                  {equipe.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* BNCC List */}
        {bnccErros.length > 0 ? (
          bnccErros.map((item, index) => (
            <View key={index} style={styles.bnccItem}>
              <View style={styles.bnccRank}>
                <Text style={styles.bnccRankText}>{index + 1}</Text>
              </View>
              <Text style={styles.bnccHabilidade}>{item.habilidade}</Text>
              <View style={styles.bnccErrosContainer}>
                <Ionicons name="close-circle" size={16} color="#E74C3C" />
                <Text style={styles.bnccErrosText}>{item.totalErros} erros</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={40} color="#666" />
            <Text style={styles.emptyText}>Nenhum dado disponível</Text>
          </View>
        )}

        {/* Top Students */}
        <Text style={styles.sectionTitle}>Melhores Alunos</Text>
        {usuarios
          .filter((u) => u.perfil !== 'ADMIN')
          .sort((a, b) => b.pontosTotais - a.pontosTotais)
          .slice(0, 10)
          .map((usuario, index) => {
            const equipe = equipes.find((e) => e.id === usuario.equipeId);
            return (
              <View key={usuario.id} style={styles.userItem}>
                <View style={styles.userRank}>
                  <Text style={styles.userRankText}>{index + 1}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{usuario.nome}</Text>
                  <View style={styles.userMeta}>
                    {equipe && (
                      <View style={[styles.teamBadge, { backgroundColor: equipe.cor + '30' }]}>
                        <Text style={[styles.teamText, { color: equipe.cor }]}>{equipe.nome}</Text>
                      </View>
                    )}
                    <Text style={styles.userStats}>
                      {usuario.videosConcluidos} vídeos | {usuario.exerciciosRealizados} exercícios
                    </Text>
                  </View>
                </View>
                <View style={styles.userPoints}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.userPointsText}>{usuario.pontosTotais}</Text>
                </View>
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 16,
  },
  rankingContainer: {
    gap: 10,
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  positionText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rankingName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  rankingPoints: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  filterText: {
    color: '#888',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#000',
  },
  bnccItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  bnccRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E74C3C30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bnccRankText: {
    color: '#E74C3C',
    fontWeight: 'bold',
    fontSize: 12,
  },
  bnccHabilidade: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  bnccErrosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bnccErrosText: {
    color: '#E74C3C',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD70030',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userRankText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  teamText: {
    fontSize: 10,
    fontWeight: '600',
  },
  userStats: {
    color: '#666',
    fontSize: 11,
  },
  userPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userPointsText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
