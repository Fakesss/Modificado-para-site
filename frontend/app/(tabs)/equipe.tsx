import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import { Equipe as EquipeType } from '../../src/types';

interface AlunoRanking {
  id: string;
  nome: string;
  pontosTotais: number;
  streakDias: number;
  posicao: number;
}

interface BNCCAnalysis {
  dificuldades: { habilidade: string; erros: number }[];
  facilidades: { habilidade: string; acertos: number }[];
}

export default function EquipeScreen() {
  const { user } = useAuth();
  const [equipe, setEquipe] = useState<EquipeType | null>(null);
  const [alunos, setAlunos] = useState<AlunoRanking[]>([]);
  const [selectedAluno, setSelectedAluno] = useState<string | null>(null);
  const [bnccAnalysis, setBnccAnalysis] = useState<BNCCAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.equipeId) return;
    
    try {
      const [equipesData, alunosData] = await Promise.all([
        api.getEquipes(),
        api.getRankingAlunosEquipe(user.equipeId),
      ]);
      
      const userEquipe = equipesData.find((e: EquipeType) => e.id === user.equipeId);
      setEquipe(userEquipe || null);
      setAlunos(alunosData);
    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.equipeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAlunoAnalysis = async (alunoId: string) => {
    try {
      const analysis = await api.getAlunoBNCC(alunoId);
      setBnccAnalysis(analysis);
      setSelectedAluno(alunoId);
    } catch (error) {
      console.error('Error loading analysis:', error);
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

  if (!equipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>Você não pertence a uma equipe</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.teamBadge, { backgroundColor: equipe.cor }]}>
          <Ionicons name="people" size={24} color="#000" />
        </View>
        <View>
          <Text style={styles.title}>Equipe {equipe.nome}</Text>
          <Text style={styles.subtitle}>Painel do Líder</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {/* Team Members */}
        <Text style={styles.sectionTitle}>Membros da Equipe</Text>
        {alunos.map((aluno) => (
          <TouchableOpacity
            key={aluno.id}
            style={[
              styles.alunoCard,
              selectedAluno === aluno.id && { borderColor: equipe.cor, borderWidth: 2 },
            ]}
            onPress={() => loadAlunoAnalysis(aluno.id)}
          >
            <View style={[styles.positionBadge, { backgroundColor: equipe.cor }]}>
              <Text style={styles.positionText}>{aluno.posicao}º</Text>
            </View>
            <View style={styles.alunoInfo}>
              <Text style={styles.alunoName}>{aluno.nome}</Text>
              <View style={styles.alunoMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.metaText}>{aluno.pontosTotais} pts</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="flame" size={14} color="#FF6B35" />
                  <Text style={styles.metaText}>{aluno.streakDias} dias</Text>
                </View>
              </View>
            </View>
            <Ionicons
              name={selectedAluno === aluno.id ? 'chevron-down' : 'chevron-forward'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        ))}

        {/* BNCC Analysis */}
        {selectedAluno && bnccAnalysis && (
          <View style={styles.analysisContainer}>
            <Text style={styles.analysisTitle}>Análise de Habilidades BNCC</Text>
            
            {/* Difficulties */}
            <View style={styles.analysisSection}>
              <View style={styles.analysisSectionHeader}>
                <Ionicons name="alert-circle" size={20} color="#E74C3C" />
                <Text style={styles.analysisSectionTitle}>Dificuldades</Text>
              </View>
              {bnccAnalysis.dificuldades.length > 0 ? (
                bnccAnalysis.dificuldades.slice(0, 5).map((item, index) => (
                  <View key={index} style={styles.analysisItem}>
                    <Text style={styles.analysisHabilidade}>{item.habilidade}</Text>
                    <View style={[styles.analysisCount, { backgroundColor: '#E74C3C30' }]}>
                      <Text style={[styles.analysisCountText, { color: '#E74C3C' }]}>
                        {item.erros} erros
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Nenhum dado disponível</Text>
              )}
            </View>

            {/* Strengths */}
            <View style={styles.analysisSection}>
              <View style={styles.analysisSectionHeader}>
                <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
                <Text style={styles.analysisSectionTitle}>Facilidades</Text>
              </View>
              {bnccAnalysis.facilidades.length > 0 ? (
                bnccAnalysis.facilidades.slice(0, 5).map((item, index) => (
                  <View key={index} style={styles.analysisItem}>
                    <Text style={styles.analysisHabilidade}>{item.habilidade}</Text>
                    <View style={[styles.analysisCount, { backgroundColor: '#32CD3230' }]}>
                      <Text style={[styles.analysisCountText, { color: '#32CD32' }]}>
                        {item.acertos} acertos
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Nenhum dado disponível</Text>
              )}
            </View>
          </View>
        )}

        {alunos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum membro na equipe</Text>
          </View>
        )}
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
    padding: 16,
    gap: 12,
  },
  teamBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  alunoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
  alunoInfo: {
    flex: 1,
  },
  alunoName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  alunoMeta: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#888',
    fontSize: 12,
  },
  analysisContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  analysisSection: {
    marginBottom: 16,
  },
  analysisSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  analysisSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  analysisHabilidade: {
    color: '#fff',
    fontSize: 14,
  },
  analysisCount: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  analysisCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDataText: {
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});
