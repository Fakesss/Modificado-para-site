import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import StreakBadge from '../../src/components/StreakBadge';
import { Equipe } from '../../src/types';

export default function Progresso() {
  const { user, refreshUser } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [progressData, equipesData] = await Promise.all([
        api.getMeuProgresso(),
        api.getEquipes(),
      ]);
      setProgress(progressData);
      
      if (user?.equipeId) {
        const userEquipe = equipesData.find((e: Equipe) => e.id === user.equipeId);
        setEquipe(userEquipe || null);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.equipeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refreshUser()]);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color="#FFD700" />
          </View>
          <Text style={styles.profileName}>{user?.nome}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <StreakBadge streakDias={user?.streakDias || 0} />
        </View>

        {/* Team Info */}
        {equipe && (
          <View style={[styles.teamCard, { borderLeftColor: equipe.cor }]}>
            <View style={[styles.teamBadge, { backgroundColor: equipe.cor }]}>
              <Ionicons name="people" size={20} color="#000" />
            </View>
            <View style={styles.teamInfo}>
              <Text style={styles.teamLabel}>Sua Equipe</Text>
              <Text style={[styles.teamName, { color: equipe.cor }]}>Equipe {equipe.nome}</Text>
            </View>
          </View>
        )}

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="star" size={32} color="#FFD700" />
            <Text style={styles.statValue}>{progress?.pontosTotais || 0}</Text>
            <Text style={styles.statLabel}>Pontos Totais</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="flame" size={32} color="#FF6B35" />
            <Text style={styles.statValue}>{user?.streakDias || 0}</Text>
            <Text style={styles.statLabel}>Dias de Ofensiva</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="play-circle" size={32} color="#4169E1" />
            <Text style={styles.statValue}>{progress?.totalVideos || 0}</Text>
            <Text style={styles.statLabel}>Vídeos Concluídos</Text>
          </View>
          
          <View style={styles.statCard}>
            <Ionicons name="document-text" size={32} color="#32CD32" />
            <Text style={styles.statValue}>{progress?.totalExercicios || 0}</Text>
            <Text style={styles.statLabel}>Exercícios Feitos</Text>
          </View>
        </View>

        {/* Points Breakdown */}
        <Text style={styles.sectionTitle}>Origem dos Pontos</Text>
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Ionicons name="play-circle" size={24} color="#4169E1" />
              <Text style={styles.breakdownLabel}>Vídeo-aulas</Text>
            </View>
            <Text style={styles.breakdownValue}>+{progress?.pontosVideos || 0} pts</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLeft}>
              <Ionicons name="document-text" size={24} color="#32CD32" />
              <Text style={styles.breakdownLabel}>Exercícios</Text>
            </View>
            <Text style={styles.breakdownValue}>+{progress?.pontosExercicios || 0} pts</Text>
          </View>
        </View>

        {/* Recent Activity */}
        {progress?.submissoes?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Últimas Atividades</Text>
            {progress.submissoes.slice(0, 5).map((sub: any, index: number) => (
              <View key={sub.id || index} style={styles.activityItem}>
                <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>Exercício concluído</Text>
                  <Text style={styles.activityMeta}>
                    Nota: {sub.nota} | +{sub.pontosGerados} pts
                  </Text>
                </View>
              </View>
            ))}
          </>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFD700' + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
  },
  teamBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamLabel: {
    fontSize: 12,
    color: '#888',
  },
  teamName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  breakdownCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownLabel: {
    color: '#fff',
    fontSize: 16,
  },
  breakdownValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  activityMeta: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
});
