import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Modal, Alert, AppState, Animated, PanResponder, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';
import OnlineHeartbeat from '../../src/components/OnlineHeartbeat';
import { WebView } from 'react-native-webview';
import { DeviceEventEmitter } from 'react-native';

import { socket, setActiveMatchData } from '../../src/services/socket';

const TEAM_COLORS: Record<string, string> = {
  'equipe-alfa': '#FFD700',
  'equipe-delta': '#4169E1',
  'equipe-omega': '#32CD32',
};

const { width, height } = Dimensions.get('window');

// Truque para Iframe na Web e WebView no Celular
const WebIframe = Platform.OS === 'web' ? (props: any) => React.createElement('iframe', props) : View;

function AdminBanner() {
  const { user, isAdminViewingAsStudent, setAdminViewingAsStudent } = useAuth();
  const router = useRouter();
  const handleBackToAdmin = () => { setAdminViewingAsStudent(false); router.replace('/admin'); };
  if (!(isAdminViewingAsStudent || user?.perfil === 'ADMIN')) return null;
  return (
    <TouchableOpacity style={styles.adminBanner} onPress={handleBackToAdmin}>
      <Ionicons name="arrow-back" size={18} color="#FFD700" />
      <Text style={styles.adminBannerText}>Voltar ao Painel</Text>
    </TouchableOpacity>
  );
}

function NeonLineSimple({ color }: { color: string }) {
  return <View style={[styles.neonLine, { backgroundColor: color }]} />;
}

export default function TabsLayout() {
  const { user, isAdminViewingAsStudent } = useAuth();
  const router = useRouter();
  const isLeader = user?.perfil === 'ALUNO_LIDER';
  const [teamColor, setTeamColor] = useState<string>('#FFD700');

  const [convite, setConvite] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  // 🚨 Estados da Chamada de Voz
  const [jitsiRoom, setJitsiRoom] = useState<string | null>(null);
  const [isCallMinimized, setIsCallMinimized] = useState<boolean>(false); // Controle de encolher a tela
  
  const pan = useRef(new Animated.ValueXY()).current;
  
  // Controle de arrastar mais suave e livre de bugs
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        pan.extractOffset();
      },
    })
  ).current;

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
      if (data.game_type === 'arcade') router.push('/arcade_multi');
      else router.push('/tictactoe'); 
    };

    socket.on('receive_invite', onReceiveInvite);
    socket.on('invite_feedback', onInviteFeedback);
    socket.on('invite_error', onInviteError);
    socket.on('online_users_list', onOnlineUsersList);
    socket.on('match_found', onMatchFound);

    const openVoiceListener = DeviceEventEmitter.addListener('open_voice_call', (data) => {
      setJitsiRoom(`MatematicaTurbo_Sala_${data.roomId}`);
      setIsCallMinimized(false); // Sempre abre grande primeiro
      pan.setOffset({ x: 0, y: 0 });
      pan.setValue({ x: 0, y: 0 }); 
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        setJitsiRoom(null);
      }
    });

    return () => {
      clearInterval(identityInterval);
      socket.off('connect', onConnect);
      socket.off('receive_invite', onReceiveInvite);
      socket.off('invite_feedback', onInviteFeedback);
      socket.off('invite_error', onInviteError);
      socket.off('online_users_list', onOnlineUsersList);
      socket.off('match_found', onMatchFound);
      openVoiceListener.remove();
      appStateSubscription.remove();
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

  // 🚨 URL BLINDADA: Tira o vídeo, bloqueia a tela de baixar app e já joga o nome do aluno!
  const userNameEncoded = user?.nome ? encodeURIComponent(user.nome) : 'Aluno';
  const jitsiUrl = `https://meet.jit.si/${jitsiRoom}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.startAudioOnly=true&config.disableVideo=true&userInfo.displayName=${userNameEncoded}`;

  // Cálculo Dinâmico do Tamanho da Tela da Chamada
  const BOX_WIDTH = isCallMinimized ? 200 : (width > 500 ? 400 : width * 0.9);
  const BOX_HEIGHT = isCallMinimized ? 45 : 450;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OnlineHeartbeat />
      <AdminBanner />
      <NeonLineSimple color={teamColor} />

      {/* 🚨 WIDGET FLUTUANTE EXPANSÍVEL */}
      {jitsiRoom && (
        <Animated.View style={[
          styles.floatingCallBox, 
          { width: BOX_WIDTH, height: BOX_HEIGHT, transform: pan.getTranslateTransform() }
        ]}>
          
          {/* BARRA SUPERIOR (Arrastar e Botões) */}
          <View style={styles.dragHandle} {...panResponder.panHandlers}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="radio" size={18} color="#000" />
              <Text style={styles.dragHandleText}>Call {isCallMinimized ? 'Ativa' : 'da Sala'}</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* BOTÃO DE MINIMIZAR / EXPANDIR */}
              <TouchableOpacity onPress={() => setIsCallMinimized(!isCallMinimized)} style={styles.minimizeBtn}>
                <Ionicons name={isCallMinimized ? "expand" : "contract"} size={20} color="#000" />
              </TouchableOpacity>
              
              {/* BOTÃO DE DESLIGAR */}
              <TouchableOpacity style={styles.hangupButton} onPress={() => setJitsiRoom(null)}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* ÁREA DO NAVEGADOR (JITSI) */}
          <View style={isCallMinimized ? styles.webViewHidden : styles.webViewVisible}>
            {Platform.OS === 'web' ? (
              <WebIframe 
                src={jitsiUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allow="camera; microphone; display-capture; autoplay"
              />
            ) : (
              <WebView 
                source={{ uri: jitsiUrl }}
                style={{ flex: 1, backgroundColor: '#1a1a2e' }}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            )}
          </View>

        </Animated.View>
      )}

      <Modal visible={!!convite} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="game-controller" size={32} color="#FFF" />
            </View>
            <Text style={styles.modalTitle}>DESAFIO RECEBIDO!</Text>
            <Text style={styles.modalText}>
              <Text style={{fontWeight: 'bold', color: '#FFD700'}}>{convite?.from_name}</Text> te chamou para jogar {convite?.game_type === 'tictactoe' ? 'Jogo da Velha' : 'Matemática Turbo'}!
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#32CD32' }]} onPress={aceitarConvite}>
                <Ionicons name="checkmark-circle" size={20} color="#000" />
                <Text style={[styles.btnText, { color: '#000' }]}>ACEITAR E JOGAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#E74C3C' }]} onPress={recusarConvite}>
                <Ionicons name="close-circle" size={20} color="#FFF" />
                <Text style={styles.btnText}>RECUSAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnAction, { backgroundColor: '#333' }]} onPress={bloquearJogador}>
                <Ionicons name="shield" size={20} color="#888" />
                <Text style={[styles.btnText, { color: '#888' }]}>BLOQUEAR POR 5 MINUTOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: teamColor + '40',
            borderTopWidth: 2,
            paddingBottom: Platform.OS === 'ios' ? 20 : 12,
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 85 : 70,
          },
          tabBarActiveTintColor: teamColor,
          tabBarInactiveTintColor: '#666',
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: Platform.OS === 'android' ? 4 : 0 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => (<Ionicons name="home" size={size} color={color} />) }} />
        <Tabs.Screen name="jogadores" options={{ title: 'Online', tabBarIcon: ({ color, size }) => (<Ionicons name="radio" size={size} color={color} /> ) }} />
        <Tabs.Screen name="salas" options={{ title: 'Salas', tabBarIcon: ({ color, size }) => (<Ionicons name="chatbubbles" size={size} color={color} /> ) }} />
        <Tabs.Screen name="jogo" options={{ title: 'Jogos', tabBarIcon: ({ color, size }) => (<Ionicons name="game-controller" size={size} color={color} />), tabBarBadge: '🧪', tabBarBadgeStyle: { backgroundColor: 'transparent', fontSize: 10 } }} />
        <Tabs.Screen name="equipe" options={{ title: 'Equipe', href: isLeader ? undefined : null, tabBarIcon: ({ color, size }) => (<Ionicons name="people" size={size} color={color} />) }} />
        
        <Tabs.Screen name="ranking" options={{ href: null }} />
        <Tabs.Screen name="conteudos" options={{ href: null }} />
        <Tabs.Screen name="exercicios" options={{ href: null }} />
        <Tabs.Screen name="videos" options={{ href: null }} />
        <Tabs.Screen name="progresso" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  adminBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e', paddingVertical: 12, paddingHorizontal: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#FFD70040' },
  adminBannerText: { color: '#FFD700', fontSize: 14, fontWeight: '600' },
  neonLine: { height: 2, width: '100%', opacity: 0.6 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1a1a2e', width: '100%', borderRadius: 24, padding: 25, alignItems: 'center', borderWidth: 1, borderColor: '#FFD70050' },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', marginBottom: 15, marginTop: -50, borderWidth: 4, borderColor: '#1a1a2e' },
  modalTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 5 },
  modalText: { color: '#AAA', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  btnAction: { flexDirection: 'row', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // 🚨 Estilos do Widget Expansível
  floatingCallBox: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#1a1a2e', 
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 99999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: '#32CD32',
  },
  dragHandle: {
    backgroundColor: '#32CD32',
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dragHandleText: { color: '#000', fontWeight: 'bold', marginLeft: 8 },
  minimizeBtn: { padding: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 6 },
  hangupButton: { padding: 4 },
  
  // Classes para esconder/mostrar o Jitsi sem desligar a chamada
  webViewVisible: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1a1a2e'
  },
  webViewHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
    overflow: 'hidden',
    top: -1000,
  }
});
