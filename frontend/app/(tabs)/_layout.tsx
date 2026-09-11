import React, { useEffect, useState, useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { useTema, CoresTema, textoSobre } from '../../src/context/ThemeContext';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';
import OnlineHeartbeat from '../../src/components/OnlineHeartbeat';

import { socket, setActiveMatchData } from '../../src/services/socket';

const TEAM_COLORS: Record<string, string> = {
  'equipe-alfa': '#FFD700',
  'equipe-delta': '#4169E1',
  'equipe-omega': '#32CD32',
};

function AdminBanner() {
  const { user, isAdminViewingAsStudent, setAdminViewingAsStudent } = useAuth();
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const handleBackToAdmin = () => { setAdminViewingAsStudent(false); router.replace('/admin'); };
  if (!(isAdminViewingAsStudent || user?.perfil === 'ADMIN')) return null;
  return (
    <TouchableOpacity style={styles.adminBanner} onPress={handleBackToAdmin}>
      <Ionicons name="arrow-back" size={18} color={cores.dourado} />
      <Text style={styles.adminBannerText}>Voltar ao Painel</Text>
    </TouchableOpacity>
  );
}

function NeonLineSimple({ color }: { color: string }) {
  return <View style={{ height: 2, width: '100%', opacity: 0.6, backgroundColor: color }} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user, isAdminViewingAsStudent } = useAuth();
  const { cores, corEquipe } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const isLeader = user?.perfil === 'ALUNO_LIDER';
  const [teamColor, setTeamColor] = useState<string>('#FFD700');
  // No tema claro a cor da equipe é escurecida — amarelo neon some na barra branca.
  const corAba = corEquipe(teamColor);
  
  const [convite, setConvite] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => { loadTeamColor(); }, [user?.equipeId, isAdminViewingAsStudent]);

  const loadTeamColor = async () => {
    try {
      if (isAdminViewingAsStudent || user?.perfil === 'ADMIN') {
        const savedAdminColor = await AsyncStorage.getItem('adminPreviewColor');
        if (savedAdminColor) { setTeamColor(savedAdminColor); return; }
      }
      if (user?.equipeId) {
        const equipes = await api.getEquipes();
        const userEquipe = equipes.find((e: Equipe) => e.id === user?.equipeId);
        if (userEquipe) setTeamColor(userEquipe.cor);
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!user) return;

    const registrarJogador = () => socket.emit('register_player', { name: user.nome, user_id: user.id });
    if (socket.connected) { registrarJogador(); socket.emit('update_status', { status: 'MENU' }); } 
    else { socket.connect(); }

    const onConnect = () => { registrarJogador(); socket.emit('update_status', { status: 'MENU' }); };
    socket.on('connect', onConnect);

    const identityInterval = setInterval(() => {
        if (socket.connected) { registrarJogador(); socket.emit('update_status', { status: 'MENU' }); }
    }, 10000);

    const onReceiveInvite = (data: any) => setConvite(data);
    const onInviteFeedback = (data: any) => Alert.alert('Central', data.msg);
    const onInviteError = (data: any) => Alert.alert('Aviso', data.msg);
    const onOnlineUsersList = (data: any[]) => setOnlineUsers(data);
    
    const onMatchFound = (data: any) => {
      setActiveMatchData(data);
      setConvite(null);
      
      if (data.game_type === 'arcade') {
          router.push('/arcade_multi');
      } 
      else if (data.game_type === 'math_blaster') {
          // CORREÇÃO DA CONDIÇÃO DE LÍDER (isHost vs is_host do backend Python)
          // (game_type continua 'math_blaster' — é o identificador interno do convite/protocolo, não o nome exibido)
          const isHostVal = data.is_host === true || data.isHost === true;
          const encodedColor = encodeURIComponent(data.opponent_color || '#FF00FF');
          router.push(`/sky_equations_multi?roomId=${data.room_id}&isHost=${isHostVal}&opponentName=${data.opponent_name}&opponentColor=${encodedColor}`);
      }
      else if (data.game_type === 'tugofwar') {
          router.push('/cabo_de_guerra');
      }
      else {
          router.push('/tictactoe'); 
      }
    };

    socket.on('receive_invite', onReceiveInvite);
    socket.on('invite_feedback', onInviteFeedback);
    socket.on('invite_error', onInviteError);
    socket.on('online_users_list', onOnlineUsersList);
    socket.on('match_found', onMatchFound);

    return () => {
      clearInterval(identityInterval);
      socket.off('connect', onConnect);
      socket.off('receive_invite', onReceiveInvite);
      socket.off('invite_feedback', onInviteFeedback);
      socket.off('invite_error', onInviteError);
      socket.off('online_users_list', onOnlineUsersList);
      socket.off('match_found', onMatchFound);
    };
  }, [user]);

  const aceitarConvite = () => {
    socket.emit('accept_invite', { from_sid: convite.from_sid, game_type: convite.game_type, modo_operacao: convite.modo_operacao });
    setConvite(null);
  };
  const recusarConvite = () => { socket.emit('decline_invite', { from_sid: convite.from_sid }); setConvite(null); };
  const bloquearJogador = () => {
    const target = onlineUsers.find(u => u.sid === convite.from_sid);
    if (target) {
      socket.emit('block_player_invites', { user_id_to_block: target.user_id });
      Alert.alert("Bloqueado", "Este jogador não poderá te convidar por 5 minutos.");
    }
    setConvite(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnlineHeartbeat />
      <AdminBanner />
      <NeonLineSimple color={corAba} />

      <Modal visible={!!convite} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="game-controller" size={32} color={cores.sobreAcento} />
            </View>
            <Text style={styles.modalTitle}>DESAFIO RECEBIDO!</Text>
            <Text style={styles.modalText}>
              <Text style={{fontWeight: 'bold', color: cores.dourado}}>{convite?.from_name}</Text> te chamou para jogar {convite?.game_type === 'tictactoe' ? 'Jogo da Velha' : convite?.game_type === 'arcade' ? 'Matemática Turbo' : convite?.game_type === 'math_blaster' ? 'Equações Espaciais Co-op' : 'Cabo de Guerra'}!
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.btnAction, { backgroundColor: cores.sucesso }]} onPress={aceitarConvite}>
                <Ionicons name="checkmark-circle" size={20} color={textoSobre(cores.sucesso)} />
                <Text style={[styles.btnText, { color: textoSobre(cores.sucesso) }]}>ACEITAR E JOGAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, { backgroundColor: cores.erro }]} onPress={recusarConvite}>
                <Ionicons name="close-circle" size={20} color="#FFF" />
                <Text style={styles.btnText}>RECUSAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, styles.btnBloquear]} onPress={bloquearJogador}>
                <Ionicons name="shield" size={20} color={cores.textoFraco} />
                <Text style={[styles.btnText, { color: cores.textoFraco }]}>BLOQUEAR POR 5 MINUTOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: cores.barra,
            borderTopColor: corAba + '40',
            borderTopWidth: 2,
            paddingBottom: Platform.OS === 'ios' ? 20 : Math.max(12, insets.bottom + 5),
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 85 : 60 + insets.bottom,
          },
          tabBarActiveTintColor: corAba,
          tabBarInactiveTintColor: cores.textoFraco,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: Platform.OS === 'android' ? 4 : 0 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => (<Ionicons name="home" size={size} color={color} />) }} />
        <Tabs.Screen name="jogadores" options={{ title: 'Online', tabBarIcon: ({ color, size }) => (<Ionicons name="radio" size={size} color={color} /> ) }} />
        <Tabs.Screen name="salas" options={{ title: 'Salas', tabBarIcon: ({ color, size }) => (<Ionicons name="chatbubbles" size={size} color={color} /> ) }} />
        

        <Tabs.Screen name="jogo" options={{ title: 'Jogos', tabBarIcon: ({ color, size }) => (<Ionicons name="game-controller" size={size} color={color} />), tabBarBadge: '🧪', tabBarBadgeStyle: { backgroundColor: 'transparent', fontSize: 10 } }} />
        <Tabs.Screen name="equipe" options={{ title: 'Equipe', href: isLeader ? undefined : null, tabBarIcon: ({ color, size }) => (<Ionicons name="people" size={size} color={color} />) }} />
        <Tabs.Screen name="progresso" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => (<Ionicons name="person" size={size} color={color} />) }} />
        
        <Tabs.Screen name="chat" options={{ href: null }} />
        <Tabs.Screen name="ranking" options={{ href: null }} />
        <Tabs.Screen name="conteudos" options={{ href: null }} />
        <Tabs.Screen name="exercicios" options={{ href: null }} />
        <Tabs.Screen name="videos" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  adminBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficie, paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: cores.dourado + '40' },
  adminBannerText: { color: cores.dourado, fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: cores.superficie, width: '100%', borderRadius: 24, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: cores.dourado + '50' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: cores.dourado, justifyContent: 'center', alignItems: 'center', marginBottom: 15, marginTop: -50, borderWidth: 4, borderColor: cores.superficie },
  modalTitle: { color: cores.texto, fontSize: 22, fontWeight: '900', marginBottom: 5 },
  modalText: { color: cores.textoFraco, fontSize: 16, textAlign: 'center', marginBottom: 10 },
  btnAction: { flexDirection: 'row', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnBloquear: { backgroundColor: cores.superficieAlt, borderWidth: 1, borderColor: cores.borda },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
