import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useTema, CoresTema, corParaTema } from '../../src/context/ThemeContext';
import * as api from '../../src/services/api';
import RankingHeader from '../../src/components/RankingHeader';
import StreakBadge from '../../src/components/StreakBadge';
import { RankingItem, Equipe, Turma } from '../../src/types'; 

// --- CONFIGURAÇÃO DO BOTÃO ROTATIVO ---
const JOGOS_ROTATIVOS = [
  { rota: '/sky_equations', icone: 'rocket', titulo: 'Equações Espaciais', cor: '#00FFFF' },
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
  const { cores, estaClaro, alternarTema, corEquipe } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  // No tema claro os cartões coloridos usam um véu bem mais leve — a mesma
  // transparência do escuro deixaria tudo saturado em cima do branco.
  const veu = estaClaro ? '20' : '50';
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
          <ActivityIndicator size="large" color={cores.dourado} />
        </View>
      </SafeAreaView>
    );
  }

  const finalTeamColor = equipe?.cor ? corEquipe(equipe.cor) : cores.textoFraco;
  const corJogo = corParaTema(jogoDestacado.cor, estaClaro, 0.40);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.dourado} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user?.nome?.split(' ')[0]}!</Text>

            {turma && (
              <View style={styles.turmaBadge}>
                <Ionicons name="school" size={14} color={cores.textoFraco} />
                <Text style={styles.turmaText}>{turma.nome}</Text>
              </View>
            )}

            <StreakBadge streakDias={user?.streakDias || 0} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={styles.botaoTema} onPress={alternarTema} accessibilityLabel={estaClaro ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}>
              <Ionicons name={estaClaro ? 'moon' : 'sunny'} size={18} color={cores.ambar} />
              <Text style={styles.botaoTemaTexto}>{estaClaro ? 'Escuro' : 'Claro'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={cores.textoFraco} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Ranking Header (O Pódio) */}
        <RankingHeader ranking={ranking} />

        {/* User Stats Card (Cor 100% dinâmica do banco) */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Seus Pontos</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={28} color={cores.dourado} />
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
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cores.azul + veu, borderColor: cores.azul + '55' }]} onPress={() => router.push('/(tabs)/videos')}>
              <Ionicons name="play" size={24} color={cores.azul} />
              <Text style={styles.actionText}>Vídeo-aulas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cores.sucesso + veu, borderColor: cores.sucesso + '55' }]} onPress={() => router.push('/(tabs)/exercicios')}>
              <Ionicons name="document-text" size={24} color={cores.sucesso} />
              <Text style={styles.actionText}>Atividades</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 2 (Ranking e Jogo Rotativo lado a lado) */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cores.dourado + veu, borderColor: cores.dourado + '55' }]} onPress={() => router.push('/(tabs)/ranking')}>
              <Ionicons name="trophy" size={28} color={cores.dourado} />
              <Text style={[styles.actionText, { fontSize: 13, marginTop: 10 }]}>Ranking Geral</Text>
            </TouchableOpacity>

            {/* BOTÃO ROTATIVO COM SELO "NOVO" */}
            <TouchableOpacity 
                style={[styles.actionCard, { backgroundColor: corJogo + veu, borderColor: corJogo }]} 
                onPress={() => router.push(jogoDestacado.rota as any)}
            >
              {mostrarSeloNovo && (
                <View style={styles.novoBadge}>
                    <Text style={styles.novoBadgeText}>NOVO!</Text>
                </View>
              )}
              <Ionicons name={jogoDestacado.icone as any} size={28} color={corJogo} />
              <Text style={[styles.actionText, { fontSize: 13, marginTop: 10 }]}>{jogoDestacado.titulo}</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 3 */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cores.laranja + veu, borderColor: cores.laranja + '55' }]} onPress={() => router.push('/(tabs)/conteudos')}>
              <Ionicons name="book-outline" size={24} color={cores.laranja} />
              <Text style={styles.actionText}>Conteúdos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, { backgroundColor: cores.roxo + veu, borderColor: cores.roxo + '55' }]} onPress={() => router.push('/(tabs)/progresso')}>
              <Ionicons name="stats-chart" size={24} color={cores.roxo} />
              <Text style={styles.actionText}>Progresso</Text>
            </TouchableOpacity>
          </View>

          {/* Fila 4: Cartela de Missões (cartão largo — é o quadro de estrelas do aluno) */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: cores.ambar + veu, borderColor: cores.ambar, flexDirection: 'row', gap: 10 }]}
              onPress={() => router.push('/cartela_missoes' as any)}
            >
              <Ionicons name="star" size={26} color={cores.ambar} />
              <Text style={[styles.actionText, { marginTop: 0, fontSize: 14 }]}>Cartela de Missões</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: cores.texto, marginBottom: 6 },
  
  turmaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficie, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10, borderWidth: 1, borderColor: cores.borda, gap: 6 },
  turmaText: { color: cores.textoFraco, fontSize: 13, fontWeight: '600' },

  logoutButton: { padding: 8 },
  botaoTema: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: cores.ambar, backgroundColor: cores.ambar + '18', marginRight: 4 },
  botaoTemaTexto: { color: cores.ambar, fontSize: 12, fontWeight: '800' },
  statsCard: { backgroundColor: cores.superficie, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: cores.borda },
  statsTitle: { fontSize: 16, color: cores.textoFraco, marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: cores.texto, marginTop: 8 },
  statLabel: { fontSize: 12, color: cores.textoFraco, marginTop: 4 },
  teamDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: cores.borda },
  
  actionGrid: { gap: 12, paddingBottom: 20 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  actionCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: cores.borda, position: 'relative' },
  actionText: { color: cores.texto, fontSize: 12, fontWeight: '600', marginTop: 10, textAlign: 'center' },

  // Estilos do Selo "Novo"
  novoBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: cores.rosa,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: cores.superficie,
    zIndex: 10,
    shadowColor: cores.rosa,
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
