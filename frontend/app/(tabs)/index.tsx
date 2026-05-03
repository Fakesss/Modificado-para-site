import React, { useState, useCallback, useEffect } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import RankingHeader from '../../src/components/RankingHeader';
import StreakBadge from '../../src/components/StreakBadge';
import { RankingItem, Equipe, Turma } from '../../src/types'; 

// --- CONFIGURAÇÃO DO BOTÃO ROTATIVO ---
const JOGOS_ROTATIVOS = [
  { rota: '/math_blaster', icone: 'rocket', titulo: 'Math Blaster', cor: '#00FFFF' },
  { rota: '/tictactoe', icone: 'grid', titulo: 'Jogo da Velha', cor: '#32CD32' },
  { rota: '/cabo_de_guerra_offline', icone: 'people', titulo: 'Cabo de Guerra', cor: '#FF4500' }
];

const obterJogoDoDia = () => {
  // Pega o dia atual do ano (1 a 365) para fazer um rodízio previsível e diário
  const hoje = new Date();
  const diaDoAno = Math.floor((hoje.getTime() - new Date(hoje.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = diaDoAno % JOGOS_ROTATIVOS.length;
  return JOGOS_ROTATIVOS[index];
};

export default function Home() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [turma, setTurma] = useState<Turma | null>(null); 
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mostrarSeloNovo, setMostrarSeloNovo] = useState(false);

  const jogoDestacado = obterJogoDoDia();

  // Controle do Selo "Novo"
  useEffect(() => {
    const verificarSelo = async () => {
      try {
        const dataVistoStr = await AsyncStorage.getItem('data_visto_rotativo');
        const agora = Date.now();
        
        if (!dataVistoStr) {
          // Se for a primeira vez, marca agora e mostra o selo
          await AsyncStorage.setItem('data_visto_rotativo', agora.toString());
          setMostrarSeloNovo(true);
        } else {
          // Se já viu, verifica se passaram 24h (86400000 ms)
          const dataVisto = parseInt(dataVistoStr);
          if (agora - dataVisto < 86400000) {
            setMostrarSeloNovo(true);
          } else {
            setMostrarSeloNovo(false);
          }
        }
      } catch (e) {
        console.error("Erro no selo novo:", e);
      }
    };
    verificarSelo();
  }, []);

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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {/* Header */}
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

        {/* Ranking Header (O Pódio) */}
        <RankingHeader ranking={ranking} />

        {/* User Stats Card (Cor 100% dinâmica do banco) */}
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
        {/* NOVA CENTRAL DE COMANDO: BOTÕES VIBRANTES */}
        {/* ==================================================== */}
        <View style={styles.actionGrid}>
          
          {/* Fila 1 */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#4169E1' + '50' }]} onPress={() => router.push('/(tabs)/videos')}>
              <Ionicons name="play" size={24} color="#4169E1" />
              <Text style={styles.actionText}>Vídeo-aulas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#32CD32' + '50' }]} onPress={() => router.push('/(tabs)/exercicios')}>
              <Ionicons name="document-text" size={24} color="#32CD32" />
              <Text style={styles.actionText}>Atividades</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 2 (Ranking e Jogo Rotativo lado a lado) */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#FFD700' + '50' }]} onPress={() => router.push('/(tabs)/ranking')}>
              <Ionicons name="trophy" size={28} color="#FFD700" />
              <Text style={[styles.actionText, { fontSize: 13, marginTop: 10 }]}>Ranking Geral</Text>
            </TouchableOpacity>

            {/* BOTÃO ROTATIVO COM SELO "NOVO" */}
            <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: jogoDestacado.cor + '40', borderColor: jogoDestacado.cor }]} 
                onPress={() => router.push(jogoDestacado.rota as any)}
            >
              {mostrarSeloNovo && (
                <View style={styles.novoBadge}>
                    <Text style={styles.novoBadgeText}>NOVO!</Text>
                </View>
              )}
              <Ionicons name={jogoDestacado.icone as any} size={28} color={jogoDestacado.cor} />
              <Text style={[styles.actionText, { fontSize: 13, marginTop: 10, color: '#FFF' }]}>{jogoDestacado.titulo}</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 3 */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#FF8C00' + '50' }]} onPress={() => router.push('/(tabs)/conteudos')}>
              <Ionicons name="book-outline" size={24} color="#FF8C00" />
              <Text style={styles.actionText}>Conteúdos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#E066FF' + '50' }]} onPress={() => router.push('/(tabs)/progresso')}>
              <Ionicons name="stats-chart" size={24} color="#E066FF" />
              <Text style={styles.actionText}>Progresso</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  
  actionGrid: { gap: 12, paddingBottom: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1a1a2e', position: 'relative' },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 10, textAlign: 'center' },

  // Estilos do Selo "Novo"
  novoBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF0055',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFF',
    zIndex: 10,
    shadowColor: '#FF0055',
    shadowRadius: 5,
    shadowOpacity: 0.8
  },
  novoBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    fontStyle: 'italic'
  }
});
