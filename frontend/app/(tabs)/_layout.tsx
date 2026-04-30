import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import RankingHeader from '../../src/components/RankingHeader';
import StreakBadge from '../../src/components/StreakBadge';
import { RankingItem, Equipe, Turma } from '../../src/types';

export default function Home() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [turma, setTurma] = useState<Turma | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pergunta antes de sair do app
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          'Sair do aplicativo',
          'Você tem certeza que deseja sair?',
          [
            { text: 'Ficar', style: 'cancel', onPress: () => null },
            { text: 'Sair', style: 'destructive', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const loadData = useCallback(async () => {
    try {
      const [rankingData, equipesData, turmasData] = await Promise.all([
        api.getRankingGeral(),
        api.getEquipes(),
        api.getTurmas(),
      ]);
      setRanking(rankingData);
      
      if (user?.equipeId) {
        const userEquipe = equipesData.find((e: Equipe) => String(e.id) === String(user.equipeId));
        setEquipe(userEquipe || null);
      }
      
      if (user?.turmaId) {
        const userTurma = turmasData.find((t: Turma) => String(t.id) === String(user.turmaId));
        setTurma(userTurma || null);
      }
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.equipeId, user?.turmaId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      refreshUser(); 
    }, [loadData])
  );

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

  const finalTeamColor = equipe?.cor || '#333333';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {/* Header Original */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.nome?.split(' ')[0]}!</Text>
            
            {turma && (
              <View style={styles.turmaBadge}>
                <Ionicons name="school" size={14} color="#888" />
                <Text style={styles.turmaText}>{turma.nome}</Text>
              </View>
            )}

            <StreakBadge streakDias={user?.streakDias || 0} />
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Ranking Header (O Pódio) Original */}
        <RankingHeader ranking={ranking} />

        {/* User Stats Card Original */}
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
                <View style={[styles.teamDot, { backgroundColor: finalTeamColor }]} />
                <Text style={[styles.statValue, { color: finalTeamColor }]}>{equipe.nome}</Text>
                <Text style={styles.statLabel}>sua equipe</Text>
              </View>
            )}
          </View>
        </View>

        {/* ==================================================== */}
        {/* NOVA CENTRAL DE COMANDO: VISUAL MODERNO HARMONIZADO  */}
        {/* ==================================================== */}
        <View style={styles.actionGrid}>
          
          {/* Fila 1: Vídeos e Atividades */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionCard, { borderColor: 'rgba(65, 105, 225, 0.3)' }]} 
              onPress={() => router.push('/(tabs)/videos')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconGlow, { backgroundColor: 'rgba(65, 105, 225, 0.15)' }]}>
                <Ionicons name="play" size={28} color="#4169E1" />
              </View>
              <Text style={styles.actionText}>Vídeo-aulas</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionCard, { borderColor: 'rgba(50, 205, 50, 0.3)' }]} 
              onPress={() => router.push('/(tabs)/exercicios')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconGlow, { backgroundColor: 'rgba(50, 205, 50, 0.15)' }]}>
                <Ionicons name="document-text" size={28} color="#32CD32" />
              </View>
              <Text style={styles.actionText}>Atividades</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 2: Conteúdos e Progresso */}
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionCard, { borderColor: 'rgba(255, 140, 0, 0.3)' }]} 
              onPress={() => router.push('/(tabs)/conteudos')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconGlow, { backgroundColor: 'rgba(255, 140, 0, 0.15)' }]}>
                <Ionicons name="book-outline" size={28} color="#FF8C00" />
              </View>
              <Text style={styles.actionText}>Conteúdos</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionCard, { borderColor: 'rgba(224, 102, 255, 0.3)' }]} 
              onPress={() => router.push('/(tabs)/progresso')}
              activeOpacity={0.8}
            >
              <View style={[styles.iconGlow, { backgroundColor: 'rgba(224, 102, 255, 0.15)' }]}>
                <Ionicons name="stats-chart" size={28} color="#E066FF" />
              </View>
              <Text style={styles.actionText}>Progresso</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 3: Ranking Geral (Esticado para dar destaque) */}
          <TouchableOpacity 
            style={[styles.actionCard, styles.actionCardWide, { borderColor: 'rgba(255, 215, 0, 0.3)' }]} 
            onPress={() => router.push('/(tabs)/ranking')}
            activeOpacity={0.8}
          >
            <View style={[styles.iconGlow, { backgroundColor: 'rgba(255, 215, 0, 0.15)', marginBottom: 0, marginRight: 15 }]}>
              <Ionicons name="trophy" size={28} color="#FFD700" />
            </View>
            <Text style={[styles.actionText, { fontSize: 16 }]}>Ranking Geral</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Mantive as cores exatas do seu app original
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  
  turmaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10, borderWidth: 1, borderColor: '#333', gap: 6 },
  turmaText: { color: '#888', fontSize: 13, fontWeight: '600' },

  logoutButton: { padding: 8 },
  statsCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#333' },
  statsTitle: { fontSize: 16, color: '#888', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  teamDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#333' },
  
  /* NOVOS ESTILOS DOS BOTÕES (Harmonizados) */
  actionGrid: { gap: 16, paddingBottom: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  actionCard: { 
    flex: 1, 
    backgroundColor: '#1a1a2e', // Mesma cor do seu card de status original
    borderRadius: 20, 
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 1,
  },
  actionCardWide: {
    flexDirection: 'row',
    paddingVertical: 18,
  },
  iconGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '600' 
  },
});
