import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
  AppState,
  AppStateStatus,
  TextInput,
  ScrollView,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.45;
const MAX_OPERACOES = 5;
const VELOCIDADE_BASE = 15000;
const SPAWN_INTERVAL = 2500;
const QUESTAO_ESPECIAL_CHANCE = 0.12;
const QUESTAO_CONGELAMENTO_CHANCE = 0.05;
const CARD_WIDTH = 105;
const NUM_LANES = 3; // 3 Pistas para não sobrepor
const LANE_WIDTH = width / NUM_LANES;
const POLLING_INTERVAL = 1000;

type ModoMatematica = 'soma' | 'subtracao' | 'multiplicacao' | 'divisao' | 'potenciacao' | 'radiciacao' | 'misto';

const gerarChaveQuestao = (num1: number, operador: string, num2: number | string) => 
  `${num1}${operador}${num2}`;

interface Operacao {
  id: string;
  num1: number;
  num2: number | string;
  operador: '+' | '-' | '×' | '÷' | '^' | '√';
  textoTela: string;
  resposta: number;
  y: Animated.Value;
  speed: number;
  posX: number;
  lane: number;
  especial: boolean;
  congelamento: boolean;
  opacity: Animated.Value;
  scale: Animated.Value;
  chave: string;
}

interface MultiplayerPlayer {
  id: string;
  nome: string;
  pontos: number;
  vidas: number;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  isBot?: boolean;
}

interface GameRoom {
  id: string;
  hostId: string;
  hostNome: string;
  players: MultiplayerPlayer[];
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  maxPlayers: number;
  winner?: MultiplayerPlayer;
}

interface VoiceMessage {
  id: string;
  senderId: string;
  senderNome: string;
  audioBase64: string;
  timestamp: string;
}

export default function Jogo() {
  const { user } = useAuth();
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado' | 'lobby' | 'salas'>('menu');
  const [modo, setModo] = useState<'single' | 'multi' | 'bot'>('single');
  const [modoMatematica, setModoMatematica] = useState<ModoMatematica>('misto');
  
  // Game state
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [vidas, setVidas] = useState(10);
  const [pontos, setPontos] = useState(0);
  const [rodada, setRodada] = useState(1);
  const [acertosRodada, setAcertosRodada] = useState(0);
  const [metaRodada, setMetaRodada] = useState(10);
  const [resposta, setResposta] = useState('');
  const [dificuldade, setDificuldade] = useState(1);
  const [velocidade, setVelocidade] = useState(1);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [errosConsecutivos, setErrosConsecutivos] = useState(0);
  const [pausado, setPausado] = useState(false);
  
  // Power-ups
  const [congelado, setCongelado] = useState(false);
  const [tempoCongelamento, setTempoCongelamento] = useState(0);
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const freezeTimerRef = useRef<any>(null);
  
  // Non-repeat questions
  const [questoesUsadasRodada, setQuestoesUsadasRodada] = useState<Set<string>>(new Set());
  const [questoesErradasRodada, setQuestoesErradasRodada] = useState<Set<string>>(new Set());
  
  // Visual feedback
  const [laserAtivo, setLaserAtivo] = useState<{ x: number; y: number; cor: string } | null>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const laserAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  const freezeAnim = useRef(new Animated.Value(0)).current;
  
  const [recordeSingle, setRecordeSingle] = useState(0);
  const [recordeMulti, setRecordeMulti] = useState(0);
  const [modalPausaVisivel, setModalPausaVisivel] = useState(false);
  
  // Music
  const [musicaVolume, setMusicaVolume] = useState(0.5);
  const [musicaMuted, setMusicaMuted] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isFocusedRef = useRef(true);
  
  // Multiplayer
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [salasDisponiveis, setSalasDisponiveis] = useState<GameRoom[]>([]);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [isReady, setIsReady] = useState(false);
  
  // Bot state
  const [botPontos, setBotPontos] = useState(0);
  const [botVidas, setBotVidas] = useState(10);
  const botIntervalRef = useRef<any>(null);
  
  // Voice Chat
  const [isRecording, setIsRecording] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [lastVoiceTimestamp, setLastVoiceTimestamp] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const voicePollRef = useRef<any>(null);
  
  // Refs
  const gameLoop = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const spawnTimer = useRef<any>(null);
  const inicioResposta = useRef<number>(Date.now());
  const operacoesAtuaisRef = useRef<{lane: number, y: number}[]>([]);
  const jogoEmAndamentoRef = useRef(false);
  const jogoPausadoRef = useRef(false);
  const multiplayerPollRef = useRef<any>(null);
  const rodadaRef = useRef(1);

  // Update rodadaRef when rodada changes
  useEffect(() => {
    rodadaRef.current = rodada;
  }, [rodada]);

  // ==================== SONS SINTETIZADOS ====================
  const tocarSomTiro = () => Vibration.vibrate(20); 
  const tocarSomErro = () => Vibration.vibrate([0, 50, 50, 50]); 
  const tocarSomPowerUp = () => Vibration.vibrate(100);

  // ==================== MUSIC ====================
  useEffect(() => {
    loadVolumeSettings();
    setupAudio();
    return () => { stopMusic(); };
  }, []);

  const loadVolumeSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('musicVolume');
      if (saved) setMusicaVolume(parseFloat(saved));
    } catch (e) {}
  };

  const saveVolumeSettings = async (vol: number) => {
    try { await AsyncStorage.setItem('musicVolume', vol.toString()); } catch (e) {}
  };

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        allowsRecordingIOS: true,
      });
    } catch (e) {}
  };

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (tela !== 'resultado') playMusic();
      
      return () => {
        isFocusedRef.current = false;
        pauseMusic();
        stopMultiplayerPolling();
        stopVoicePolling();
        stopBotSimulation();
        
        if (jogoEmAndamentoRef.current && !jogoPausadoRef.current) {
          resetGame();
          setTela('menu');
        }
      };
    }, [tela])
  );

  const playMusic = async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.setVolumeAsync(musicaMuted ? 0 : musicaVolume);
          await soundRef.current.playAsync();
          return;
        }
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3' },
        { isLooping: true, volume: musicaMuted ? 0 : musicaVolume, shouldPlay: true }
      );
      soundRef.current = sound;
    } catch (e) {}
  };

  const pauseMusic = async () => {
    try { if (soundRef.current) await soundRef.current.pauseAsync(); } catch (e) {}
  };

  const stopMusic = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (e) {}
  };

  const handleVolumeChange = async (value: number) => {
    setMusicaVolume(value);
    saveVolumeSettings(value);
    if (soundRef.current) {
      try { await soundRef.current.setVolumeAsync(musicaMuted ? 0 : value); } catch (e) {}
    }
  };

  const toggleMute = async () => {
    const newMuted = !musicaMuted;
    setMusicaMuted(newMuted);
    if (soundRef.current) {
      try { await soundRef.current.setVolumeAsync(newMuted ? 0 : musicaVolume); } catch (e) {}
    }
  };

  // ==================== BOT SIMULATION ====================
  const startBotSimulation = () => {
    setBotPontos(0);
    setBotVidas(10);
    botIntervalRef.current = setInterval(() => {
      if (Math.random() < 0.7) {
        setBotPontos(p => p + 10 + (Math.random() > 0.5 ? 20 : 0));
      } else {
        setBotVidas(v => {
          const nv = v - 1;
          if (nv <= 0) stopBotSimulation();
          return Math.max(0, nv);
        });
      }
    }, 2000 + Math.random() * 2000);
  };

  const stopBotSimulation = () => {
    if (botIntervalRef.current) {
      clearInterval(botIntervalRef.current);
      botIntervalRef.current = null;
    }
  };

  // ==================== VOICE CHAT ====================
  const startRecording = async () => {
    if (!currentRoom) return;
    try {
      await Audio.requestPermissionsAsync();
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.LOW_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (e) {}
  };

  const stopRecording = async () => {
    if (!recordingRef.current || !currentRoom) return;
    try {
      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (uri) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await api.enviarVoiceMessage(currentRoom.id, base64);
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {}
  };

  const playVoiceMessage = async (audioBase64: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp4;base64,${audioBase64}` },
        { shouldPlay: true }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {}
  };

  const startVoicePolling = () => {
    if (voicePollRef.current) return;
    voicePollRef.current = setInterval(async () => {
      if (!currentRoom) return;
      try {
        const data = await api.getVoiceMessages(currentRoom.id, lastVoiceTimestamp || undefined);
        if (data.voiceMessages && data.voiceMessages.length > 0) {
          for (const msg of data.voiceMessages) {
            if (msg.senderId !== user?.id) playVoiceMessage(msg.audioBase64);
          }
          setVoiceMessages(prev => [...prev, ...data.voiceMessages]);
          setLastVoiceTimestamp(data.voiceMessages[data.voiceMessages.length - 1].timestamp);
        }
      } catch (e) {}
    }, 2000);
  };

  const stopVoicePolling = () => {
    if (voicePollRef.current) { clearInterval(voicePollRef.current); voicePollRef.current = null; }
  };

  // ==================== MULTIPLAYER ====================
  const criarSala = async () => {
    try {
      const data = await api.criarSalaMultiplayer(2);
      setCurrentRoom(data.room);
      setTela('lobby');
      startMultiplayerPolling(data.roomId);
      startVoicePolling();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível criar a sala');
    }
  };

  const iniciarJogoComBot = () => {
    setModo('bot');
    setBotPontos(0);
    setBotVidas(10);
    setTela('jogo');
    startBotSimulation();
  };

  const entrarSala = async (roomId?: string) => {
    const id = roomId || roomIdInput.trim();
    if (!id) return Alert.alert('Erro', 'Digite o código da sala');
    try {
      const data = await api.entrarSalaMultiplayer(id);
      setCurrentRoom(data.room);
      setRoomIdInput('');
      setTela('lobby');
      startMultiplayerPolling(id);
      startVoicePolling();
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.detail || 'Sala não encontrada');
    }
  };

  const carregarSalas = async () => {
    try {
      const data = await api.listarSalasDisponiveis();
      setSalasDisponiveis(data.rooms || []);
    } catch (e) {}
  };

  const toggleReady = async () => {
    if (!currentRoom) return;
    try {
      const newReady = !isReady;
      setIsReady(newReady);
      await api.setPlayerReady(currentRoom.id, newReady);
    } catch (e) {}
  };

  const iniciarPartidaMultiplayer = async () => {
    if (!currentRoom) return;
    try {
      await api.iniciarJogoMultiplayer(currentRoom.id);
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.detail || 'Não foi possível iniciar');
    }
  };

  const startMultiplayerPolling = (roomId: string) => {
    if (multiplayerPollRef.current) clearInterval(multiplayerPollRef.current);
    multiplayerPollRef.current = setInterval(async () => {
      try {
        const room = await api.getSalaMultiplayer(roomId);
        setCurrentRoom(room);
        
        if (room.status === 'countdown') {
          setCountdown(3);
          setTimeout(() => setCountdown(2), 1000);
          setTimeout(() => setCountdown(1), 2000);
          setTimeout(() => {
            setModo('multi');
            setTela('jogo');
          }, 3000);
        }
        
        if (room.status === 'finished' && room.winner) {
          stopMultiplayerPolling();
          setTela('resultado');
        }
      } catch (e) {}
    }, POLLING_INTERVAL);
  };

  const stopMultiplayerPolling = () => {
    if (multiplayerPollRef.current) { clearInterval(multiplayerPollRef.current); multiplayerPollRef.current = null; }
  };

  const sairSala = async () => {
    if (currentRoom) {
      try { await api.sairSalaMultiplayer(currentRoom.id); } catch (e) {}
    }
    stopMultiplayerPolling();
    stopVoicePolling();
    setCurrentRoom(null);
    setIsReady(false);
    setVoiceMessages([]);
    setTela('menu');
  };

  const syncPontosMultiplayer = async () => {
    if (!currentRoom || modo !== 'multi') return;
    try {
      const data = await api.atualizarPontosMultiplayer(currentRoom.id, pontos, vidas);
      setCurrentRoom(data.room);
    } catch (e) {}
  };

  useEffect(() => {
    if (modo === 'multi' && tela === 'jogo') {
      const syncInterval = setInterval(syncPontosMultiplayer, 1500);
      return () => clearInterval(syncInterval);
    }
  }, [modo, tela, pontos, vidas]);

  // ==================== GAME LOGIC & PHYSICS ====================
  useEffect(() => {
    jogoEmAndamentoRef.current = tela === 'jogo';
  }, [tela]);

  useEffect(() => {
    jogoPausadoRef.current = pausado || modalPausaVisivel;
  }, [pausado, modalPausaVisivel]);

  useEffect(() => { carregarRecordes(); }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [tela]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appStateRef.current === 'active' && 
        (nextAppState === 'background' || nextAppState === 'inactive') && 
        tela === 'jogo') {
      pauseMusic();
      resetGame();
      setTela('menu');
    }
    appStateRef.current = nextAppState;
  };

  useEffect(() => {
    if (tela === 'jogo') {
      iniciarJogo();
      return () => limparTimers();
    }
  }, [tela]);

  const limparTimers = () => {
    if (gameLoop.current) clearInterval(gameLoop.current);
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    if (freezeTimerRef.current) clearInterval(freezeTimerRef.current);
  };

  const resetGame = () => {
    limparTimers();
    stopBotSimulation();
    setOperacoes([]);
    setVidas(10);
    setPontos(0);
    setRodada(1);
    setAcertosRodada(0);
    setMetaRodada(10);
    setAcertos(0);
    setErros(0);
    setErrosConsecutivos(0);
    setDificuldade(1);
    setVelocidade(1);
    setPowerUpDisponivel(false);
    setPausado(false);
    setModalPausaVisivel(false);
    setCongelado(false);
    setTempoCongelamento(0);
    setQuestoesUsadasRodada(new Set());
    setQuestoesErradasRodada(new Set());
    operacoesAtuaisRef.current = [];
    setBotPontos(0);
    setBotVidas(10);
  };

  const calcularMetaRodada = (r: number): number => {
    return r <= 10 ? 10 + (r * 2) : 30 + (r * 5);
  };

  const avancarRodada = () => {
    const nr = rodada + 1;
    setRodada(nr);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(nr));
    setQuestoesUsadasRodada(new Set());
    setQuestoesErradasRodada(new Set());
    setDificuldade(d => Math.min(d + 1, 20));
    setVelocidade(v => Math.min(v + 0.3, 6)); 
    mostrarMensagem(`🎉 Rodada ${nr}!`, 2000);
  };

  // Logica de Pistas
  const obterPistaLivre = (): number => {
    const pistasDisponiveis = [0, 1, 2].filter(pista => {
      const opNaPista = operacoesAtuaisRef.current.find(op => op.lane === pista);
      return !opNaPista || opNaPista.y > GAME_AREA_HEIGHT * 0.2;
    });

    if (pistasDisponiveis.length === 0) return Math.floor(Math.random() * 3);
    return pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
  };

  const gerarOperacao = (): Operacao | null => {
    const currentRodada = rodadaRef.current;
    
    const opsPermitidas = modoMatematica === 'misto' 
      ? ['+', '-', '×', '÷', '^', '√'] 
      : modoMatematica === 'soma' ? ['+']
      : modoMatematica === 'subtracao' ? ['-']
      : modoMatematica === 'multiplicacao' ? ['×']
      : modoMatematica === 'divisao' ? ['÷']
      : modoMatematica === 'potenciacao' ? ['^']
      : ['√'];

    for (let t = 0; t < 50; t++) {
      const op = opsPermitidas[Math.floor(Math.random() * opsPermitidas.length)];
      
      let n1=0, n2: number | string = 0, res=0, texto='';
      const baseMult = Math.min(2 + currentRodada, 12);
      
      switch (op) {
        case '+':
          n1 = Math.floor(Math.random() * (10 * currentRodada)) + 1;
          n2 = Math.floor(Math.random() * (10 * currentRodada)) + 1;
          res = n1 + (n2 as number);
          texto = `${n1} + ${n2}`;
          break;
        case '-':
          n1 = Math.floor(Math.random() * (15 * currentRodada)) + 10;
          n2 = Math.floor(Math.random() * Math.min(n1 - 1, 10 * currentRodada)) + 1;
          res = n1 - (n2 as number);
          texto = `${n1} - ${n2}`;
          break;
        case '×':
          n1 = Math.floor(Math.random() * baseMult) + 2;
          n2 = Math.floor(Math.random() * baseMult) + 2;
          res = n1 * (n2 as number);
          texto = `${n1} × ${n2}`;
          break;
        case '÷':
          n2 = Math.floor(Math.random() * baseMult) + 2;
          res = Math.floor(Math.random() * baseMult) + 1;
          n1 = (n2 as number) * res;
          texto = `${n1} ÷ ${n2}`;
          break;
        case '^': 
          n1 = Math.floor(Math.random() * Math.min(currentRodada + 3, 10)) + 2;
          n2 = 2;
          res = n1 * n1;
          texto = `${n1}²`;
          break;
        case '√':
          res = Math.floor(Math.random() * Math.min(currentRodada + 3, 12)) + 2;
          n1 = res * res;
          n2 = '';
          texto = `√${n1}`;
          break;
        default:
          n1 = 1; n2 = 1; res = 2; texto = '1+1';
      }
      
      const chave = gerarChaveQuestao(n1, op, n2);
      if (questoesUsadasRodada.has(chave) && !questoesErradasRodada.has(chave)) continue;
      
      const isCongelamento = currentRodada >= 3 && Math.random() < QUESTAO_CONGELAMENTO_CHANCE;
      const isEspecial = !isCongelamento && Math.random() < QUESTAO_ESPECIAL_CHANCE;
      
      const laneSelecionada = obterPistaLivre();
      const posX = (laneSelecionada * LANE_WIDTH) + (LANE_WIDTH - CARD_WIDTH) / 2;
      
      setQuestoesUsadasRodada(prev => new Set(prev).add(chave));
      operacoesAtuaisRef.current.push({ lane: laneSelecionada, y: -100 });
      
      return {
        id: Math.random().toString(),
        num1: n1, num2: n2, operador: op as any, resposta: res, textoTela: texto,
        y: new Animated.Value(-100),
        speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
        posX,
        lane: laneSelecionada,
        especial: isEspecial,
        congelamento: isCongelamento,
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
        chave,
      };
    }
    return null;
  };

  const iniciarJogo = () => {
    if (operacoes.length > 0) return;
    resetGame();
    
    if (modo === 'bot') startBotSimulation();
    
    const inicial: Operacao[] = [];
    for (let i = 0; i < 3; i++) {
      const op = gerarOperacao();
      if (op) inicial.push(op);
    }
    setOperacoes(inicial);
    inicial.forEach(op => animarQueda(op));
    
    spawnTimer.current = setInterval(() => {
      if (congelado) return; 
      setOperacoes(ops => {
        if (ops.length < MAX_OPERACOES) {
          const nova = gerarOperacao();
          if (nova) { animarQueda(nova); return [...ops, nova]; }
        }
        return ops;
      });
    }, SPAWN_INTERVAL);
    
    inicioResposta.current = Date.now();
    mostrarMensagem('🎮 Rodada 1!', 1500);
  };

  const animarQueda = (op: Operacao) => {
    if (congelado) return; 
    
    op.y.addListener(({ value }) => {
      const ref = operacoesAtuaisRef.current.find(o => o.lane === op.lane);
      if (ref) ref.y = value;
    });
    
    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 100,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setQuestoesErradasRodada(prev => new Set(prev).add(op.chave));
        perderVida(op.id);
      }
    });
  };

  const mostrarMensagem = (msg: string, dur = 2000) => {
    setMensagemFeedback(msg);
    feedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(dur - 500),
      Animated.timing(feedbackAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setMensagemFeedback(null));
  };

  const dispararLaser = (targetOp: Operacao | null, acertou: boolean) => {
    if (acertou && targetOp) {
      tocarSomTiro();
      const tX = targetOp.posX + CARD_WIDTH / 2;
      const tY = (targetOp.y as any)._value || 100;
      setLaserAtivo({ x: tX, y: tY, cor: targetOp.congelamento ? '#00BFFF' : '#32CD32' });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
        Animated.parallel([
          Animated.timing(targetOp.scale, { toValue: 1.4, duration: 180, useNativeDriver: true }),
          Animated.timing(targetOp.opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => setLaserAtivo(null));
      });
    } else {
      tocarSomErro();
      const rX = width / 2 + (Math.random() - 0.5) * 180;
      const rY = Math.random() * GAME_AREA_HEIGHT * 0.5;
      setLaserAtivo({ x: rX, y: rY, cor: '#FF4444' });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start(() => setLaserAtivo(null));
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
    }
  };

  const verificarResposta = () => {
    if (congelado) return; 
    
    const resN = parseInt(resposta);
    if (isNaN(resN) || resposta === '') return;
    
    const opCorreta = operacoes.find(op => op.resposta === resN);
    
    if (opCorreta) {
      opCorreta.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.lane !== opCorreta.lane);
      
      const tempo = Date.now() - inicioResposta.current;
      const bonus = tempo < 3000 ? 20 : 0;
      setPontos(p => p + 10 + bonus);
      setAcertos(a => a + 1);
      setAcertosRodada(a => {
        const na = a + 1;
        if (na >= metaRodada) avancarRodada();
        return na;
      });
      setErrosConsecutivos(0);
      dispararLaser(opCorreta, true);
      
      if (opCorreta.congelamento) {
        setTimeout(() => {
          setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id));
          ativarCongelamento();
        }, 500);
      } else if (opCorreta.especial && !powerUpDisponivel) {
        tocarSomPowerUp();
        setPowerUpDisponivel(true);
        mostrarMensagem('⭐ Power-up DESTRUIÇÃO!');
        setTimeout(() => setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id)), 500);
      } else {
        setTimeout(() => setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id)), 500);
      }
    } else {
      setErros(e => e + 1);
      setErrosConsecutivos(e => e + 1);
      perderVida();
      dispararLaser(null, false);
    }
    
    setResposta('');
    inicioResposta.current = Date.now();
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel || operacoes.length === 0 || congelado) return;
    tocarSomPowerUp();
    
    const visiveis = operacoes.filter(op => {
      const y = (op.y as any)._value || 0;
      return y >= 0 && y < GAME_AREA_HEIGHT;
    });
    if (visiveis.length === 0) return;
    
    visiveis.forEach(op => {
      op.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.lane !== op.lane);
      Animated.sequence([
        Animated.timing(op.scale, { toValue: 1.3, duration: 180, useNativeDriver: true }),
        Animated.timing(op.opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    });
    
    setPontos(p => p + (visiveis.length * 10)); // Bônus pelas destruições
    setTimeout(() => setOperacoes(ops => ops.filter(o => !visiveis.find(v => v.id === o.id))), 450);
    setPowerUpDisponivel(false);
    mostrarMensagem(`💥 LIMPEZA TOTAL!`);
  };

  const ativarCongelamento = () => {
    setCongelado(true);
    setTempoCongelamento(3);
    operacoes.forEach(op => op.y.stopAnimation());
    freezeAnim.setValue(0);
    Animated.timing(freezeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    mostrarMensagem('❄️ CONGELADO!', 1000);
    
    let tempo = 3;
    freezeTimerRef.current = setInterval(() => {
      tempo--;
      setTempoCongelamento(tempo);
      if (tempo <= 0) {
        clearInterval(freezeTimerRef.current);
        descongelar();
      }
    }, 1000);
  };

  const descongelar = () => {
    setCongelado(false);
    setTempoCongelamento(0);
    Animated.timing(freezeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start();
    
    operacoes.forEach(op => {
      const curY = (op.y as any)._value || 0;
      const remDist = GAME_AREA_HEIGHT + 100 - curY;
      const remTime = (remDist / (GAME_AREA_HEIGHT + 200)) * op.speed * 1.5; 
      Animated.timing(op.y, { toValue: GAME_AREA_HEIGHT + 100, duration: remTime, useNativeDriver: true })
        .start(({ finished }) => { if (finished) perderVida(op.id); });
    });
    mostrarMensagem('🔥 Voltando...', 1500);
  };

  const pausarJogo = () => {
    operacoes.forEach(op => op.y.stopAnimation());
    limparTimers();
    setPausado(true);
    setModalPausaVisivel(true);
  };

  const continuarJogo = () => {
    setPausado(false);
    setModalPausaVisivel(false);
    
    if (!congelado) {
      operacoes.forEach(op => {
        const curY = (op.y as any)._value || 0;
        const remDist = GAME_AREA_HEIGHT + 100 - curY;
        const remTime = (remDist / (GAME_AREA_HEIGHT + 200)) * op.speed;
        Animated.timing(op.y, { toValue: GAME_AREA_HEIGHT + 100, duration: remTime, useNativeDriver: true })
          .start(({ finished }) => { if (finished) perderVida(op.id); });
      });
    }
    
    spawnTimer.current = setInterval(() => {
      if (congelado) return;
      setOperacoes(ops => {
        if (ops.length < MAX_OPERACOES) {
          const nova = gerarOperacao();
          if (nova) { animarQueda(nova); return [...ops, nova]; }
        }
        return ops;
      });
    }, SPAWN_INTERVAL);
    
    inicioResposta.current = Date.now();
  };

  const sairDoJogo = () => {
    resetGame();
    stopBotSimulation();
    if (modo === 'multi' && currentRoom) sairSala();
    setModo('single');
    setTela('menu');
  };

  const perderVida = (opId?: string) => {
    tocarSomErro();
    setVidas(v => {
      const nv = v - 1;
      if (nv <= 0) finalizarJogo();
      return nv;
    });
    setPontos(p => Math.max(0, p - 5));
    if (opId) {
      setOperacoes(ops => {
        const op = ops.find(o => o.id === opId);
        if (op) operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.lane !== op.lane);
        return ops.filter(o => o.id !== opId);
      });
    }
  };

  const finalizarJogo = async () => {
    limparTimers();
    stopBotSimulation();
    setOperacoes([]);
    
    let novoRec = false;
    if (modo === 'single' && pontos > recordeSingle) {
      setRecordeSingle(pontos);
      novoRec = true;
    }
    
    try {
      await api.salvarRecordeJogo(modo === 'single' ? 'singleplayer' : 'multiplayer', pontos);
    } catch (e) {}
    
    if (modo === 'multi') syncPontosMultiplayer();
    
    setTela('resultado');
    if (novoRec) Alert.alert('🏆 RECORDE!', `${pontos} pontos!`);
  };

  const pressionarTecla = (tecla: string) => {
    if (congelado) return;
    if (tecla === 'enviar') verificarResposta();
    else if (tecla === 'apagar') setResposta(r => r.slice(0, -1));
    else setResposta(r => r + tecla);
  };

  const isAdmin = user?.perfil === 'ADMIN';

  // ==================== RENDER ====================
  
  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.menuHeader}>
            <Ionicons name="game-controller" size={56} color="#FFD700" />
            <Text style={styles.menuTitle}>Matemática Turbo</Text>
          </View>

          <View style={styles.volumeContainer}>
            <TouchableOpacity onPress={toggleMute} style={styles.volumeButton}>
              <Ionicons name={musicaMuted ? "volume-mute" : "volume-high"} size={22} color="#FFD700" />
            </TouchableOpacity>
            <Slider style={styles.volumeSlider} minimumValue={0} maximumValue={1} value={musicaVolume}
              onValueChange={handleVolumeChange} minimumTrackTintColor="#FFD700" maximumTrackTintColor="#333" thumbTintColor="#FFD700" />
          </View>

          {/* SELETOR DE MODOS */}
          <Text style={styles.sectionLabel}>1. Escolha o Modo de Jogo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modosScrollRow}>
            {[
              { id: 'misto', icon: 'shuffle', name: 'Misto', color: '#FFD700' },
              { id: 'soma', icon: 'add', name: 'Soma', color: '#32CD32' },
              { id: 'subtracao', icon: 'remove', name: 'Subtração', color: '#FF4444' },
              { id: 'multiplicacao', icon: 'close', name: 'Multiplicação', color: '#4169E1' },
              { id: 'divisao', icon: 'reorder-two', name: 'Divisão', color: '#9B59B6' },
              { id: 'potenciacao', icon: 'chevron-up', name: 'Potências', color: '#FF8C00' },
              { id: 'radiciacao', icon: 'flash', name: 'Raízes', color: '#00CED1' },
            ].map(m => (
              <TouchableOpacity 
                key={m.id} 
                style={[styles.modoCardItem, modoMatematica === m.id && { borderColor: m.color, borderWidth: 2 }]}
                onPress={() => setModoMatematica(m.id as ModoMatematica)}
              >
                <Ionicons name={m.icon as any} size={28} color={m.color} />
                <Text style={styles.modoTextItem}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.sectionLabel}>2. Como deseja jogar?</Text>
          <TouchableOpacity style={styles.iniciarButton} onPress={() => { setModo('single'); setTela('jogo'); }}>
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.iniciarButtonText}>JOGAR SOLO AGORA!</Text>
          </TouchableOpacity>

          <View style={styles.multiSection}>
            <Text style={styles.multiTitle}>🎮 Multiplayer</Text>
            <TouchableOpacity style={styles.multiButton} onPress={criarSala}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.multiButtonText}>Criar Sala</Text>
            </TouchableOpacity>
            
            <View style={styles.joinRow}>
              <TextInput style={styles.roomInput} placeholder="Código da sala" placeholderTextColor="#666"
                value={roomIdInput} onChangeText={setRoomIdInput} autoCapitalize="none" />
              <TouchableOpacity style={styles.joinButton} onPress={() => entrarSala()}>
                <Ionicons name="enter" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.salasButton} onPress={() => { carregarSalas(); setTela('salas'); }}>
              <Text style={styles.salasButtonText}>Ver Salas Disponíveis</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.botButton} onPress={iniciarJogoComBot}>
                <Ionicons name="hardware-chip" size={20} color="#000" />
                <Text style={styles.botButtonText}>🤖 Jogar vs Bot (Admin)</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // SALAS DISPONÍVEIS
  if (tela === 'salas') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.salasContainer}>
          <View style={styles.salasHeader}>
            <TouchableOpacity onPress={() => setTela('menu')}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.salasTitle}>Salas Disponíveis</Text>
            <TouchableOpacity onPress={carregarSalas}>
              <Ionicons name="refresh" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.salasList}>
            {salasDisponiveis.length === 0 ? (
              <Text style={styles.noSalas}>Nenhuma sala disponível</Text>
            ) : (
              salasDisponiveis.map((sala: any) => (
                <TouchableOpacity key={sala.id} style={styles.salaItem} onPress={() => entrarSala(sala.id)}>
                  <View>
                    <Text style={styles.salaHost}>{sala.hostNome}</Text>
                    <Text style={styles.salaId}>{sala.id}</Text>
                  </View>
                  <View style={styles.salaPlayers}>
                    <Text style={styles.salaPlayersText}>{sala.players}/{sala.maxPlayers}</Text>
                    <Ionicons name="people" size={18} color="#888" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // LOBBY MULTIPLAYER
  if (tela === 'lobby' && currentRoom) {
    const isHost = currentRoom.hostId === user?.id;
    const allReady = currentRoom.players.filter(p => !p.isHost).every(p => p.isReady);
    const canStart = isHost && currentRoom.players.length >= 2 && allReady;
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lobbyContainer}>
          <View style={styles.lobbyHeader}>
            <TouchableOpacity onPress={sairSala}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.lobbyTitle}>Sala: {currentRoom.id}</Text>
          </View>

          <View style={styles.playersSection}>
            <Text style={styles.playersTitle}>Jogadores ({currentRoom.players.length}/{currentRoom.maxPlayers})</Text>
            {currentRoom.players.map(player => (
              <View key={player.id} style={styles.playerItem}>
                <View style={styles.playerInfo}>
                  <Ionicons name={player.isHost ? "star" : "person"} size={18} color={player.isHost ? "#FFD700" : "#888"} />
                  <Text style={styles.playerName}>{player.nome}</Text>
                  {player.id === user?.id && <Text style={styles.youBadge}>(você)</Text>}
                </View>
                <View style={[styles.readyBadge, player.isReady || player.isHost ? styles.readyYes : styles.readyNo]}>
                  <Text style={styles.readyText}>{player.isHost ? 'HOST' : player.isReady ? 'PRONTO' : 'AGUARDANDO'}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.voiceSection}>
            <Text style={styles.voiceTitle}>🎤 Chat de Voz</Text>
            <TouchableOpacity 
              style={[styles.voiceButton, isRecording && styles.voiceRecording]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons name={isRecording ? "radio" : "mic"} size={32} color="#fff" />
              <Text style={styles.voiceButtonText}>
                {isRecording ? 'Gravando...' : 'Segure para falar'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.lobbyActions}>
            {!isHost && (
              <TouchableOpacity style={[styles.readyButton, isReady && styles.readyButtonActive]} onPress={toggleReady}>
                <Ionicons name={isReady ? "checkmark-circle" : "ellipse-outline"} size={22} color="#fff" />
                <Text style={styles.readyButtonText}>{isReady ? 'Pronto!' : 'Marcar Pronto'}</Text>
              </TouchableOpacity>
            )}
            
            {isHost && (
              <TouchableOpacity 
                style={[styles.startButton, !canStart && styles.startButtonDisabled]} 
                onPress={iniciarPartidaMultiplayer}
                disabled={!canStart}
              >
                <Ionicons name="play" size={22} color={canStart ? "#000" : "#666"} />
                <Text style={[styles.startButtonText, !canStart && styles.startButtonTextDisabled]}>
                  {canStart ? 'Iniciar Jogo!' : 'Aguardando jogadores...'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {currentRoom.status === 'countdown' && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // RESULTADO
  if (tela === 'resultado') {
    const winner = currentRoom?.winner;
    const isWinner = winner?.id === user?.id;
    const venceuBot = modo === 'bot' && vidas > 0 && botVidas <= 0;
    const perdeuBot = modo === 'bot' && vidas <= 0;
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>
            {modo === 'bot' 
              ? (venceuBot ? '🏆 Você Venceu o Bot!' : perdeuBot ? '🤖 Bot Venceu!' : 'Fim de Jogo!')
              : modo === 'multi' 
                ? (isWinner ? '🏆 Você Venceu!' : '😔 Fim de Jogo') 
                : 'Fim de Jogo!'}
          </Text>
          
          {modo === 'bot' && (
            <View style={styles.botResultContainer}>
              <View style={[styles.botResultCard, vidas > botVidas && styles.winnerHighlight]}>
                <Text style={styles.botResultLabel}>Você</Text>
                <Text style={styles.botResultPoints}>{pontos} pts</Text>
                <Text style={styles.botResultVidas}>{vidas} ❤️</Text>
              </View>
              <Text style={styles.vsText}>VS</Text>
              <View style={[styles.botResultCard, botVidas > vidas && styles.winnerHighlight]}>
                <Text style={styles.botResultLabel}>🤖 Bot</Text>
                <Text style={styles.botResultPoints}>{botPontos} pts</Text>
                <Text style={styles.botResultVidas}>{botVidas} ❤️</Text>
              </View>
            </View>
          )}
          
          {modo === 'multi' && winner && (
            <View style={styles.winnerCard}>
              <Ionicons name="trophy" size={40} color="#FFD700" />
              <Text style={styles.winnerName}>{winner.nome}</Text>
              <Text style={styles.winnerPoints}>{winner.pontos} pts</Text>
            </View>
          )}
          
          {modo === 'single' && (
            <View style={styles.resultadoCard}>
              <Text style={styles.resultadoPontos}>{pontos}</Text>
              <Text style={styles.resultadoLabel}>Seus Pontos</Text>
            </View>
          )}
          
          <View style={styles.estatisticas}>
            <View style={styles.estatItem}>
              <Ionicons name="checkmark-circle" size={22} color="#32CD32" />
              <Text style={styles.estatValor}>{acertos}</Text>
              <Text style={styles.estatLabel}>Acertos</Text>
            </View>
            <View style={styles.estatItem}>
              <Ionicons name="close-circle" size={22} color="#FF4444" />
              <Text style={styles.estatValor}>{erros}</Text>
              <Text style={styles.estatLabel}>Erros</Text>
            </View>
            <View style={styles.estatItem}>
              <Ionicons name="layers" size={22} color="#FFD700" />
              <Text style={styles.estatValor}>{rodada}</Text>
              <Text style={styles.estatLabel}>Rodadas</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.jogarNovamenteButton} onPress={() => { 
            resetGame(); 
            if (modo === 'multi') sairSala();
            setModo('single');
            setTela('jogo'); 
          }}>
            <Ionicons name="refresh" size={22} color="#000" />
            <Text style={styles.jogarNovamenteText}>Jogar Novamente</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.voltarMenuButton} onPress={() => {
            if (modo === 'multi') sairSala();
            setModo('single');
            setTela('menu');
          }}>
            <Text style={styles.voltarMenuText}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // TELA DE JOGO
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.gameHeader}>
        <View style={styles.gameStats}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.statText}>{pontos}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trophy" size={14} color="#4169E1" />
            <Text style={styles.statText}>{acertosRodada}/{metaRodada}</Text>
          </View>
        </View>
        
        <Text style={styles.rodadaText}>R{rodada}</Text>
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
            <Ionicons name={musicaMuted ? "volume-mute" : "volume-high"} size={16} color="#888" />
          </TouchableOpacity>
          
          {(modo === 'multi' || modo === 'bot') && currentRoom && (
            <TouchableOpacity 
              style={[styles.voiceHeaderButton, isRecording && styles.voiceHeaderRecording]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
            >
              <Ionicons name="mic" size={18} color={isRecording ? "#FF4444" : "#888"} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={pausarJogo}>
            <Ionicons name="pause" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bot/Multiplayer scores */}
      {modo === 'bot' && (
        <View style={styles.multiScores}>
          <View style={[styles.multiScoreItem, styles.multiScoreYou]}>
            <Text style={styles.multiScoreName}>Você</Text>
            <Text style={styles.multiScorePoints}>{pontos}</Text>
            <View style={styles.multiScoreVidas}>
              {Array.from({length: 3}).map((_, i) => (
                <View key={i} style={[styles.miniVida, i < Math.ceil(vidas/3) ? styles.miniVidaAtiva : styles.miniVidaInativa]} />
              ))}
            </View>
          </View>
          <View style={styles.multiScoreItem}>
            <Text style={styles.multiScoreName}>🤖 Bot</Text>
            <Text style={styles.multiScorePoints}>{botPontos}</Text>
            <View style={styles.multiScoreVidas}>
              {Array.from({length: 3}).map((_, i) => (
                <View key={i} style={[styles.miniVida, i < Math.ceil(botVidas/3) ? styles.miniVidaAtiva : styles.miniVidaInativa]} />
              ))}
            </View>
          </View>
        </View>
      )}

      {modo === 'multi' && currentRoom && (
        <View style={styles.multiScores}>
          {currentRoom.players.map(p => (
            <View key={p.id} style={[
              styles.multiScoreItem, 
              p.id === user?.id && styles.multiScoreYou,
              p.vidas <= 0 && styles.multiScoreDead
            ]}>
              <Text style={[styles.multiScoreName, p.vidas <= 0 && styles.deadText]} numberOfLines={1}>
                {p.nome.split(' ')[0]} {p.vidas <= 0 && '💀'}
              </Text>
              <Text style={[styles.multiScorePoints, p.vidas <= 0 && styles.deadText]}>{p.pontos}</Text>
              <View style={styles.multiScoreVidas}>
                {Array.from({length: 3}).map((_, i) => (
                  <View key={i} style={[styles.miniVida, i < Math.ceil(p.vidas/3) ? styles.miniVidaAtiva : styles.miniVidaInativa]} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.vidasContainer}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={[styles.vidaMarca, i < vidas ? styles.vidaAtiva : styles.vidaInativa]} />
        ))}
      </View>

      <View style={[styles.gameArea, { height: GAME_AREA_HEIGHT }, congelado && styles.gameAreaFrozen]}>
        {operacoes.map((op) => (
          <Animated.View key={op.id} style={[
            styles.operacaoCard,
            op.especial && styles.operacaoEspecial,
            op.congelamento && styles.operacaoCongelamento,
            { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity }
          ]}>
            {op.especial && <Ionicons name="star" size={9} color="#FFD700" style={styles.estrelaEspecial} />}
            {op.congelamento && <Ionicons name="snow" size={9} color="#00BFFF" style={styles.estrelaEspecial} />}
            <Text style={[styles.operacaoText, op.especial && { color: '#000' }, op.congelamento && { color: '#fff' }]}>
              {op.textoTela}
            </Text>
          </Animated.View>
        ))}
        
        {laserAtivo && (
          <Animated.View style={[
            styles.laser,
            { opacity: laserAnim, transform: [{ translateY: laserAnim.interpolate({ inputRange: [0, 1], outputRange: [height - 280, laserAtivo.y] }) }],
              left: laserAtivo.x - 2, backgroundColor: laserAtivo.cor }
          ]} />
        )}
      </View>

      {/* BOTÃO MANUAL DE POWER-UP */}
      <View style={styles.powerUpRow}>
        {powerUpDisponivel ? (
          <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}>
            <Ionicons name="flash" size={20} color="#000" />
            <Text style={styles.txtPowerUpAtivo}>USAR DESTRUIÇÃO!</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btnPowerUpInativo}>
            <Text style={styles.txtPowerUpInativo}>Pegue uma estrela para carregar</Text>
          </View>
        )}
      </View>

      {mensagemFeedback && (
        <Animated.View style={[styles.mensagemOverlay, { opacity: feedbackAnim, transform: [{ scale: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
          <Text style={styles.mensagemText}>{mensagemFeedback}</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }, congelado && styles.displayFrozen]}>
        <Text style={styles.displayText}>{resposta || '?'}</Text>
      </Animated.View>

      <View style={[styles.tecladoContainer, congelado && styles.tecladoFrozen]}>
        {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
          <View key={i} style={styles.tecladoRow}>
            {row.map(num => (
              <TouchableOpacity key={num} style={[styles.tecla, congelado && styles.teclaFrozen]} onPress={() => pressionarTecla(num)} disabled={congelado}>
                <Text style={styles.teclaText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.tecladoRow}>
          <TouchableOpacity style={[styles.tecla, styles.teclaApagar, congelado && styles.teclaFrozen]} onPress={() => pressionarTecla('apagar')} disabled={congelado}>
            <Ionicons name="backspace" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tecla, congelado && styles.teclaFrozen]} onPress={() => pressionarTecla('0')} disabled={congelado}>
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tecla, styles.teclaEnviar, congelado && styles.teclaFrozen]} onPress={() => pressionarTecla('enviar')} disabled={congelado}>
            <Ionicons name="flash" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {modalPausaVisivel && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalPausaContainer}>
            <View style={styles.modalPausaHeader}>
              <Ionicons name="pause-circle" size={56} color="#FFD700" />
              <Text style={styles.modalPausaTitulo}>Pausado</Text>
            </View>
            
            <View style={styles.pausaVolumeContainer}>
              <Text style={styles.pausaVolumeLabel}>Volume</Text>
              <View style={styles.pausaVolumeRow}>
                <TouchableOpacity onPress={toggleMute}>
                  <Ionicons name={musicaMuted ? "volume-mute" : "volume-high"} size={22} color="#FFD700" />
                </TouchableOpacity>
                <Slider style={styles.pausaVolumeSlider} minimumValue={0} maximumValue={1} value={musicaVolume}
                  onValueChange={handleVolumeChange} minimumTrackTintColor="#FFD700" maximumTrackTintColor="#333" thumbTintColor="#FFD700" />
              </View>
            </View>
            
            <View style={styles.modalPausaStats}>
              <View style={styles.pausaStatItem}>
                <Text style={styles.pausaStatValor}>{pontos}</Text>
                <Text style={styles.pausaStatLabel}>Pts</Text>
              </View>
              <View style={styles.pausaStatDivider} />
              <View style={styles.pausaStatItem}>
                <Text style={styles.pausaStatValor}>R{rodada}</Text>
                <Text style={styles.pausaStatLabel}>Rodada</Text>
              </View>
              <View style={styles.pausaStatDivider} />
              <View style={styles.pausaStatItem}>
                <Text style={styles.pausaStatValor}>{vidas}</Text>
                <Text style={styles.pausaStatLabel}>Vidas</Text>
              </View>
            </View>
            
            <View style={styles.modalPausaBotoes}>
              <TouchableOpacity style={styles.continuarButton} onPress={continuarJogo}>
                <Ionicons name="play" size={22} color="#000" />
                <Text style={styles.continuarButtonText}>Continuar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sairButton} onPress={sairDoJogo}>
                <Ionicons name="exit" size={22} color="#fff" />
                <Text style={styles.sairButtonText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  menuContainer: { flex: 1, padding: 16 },
  menuHeader: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  menuTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 8 },
  volumeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 10, borderRadius: 10, marginBottom: 12 },
  volumeButton: { padding: 4 },
  volumeSlider: { flex: 1, height: 36, marginHorizontal: 8 },
  
  // Modos
  sectionLabel: { color: '#888', fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 8 },
  modosScrollRow: { gap: 10, paddingBottom: 10 },
  modoCardItem: { backgroundColor: '#1a1a2e', width: 90, height: 90, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  modoTextItem: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginTop: 6, textAlign: 'center' },
  
  recordesContainer: { flexDirection: 'row', gap: 8, marginBottom: 14, marginTop: 10 },
  recordeCard: { flex: 1, backgroundColor: '#1a1a2e', padding: 12, borderRadius: 10, alignItems: 'center' },
  recordeLabel: { color: '#888', fontSize: 10, marginTop: 4 },
  recordeValor: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  
  multiSection: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginTop: 10, marginBottom: 40 },
  multiTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  multiButton: { flexDirection: 'row', backgroundColor: '#4169E1', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  multiButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  joinRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  roomInput: { flex: 1, backgroundColor: '#0c0c0c', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 },
  joinButton: { backgroundColor: '#32CD32', padding: 10, borderRadius: 8, justifyContent: 'center' },
  salasButton: { alignItems: 'center', padding: 8 },
  salasButtonText: { color: '#FFD700', fontSize: 13 },
  botButton: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  botButtonText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
  
  // Salas
  salasContainer: { flex: 1, padding: 16 },
  salasHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  salasTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  salasList: { flex: 1 },
  noSalas: { color: '#888', textAlign: 'center', marginTop: 40 },
  salaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginBottom: 10 },
  salaHost: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  salaId: { color: '#888', fontSize: 11, marginTop: 2 },
  salaPlayers: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  salaPlayersText: { color: '#FFD700', fontSize: 14 },
  
  // Lobby
  lobbyContainer: { flex: 1, padding: 16 },
  lobbyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  lobbyTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  playersSection: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginBottom: 16 },
  playersTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  playerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  playerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerName: { color: '#fff', fontSize: 14 },
  youBadge: { color: '#FFD700', fontSize: 11 },
  readyBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  readyYes: { backgroundColor: '#32CD32' },
  readyNo: { backgroundColor: '#666' },
  readyText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  voiceSection: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginBottom: 16, alignItems: 'center' },
  voiceTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
  voiceButton: { backgroundColor: '#4169E1', padding: 16, borderRadius: 50, alignItems: 'center', width: 100, height: 100, justifyContent: 'center' },
  voiceRecording: { backgroundColor: '#FF4444' },
  voiceButtonText: { color: '#fff', fontSize: 10, marginTop: 4, textAlign: 'center' },
  lobbyActions: { gap: 10 },
  readyButton: { flexDirection: 'row', backgroundColor: '#666', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  readyButtonActive: { backgroundColor: '#32CD32' },
  readyButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  startButton: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  startButtonDisabled: { backgroundColor: '#333' },
  startButtonText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
  startButtonTextDisabled: { color: '#666' },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  countdownText: { color: '#FFD700', fontSize: 120, fontWeight: 'bold' },
  
  // Game
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingTop: 4, paddingBottom: 2 },
  gameStats: { flexDirection: 'row', gap: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  rodadaText: { color: '#4169E1', fontSize: 16, fontWeight: '900' },
  powerUpIndicator: { backgroundColor: '#FFD700' + '30', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muteButton: { padding: 3 },
  voiceHeaderButton: { padding: 4 },
  voiceHeaderRecording: { backgroundColor: '#FF444430', borderRadius: 12 },
  multiScores: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 4 },
  multiScoreItem: { backgroundColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: 'center', minWidth: 70 },
  multiScoreYou: { borderWidth: 1, borderColor: '#FFD700' },
  multiScoreDead: { backgroundColor: '#333', opacity: 0.6 },
  multiScoreName: { color: '#888', fontSize: 10 },
  multiScorePoints: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  deadText: { color: '#666' },
  multiScoreVidas: { flexDirection: 'row', gap: 2, marginTop: 2 },
  miniVida: { width: 5, height: 5, borderRadius: 3 },
  miniVidaAtiva: { backgroundColor: '#FF4444' },
  miniVidaInativa: { backgroundColor: '#333' },
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4 },
  vidaMarca: { width: 6, height: 6, borderRadius: 3 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  
  // Freeze
  freezeOverlay: { position: 'absolute', top: 80, alignSelf: 'center', backgroundColor: '#00BFFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, zIndex: 100 },
  freezeText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  gameAreaFrozen: { borderWidth: 2, borderColor: '#00BFFF' },
  displayFrozen: { borderWidth: 2, borderColor: '#00BFFF' },
  tecladoFrozen: { opacity: 0.5 },
  teclaFrozen: { backgroundColor: '#333' },
  
  gameArea: { flex: 1, position: 'relative', backgroundColor: '#0a0a0a' },
  operacaoCard: { position: 'absolute', backgroundColor: '#4169E1', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, width: CARD_WIDTH, alignItems: 'center' },
  operacaoEspecial: { backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFF' },
  operacaoCongelamento: { backgroundColor: '#00BFFF', borderWidth: 2, borderColor: '#fff' },
  estrelaEspecial: { position: 'absolute', top: -8, right: -5, backgroundColor: '#000', borderRadius: 10, padding: 2 },
  operacaoText: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  laser: { position: 'absolute', width: 4, height: height, zIndex: -1 },
  mensagemOverlay: { position: 'absolute', top: '28%', alignSelf: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#FFD700' },
  mensagemText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  
  // Power Up Botao
  powerUpRow: { paddingHorizontal: 16, paddingVertical: 5 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  btnPowerUpInativo: { backgroundColor: '#1a1a2e', padding: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  txtPowerUpInativo: { color: '#444', fontSize: 12, fontWeight: 'bold' },

  displayContainer: { backgroundColor: '#1a1a2e', marginHorizontal: 16, padding: 8, marginVertical: 5, borderRadius: 8, alignItems: 'center' },
  displayText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  tecladoContainer: { paddingHorizontal: 16, paddingVertical: 4, paddingBottom: 15, gap: 6 },
  tecladoRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  tecla: { backgroundColor: '#1a1a2e', flex: 1, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  // Resultado
  resultadoContainer: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 10, textAlign: 'center' },
  botResultContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  botResultCard: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, alignItems: 'center', minWidth: 100 },
  winnerHighlight: { borderWidth: 2, borderColor: '#FFD700' },
  botResultLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  botResultPoints: { color: '#FFD700', fontSize: 24, fontWeight: 'bold' },
  botResultVidas: { color: '#FF4444', fontSize: 14, marginTop: 4 },
  vsText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  winnerCard: { backgroundColor: '#FFD70020', padding: 20, borderRadius: 14, alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#FFD700' },
  winnerName: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  winnerPoints: { color: '#fff', fontSize: 16 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 20, width: '100%' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  estatisticas: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  estatItem: { alignItems: 'center' },
  estatValor: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  estatLabel: { color: '#888', fontSize: 10, marginTop: 2 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 12, alignItems: 'center', gap: 8, marginBottom: 10, width: '100%', justifyContent: 'center' },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
  voltarMenuButton: { paddingHorizontal: 24, paddingVertical: 12 },
  voltarMenuText: { color: '#888', fontSize: 14 },
  
  // Pausa
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalPausaContainer: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, width: '86%', maxWidth: 320, alignItems: 'center' },
  modalPausaHeader: { alignItems: 'center', marginBottom: 12 },
  modalPausaTitulo: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  pausaVolumeContainer: { width: '100%', marginBottom: 12 },
  pausaVolumeLabel: { color: '#888', fontSize: 11, marginBottom: 6 },
  pausaVolumeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pausaVolumeSlider: { flex: 1, height: 32 },
  modalPausaStats: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 14, paddingVertical: 12, paddingHorizontal: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8, width: '100%' },
  pausaStatItem: { alignItems: 'center', flex: 1 },
  pausaStatValor: { fontSize: 20, fontWeight: 'bold', color: '#FFD700' },
  pausaStatLabel: { fontSize: 10, color: '#888', marginTop: 2 },
  pausaStatDivider: { width: 1, height: 32, backgroundColor: '#333' },
  modalPausaBotoes: { width: '100%', gap: 8 },
  continuarButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  continuarButtonText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
  sairButton: { flexDirection: 'row', backgroundColor: '#E74C3C', paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  sairButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
