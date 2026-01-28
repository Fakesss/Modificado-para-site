import React, { useEffect, useState, useCallback } from 'react';
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
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import RankingHeader from '../../src/components/RankingHeader';
import StreakBadge from '../../src/components/StreakBadge';
import { RankingItem, Equipe } from '../../src/types';

export default function Home() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rankingData, equipesData] = await Promise.all([
        api.getRankingGeral(),
        api.getEquipes(),
      ]);
      setRanking(rankingData);
      
      if (user?.equipeId) {
        const userEquipe = equipesData.find((e: Equipe) => e.id === user.equipeId);
        setEquipe(userEquipe || null);
      }
    } catch (error) {
      console.error('Error loading home data:', error);
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

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.nome?.split(' ')[0]}!</Text>
            <StreakBadge streakDias={user?.streakDias || 0} />
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Ranking Header */}
        <RankingHeader ranking={ranking} />

        {/* User Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Seus Pontos</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={28} color="#FFD700" />
              <Text style={styles.statValue}>{user?.pontosTotais || 0}</Text>
              <Text style={styles.statLabel}>pontos totais</Text>
            </View>
            {equipe && (
              <View style={styles.statItem}>
                <View style={[styles.teamDot, { backgroundColor: equipe.cor }]} />
                <Text style={[styles.statValue, { color: equipe.cor }]}>{equipe.nome}</Text>
                <Text style={styles.statLabel}>sua equipe</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Acesso Rápido</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#4169E1' + '30' }]}
            onPress={() => router.push('/(tabs)/videos')}
          >
            <Ionicons name="play-circle" size={32} color="#4169E1" />
            <Text style={styles.actionText}>Vídeo-aulas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#32CD32' + '30' }]}
            onPress={() => router.push('/(tabs)/exercicios')}
          >
            <Ionicons name="document-text" size={32} color="#32CD32" />
            <Text style={styles.actionText}>Atividades</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#FFD700' + '30' }]}
            onPress={() => router.push('/(tabs)/ranking')}
          >
            <Ionicons name="trophy" size={32} color="#FFD700" />
            <Text style={styles.actionText}>Ranking</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: '#9B59B6' + '30' }]}
            onPress={() => router.push('/(tabs)/progresso')}
          >
            <Ionicons name="stats-chart" size={32} color="#9B59B6" />
            <Text style={styles.actionText}>Progresso</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  logoutButton: {
    padding: 8,
  },
  statsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
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
    color: '#666',
    marginTop: 4,
  },
  teamDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '47%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
});
