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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // Estilo: Importação do Gradiente Adicionada
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
      <LinearGradient colors={['#1a103d', '#0d0821']} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f6d365" />
      </LinearGradient>
    );
  }

  const finalTeamColor = equipe?.cor || '#6b46c1'; // Cor secundária suave se não houver equipe

  return (
    <LinearGradient colors={['#1a103d', '#0d0821']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f6d365" />
          }
        >
          {/* Header Superior */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Olá, {user?.nome?.split(' ')[0]}!</Text>
              
              {/* Etiqueta da Turma com novo Visual */}
              {turma && (
                <View style={styles.turmaBadge}>
                  <Ionicons name="school" size={14} color="#f6d365" />
                  <Text style={styles.turmaText}>{turma.nome}</Text>
                </View>
              )}

              <StreakBadge streakDias={user?.streakDias || 0} />
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={26} color="#a0aec0" />
            </TouchableOpacity>
          </View>

          {/* Ranking Header (O Pódio) */}
          <RankingHeader ranking={ranking} />

          {/* User Stats Card com Gradiente Escuro */}
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>Seu Desempenho</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <View style={styles.iconBackgroundStar}>
                    <Ionicons name="star" size={26} color="#f6d365" />
                </View>
                <Text style={styles.statValue}>{user?.pontosTotais || 0}</Text>
                <Text style={styles.statLabel}>XP Total</Text>
              </View>
              {equipe && (
                <View style={styles.statItem}>
                  <View style={[styles.iconBackgroundTeam, { backgroundColor: finalTeamColor + '40' }]}>
                      <View style={[styles.teamDot, { backgroundColor: finalTeamColor }]} />
                  </View>
                  <Text style={[styles.statValue, { color: finalTeamColor }]}>{equipe.nome}</Text>
                  <Text style={styles.statLabel}>Sua Equipe</Text>
                </View>
              )}
            </View>
          </View>

          {/* ==================================================== */}
          {/* BOTÕES ESTILO NEON/GLASSMORPHISM */}
          {/* ==================================================== */}
          <View style={styles.actionGrid}>
            
            {/* Fila 1 */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                 style={styles.actionCardWrapper} 
                 onPress={() => router.push('/(tabs)/videos')}
                 activeOpacity={0.8}
              >
                  <LinearGradient colors={['rgba(65, 105, 225, 0.15)', 'rgba(65, 105, 225, 0.05)']} style={styles.actionCard}>
                    <View style={[styles.iconContainer, { backgroundColor: '#4169E1' }]}>
                        <Ionicons name="play" size={22} color="#fff" />
                    </View>
                    <Text style={styles.actionText}>Vídeos</Text>
                  </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                 style={styles.actionCardWrapper} 
                 onPress={() => router.push('/(tabs)/exercicios')}
                 activeOpacity={0.8}
              >
                  <LinearGradient colors={['rgba(50, 205, 50, 0.15)', 'rgba(50, 205, 50, 0.05)']} style={styles.actionCard}>
                    <View style={[styles.iconContainer, { backgroundColor: '#32CD32' }]}>
                        <Ionicons name="document-text" size={22} color="#fff" />
                    </View>
                    <Text style={styles.actionText}>Atividades</Text>
                  </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Fila 2 (Ranking no meio com destaque Dourado) */}
            <View style={styles.actionRowCenter}>
              <TouchableOpacity 
                 style={[styles.actionCardWrapper, { width: '80%' }]} 
                 onPress={() => router.push('/(tabs)/ranking')}
                 activeOpacity={0.8}
              >
                 <LinearGradient 
                    colors={['rgba(246, 211, 101, 0.2)', 'rgba(253, 160, 133, 0.1)']} 
                    style={[styles.actionCard, { paddingVertical: 20, borderColor: 'rgba(246, 211, 101, 0.3)' }]}
                 >
                    <View style={[styles.iconContainer, { backgroundColor: '#f6d365', width: 50, height: 50, borderRadius: 25 }]}>
                        <Ionicons name="trophy" size={26} color="#1a103d" />
                    </View>
                    <Text style={[styles.actionText, { fontSize: 16, color: '#f6d365' }]}>Ranking Geral</Text>
                  </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Fila 3 */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                 style={styles.actionCardWrapper} 
                 onPress={() => router.push('/(tabs)/conteudos')}
                 activeOpacity={0.8}
              >
                  <LinearGradient colors={['rgba(255, 140, 0, 0.15)', 'rgba(255, 140, 0, 0.05)']} style={styles.actionCard}>
                    <View style={[styles.iconContainer, { backgroundColor: '#FF8C00' }]}>
                        <Ionicons name="book-outline" size={22} color="#fff" />
                    </View>
                    <Text style={styles.actionText}>Conteúdos</Text>
                  </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                 style={styles.actionCardWrapper} 
                 onPress={() => router.push('/(tabs)/progresso')}
                 activeOpacity={0.8}
              >
                  <LinearGradient colors={['rgba(107, 70, 193, 0.2)', 'rgba(107, 70, 193, 0.05)']} style={styles.actionCard}>
                    <View style={[styles.iconContainer, { backgroundColor: '#6b46c1' }]}>
                        <Ionicons name="stats-chart" size={22} color="#fff" />
                    </View>
                    <Text style={styles.actionText}>Progresso</Text>
                  </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Espaçamento extra no fim para a tab bar flutuante não sobrepor o último botão */}
            <View style={{ height: 80 }} />

          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 25,
    marginTop: 10
  },
  greeting: { 
    fontSize: 26, 
    fontWeight: '900', 
    color: '#fff', 
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  
  turmaBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(246, 211, 101, 0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    alignSelf: 'flex-start', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: 'rgba(246, 211, 101, 0.3)', 
    gap: 8 
  },
  turmaText: { color: '#f6d365', fontSize: 13, fontWeight: '700' },

  logoutButton: { 
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 50,
  },
  
  statsCard: { 
    backgroundColor: 'rgba(255, 255, 255, 0.03)', 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 30, 
    borderWidth: 1, 
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  statsTitle: { fontSize: 14, color: '#a0aec0', marginBottom: 20, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  iconBackgroundStar: {
      backgroundColor: 'rgba(246, 211, 101, 0.15)',
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8
  },
  iconBackgroundTeam: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8
  },
  statValue: { fontSize: 24, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 13, color: '#a0aec0', marginTop: 4, fontWeight: '500' },
  teamDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#1a103d' },
  
  actionGrid: { gap: 15 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  actionRowCenter: { flexDirection: 'row', justifyContent: 'center', marginVertical: 5 },
  
  actionCardWrapper: {
      flex: 1,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
  },
  actionCard: { 
      flex: 1, 
      borderRadius: 20, 
      padding: 20, 
      alignItems: 'center', 
      justifyContent: 'center', 
      borderWidth: 1, 
      borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 4,
  },
  actionText: { color: '#e2e8f0', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
});
