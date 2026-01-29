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
const QUESTAO_ESPECIAL_CHANCE = 0.15;
const CARD_WIDTH = 105;
const CARD_HEIGHT = 38;
const MIN_SPACING_X = CARD_WIDTH + 12;
const MIN_SPACING_Y = CARD_HEIGHT + 25;
const POLLING_INTERVAL = 1000; // Poll every second for multiplayer sync

const gerarChaveQuestao = (num1: number, operador: string, num2: number) => 
  `${num1}${operador}${num2}`;

interface Operacao {
  id: string;
  num1: number;
  num2: number;
  operador: '+' | '-' | '×' | '÷';
  resposta: number;
  y: Animated.Value;
  speed: number;
  posX: number;
  especial: boolean;
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
  const [modo, setModo] = useState<'single' | 'multi'>('single');
  
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
  const [tempoRespostas, setTempoRespostas] = useState<number[]>([]);
  const [pausado, setPausado] = useState(false);
  
  // Non-repeat questions
  const [questoesUsadasRodada, setQuestoesUsadasRodada] = useState<Set<string>>(new Set());
  const [questoesErradasRodada, setQuestoesErradasRodada] = useState<Set<string>>(new Set());
  
  // Visual feedback
  const [laserAtivo, setLaserAtivo] = useState<{ x: number; y: number; cor: string } | null>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const laserAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [powerUpTipo, setPowerUpTipo] = useState<'eliminar' | null>(null);
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
  const operacoesAtuaisRef = useRef<{posX: number, y: number}[]>([]);
  const assistenciaTimer = useRef<any>(null);
  const jogoEmAndamentoRef = useRef(false);
  const jogoPausadoRef = useRef(false);
  const multiplayerPollRef = useRef<any>(null);

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
      // Simple looping background music
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
    } catch (e) {
      console.log('Erro ao iniciar gravação:', e);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current || !currentRoom) return;
    try {
      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      
      if (uri) {
        // Convert to base64 and send
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await api.enviarVoiceMessage(currentRoom.id, base64);
        };
        reader.readAsDataURL(blob);
      }
    } catch (e) {
      console.log('Erro ao parar gravação:', e);
    }
  };

  const playVoiceMessage = async (audioBase64: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp4;base64,${audioBase64}` },
        { shouldPlay: true }
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      console.log('Erro ao reproduzir voz:', e);
    }
  };

  const startVoicePolling = () => {
    if (voicePollRef.current) return;
    voicePollRef.current = setInterval(async () => {
      if (!currentRoom) return;
      try {
        const data = await api.getVoiceMessages(currentRoom.id, lastVoiceTimestamp || undefined);
        if (data.voiceMessages && data.voiceMessages.length > 0) {
          for (const msg of data.voiceMessages) {
            if (msg.senderId !== user?.id) {
              playVoiceMessage(msg.audioBase64);
            }
          }
          setVoiceMessages(prev => [...prev, ...data.voiceMessages]);
          setLastVoiceTimestamp(data.voiceMessages[data.voiceMessages.length - 1].timestamp);
        }
      } catch (e) {}
    }, 2000);
  };

  const stopVoicePolling = () => {
    if (voicePollRef.current) {
      clearInterval(voicePollRef.current);
      voicePollRef.current = null;
    }
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
    if (multiplayerPollRef.current) {
      clearInterval(multiplayerPollRef.current);
      multiplayerPollRef.current = null;
    }
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

  // Sync pontos periodically in multiplayer
  useEffect(() => {
    if (modo === 'multi' && tela === 'jogo') {
      const syncInterval = setInterval(syncPontosMultiplayer, 1500);
      return () => clearInterval(syncInterval);
    }
  }, [modo, tela, pontos, vidas]);

  // ==================== GAME LOGIC ====================
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

  useEffect(() => {
    if (tela === 'jogo') iniciarAssistenciaInteligente();
    return () => { if (assistenciaTimer.current) clearInterval(assistenciaTimer.current); };
  }, [tela, operacoes, errosConsecutivos]);

  const limparTimers = () => {
    if (gameLoop.current) clearInterval(gameLoop.current);
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
  };

  const resetGame = () => {
    limparTimers();
    setOperacoes([]);
    setVidas(10);
    setPontos(0);
    setRodada(1);
    setAcertosRodada(0);
    setMetaRodada(10);
    setAcertos(0);
    setErros(0);
    setErrosConsecutivos(0);
    setTempoRespostas([]);
    setDificuldade(1);
    setVelocidade(1);
    setPowerUpDisponivel(false);
    setPowerUpTipo(null);
    setPausado(false);
    setModalPausaVisivel(false);
    setQuestoesUsadasRodada(new Set());
    setQuestoesErradasRodada(new Set());
    operacoesAtuaisRef.current = [];
  };

  const carregarRecordes = async () => {
    try {
      const rec = await api.getRecordesJogo();
      setRecordeSingle(rec.singleplayer || 0);
      setRecordeMulti(rec.multiplayer || 0);
    } catch (e) {}
  };

  const calcularMetaRodada = (r: number): number => {
    const metas: { [k: number]: number } = {1:10,2:12,3:15,4:20,5:25,6:30,7:40,8:45,9:55,10:70};
    return r <= 10 ? metas[r] : 70 + (r - 10) * 10;
  };

  const avancarRodada = () => {
    const nr = rodada + 1;
    setRodada(nr);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(nr));
    setQuestoesUsadasRodada(new Set());
    setQuestoesErradasRodada(new Set());
    setDificuldade(d => Math.min(d + 0.5, 15));
    setVelocidade(v => Math.min(v + 0.3, 5));
    mostrarMensagem(`🎉 Rodada ${nr}!`, 2000);
  };

  const verificarColisaoX = (novaPosX: number): boolean => {
    return operacoesAtuaisRef.current.some(op => 
      Math.abs(op.posX - novaPosX) < MIN_SPACING_X && op.y < MIN_SPACING_Y * 2
    );
  };

  const gerarPosicaoX = (): number => {
    const padding = 12;
    const numSlots = Math.floor((width - padding * 2) / MIN_SPACING_X);
    const slotWidth = (width - padding * 2) / numSlots;
    
    for (let t = 0; t < 25; t++) {
      const slot = Math.floor(Math.random() * numSlots);
      const posX = padding + slot * slotWidth + (slotWidth - CARD_WIDTH) / 2;
      if (!verificarColisaoX(posX)) return posX;
    }
    return padding + Math.random() * (width - CARD_WIDTH - padding * 2);
  };

  const gerarOperacao = (): Operacao | null => {
    const ops: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];
    const especial = Math.random() < QUESTAO_ESPECIAL_CHANCE;
    
    for (let t = 0; t < 50; t++) {
      const op = ops[Math.floor(Math.random() * ops.length)];
      const minN = Math.max(1, Math.floor(dificuldade / 2));
      const maxN = Math.min(10 + Math.floor(dificuldade * 4), 99);
      const maxM = Math.min(2 + Math.floor(dificuldade), 15);
      
      let n1: number, n2: number, res: number;
      
      switch (op) {
        case '+':
          n1 = Math.floor(Math.random() * maxN) + minN;
          n2 = Math.floor(Math.random() * maxN) + minN;
          res = n1 + n2;
          break;
        case '-':
          n1 = Math.floor(Math.random() * maxN) + minN + 10;
          n2 = Math.floor(Math.random() * Math.min(n1 - 1, maxN)) + 1;
          res = n1 - n2;
          break;
        case '×':
          n1 = Math.floor(Math.random() * maxM) + 2;
          n2 = Math.floor(Math.random() * maxM) + 2;
          res = n1 * n2;
          break;
        case '÷':
          n2 = Math.floor(Math.random() * maxM) + 2;
          res = Math.floor(Math.random() * maxM) + 1;
          n1 = n2 * res;
          break;
        default:
          n1 = 1; n2 = 1; res = 2;
      }
      
      const chave = gerarChaveQuestao(n1, op, n2);
      if (questoesUsadasRodada.has(chave) && !questoesErradasRodada.has(chave)) continue;
      
      const posX = gerarPosicaoX();
      setQuestoesUsadasRodada(prev => new Set(prev).add(chave));
      operacoesAtuaisRef.current.push({ posX, y: -100 });
      
      return {
        id: Math.random().toString(),
        num1: n1, num2: n2, operador: op, resposta: res,
        y: new Animated.Value(-100),
        speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
        posX, especial,
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
    
    const inicial: Operacao[] = [];
    for (let i = 0; i < 3; i++) {
      const op = gerarOperacao();
      if (op) inicial.push(op);
    }
    setOperacoes(inicial);
    inicial.forEach(op => animarQueda(op));
    
    spawnTimer.current = setInterval(() => {
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
    op.y.addListener(({ value }) => {
      const ref = operacoesAtuaisRef.current.find(o => o.posX === op.posX);
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
      const tX = targetOp.posX + CARD_WIDTH / 2;
      const tY = (targetOp.y as any)._value || 100;
      setLaserAtivo({ x: tX, y: tY, cor: '#32CD32' });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
        Animated.parallel([
          Animated.timing(targetOp.scale, { toValue: 1.4, duration: 180, useNativeDriver: true }),
          Animated.timing(targetOp.opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => setLaserAtivo(null));
      });
    } else {
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
    const resN = parseInt(resposta);
    if (isNaN(resN) || resposta === '') return;
    
    const opCorreta = operacoes.find(op => op.resposta === resN);
    
    if (opCorreta) {
      opCorreta.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.posX !== opCorreta.posX);
      
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
      setTempoRespostas(t => [...t, tempo]);
      dispararLaser(opCorreta, true);
      
      if (opCorreta.especial && !powerUpDisponivel) {
        setPowerUpDisponivel(true);
        setPowerUpTipo('eliminar');
        mostrarMensagem('⭐ Power-up!');
      }
      
      setTimeout(() => setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id)), 500);
    } else {
      setErros(e => e + 1);
      setErrosConsecutivos(e => e + 1);
      setVidas(v => {
        const nv = v - 1;
        if (nv <= 0) finalizarJogo();
        return nv;
      });
      setPontos(p => Math.max(0, p - 5));
      dispararLaser(null, false);
    }
    
    setResposta('');
    inicioResposta.current = Date.now();
  };

  const iniciarAssistenciaInteligente = () => {
    if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
    assistenciaTimer.current = setInterval(() => {
      if (powerUpDisponivel && powerUpTipo) {
        const tempo = Date.now() - inicioResposta.current;
        if (operacoes.length >= MAX_OPERACOES || tempo > 8000 || errosConsecutivos >= 2) {
          usarPowerUp();
        }
      }
    }, 2000);
  };

  const usarPowerUp = () => {
    if (!powerUpDisponivel || operacoes.length === 0) return;
    const visiveis = operacoes.filter(op => {
      const y = (op.y as any)._value || 0;
      return y >= 0 && y < GAME_AREA_HEIGHT;
    });
    if (visiveis.length === 0) return;
    
    visiveis.forEach(op => {
      op.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.posX !== op.posX);
      Animated.sequence([
        Animated.timing(op.scale, { toValue: 1.3, duration: 180, useNativeDriver: true }),
        Animated.timing(op.opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]).start();
    });
    
    setTimeout(() => setOperacoes(ops => ops.filter(o => !visiveis.find(v => v.id === o.id))), 450);
    setPowerUpDisponivel(false);
    setPowerUpTipo(null);
    mostrarMensagem(`💥 ${visiveis.length} eliminadas!`);
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
    
    operacoes.forEach(op => {
      const curY = (op.y as any)._value || 0;
      const remDist = GAME_AREA_HEIGHT + 100 - curY;
      const remTime = (remDist / (GAME_AREA_HEIGHT + 200)) * op.speed;
      Animated.timing(op.y, { toValue: GAME_AREA_HEIGHT + 100, duration: remTime, useNativeDriver: true })
        .start(({ finished }) => { if (finished) perderVida(op.id); });
    });
    
    spawnTimer.current = setInterval(() => {
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
    if (modo === 'multi' && currentRoom) {
      sairSala();
    }
    setModo('single');
    setTela('menu');
  };

  const perderVida = (opId?: string) => {
    setVidas(v => {
      const nv = v - 1;
      if (nv <= 0) finalizarJogo();
      return nv;
    });
    setPontos(p => Math.max(0, p - 5));
    if (opId) {
      setOperacoes(ops => {
        const op = ops.find(o => o.id === opId);
        if (op) operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.posX !== op.posX);
        return ops.filter(o => o.id !== opId);
      });
    }
  };

  const finalizarJogo = async () => {
    limparTimers();
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
    if (tecla === 'enviar') verificarResposta();
    else if (tecla === 'apagar') setResposta(r => r.slice(0, -1));
    else setResposta(r => r + tecla);
  };

  // ==================== RENDER ====================
  
  // MENU
  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.menuHeader}>
            <Ionicons name="game-controller" size={56} color="#FFD700" />
            <Text style={styles.menuTitle}>Jogo de Matemática</Text>
          </View>

          <View style={styles.volumeContainer}>
            <TouchableOpacity onPress={toggleMute} style={styles.volumeButton}>
              <Ionicons name={musicaMuted ? "volume-mute" : "volume-high"} size={22} color="#FFD700" />
            </TouchableOpacity>
            <Slider style={styles.volumeSlider} minimumValue={0} maximumValue={1} value={musicaVolume}
              onValueChange={handleVolumeChange} minimumTrackTintColor="#FFD700" maximumTrackTintColor="#333" thumbTintColor="#FFD700" />
            <Text style={styles.volumeText}>{Math.round(musicaVolume * 100)}%</Text>
          </View>

          <View style={styles.recordesContainer}>
            <View style={styles.recordeCard}>
              <Ionicons name="person" size={22} color="#4169E1" />
              <Text style={styles.recordeLabel}>Solo</Text>
              <Text style={styles.recordeValor}>{recordeSingle}</Text>
            </View>
            <View style={styles.recordeCard}>
              <Ionicons name="people" size={22} color="#32CD32" />
              <Text style={styles.recordeLabel}>Multi</Text>
              <Text style={styles.recordeValor}>{recordeMulti}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.iniciarButton} onPress={() => { setModo('single'); setTela('jogo'); }}>
            <Ionicons name="play" size={22} color="#000" />
            <Text style={styles.iniciarButtonText}>Jogar Solo</Text>
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
          </View>

          <View style={styles.instrucoes}>
            <Text style={styles.instrucoesTitle}>Como Jogar:</Text>
            <Text style={styles.instrucoesText}>• Resolva as operações antes de caírem</Text>
            <Text style={styles.instrucoesText}>• Questões ⭐ dão power-ups</Text>
            <Text style={styles.instrucoesText}>• No multiplayer: chat de voz!</Text>
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

          {/* Voice Chat */}
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
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>
            {modo === 'multi' ? (isWinner ? '🏆 Você Venceu!' : '😔 Fim de Jogo') : 'Fim de Jogo!'}
          </Text>
          
          {modo === 'multi' && winner && (
            <View style={styles.winnerCard}>
              <Ionicons name="trophy" size={40} color="#FFD700" />
              <Text style={styles.winnerName}>{winner.nome}</Text>
              <Text style={styles.winnerPoints}>{winner.pontos} pts</Text>
            </View>
          )}
          
          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{pontos}</Text>
            <Text style={styles.resultadoLabel}>Seus Pontos</Text>
          </View>
          
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
        
        {powerUpDisponivel && (
          <View style={styles.powerUpIndicator}>
            <Ionicons name="flash" size={12} color="#FFD700" />
          </View>
        )}
        
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
            <Ionicons name={musicaMuted ? "volume-mute" : "volume-high"} size={16} color="#888" />
          </TouchableOpacity>
          
          {/* Voice button in multiplayer */}
          {modo === 'multi' && currentRoom && (
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

      {/* Multiplayer scores */}
      {modo === 'multi' && currentRoom && (
        <View style={styles.multiScores}>
          {currentRoom.players.map(p => (
            <View key={p.id} style={[styles.multiScoreItem, p.id === user?.id && styles.multiScoreYou]}>
              <Text style={styles.multiScoreName} numberOfLines={1}>{p.nome.split(' ')[0]}</Text>
              <Text style={styles.multiScorePoints}>{p.pontos}</Text>
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

      <View style={[styles.gameArea, { height: GAME_AREA_HEIGHT }]}>
        {operacoes.map((op) => (
          <Animated.View key={op.id} style={[
            styles.operacaoCard,
            op.especial && styles.operacaoEspecial,
            { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity }
          ]}>
            {op.especial && <Ionicons name="star" size={9} color="#FFD700" style={styles.estrelaEspecial} />}
            <Text style={[styles.operacaoText, op.especial && { color: '#000' }]}>
              {op.num1} {op.operador} {op.num2}
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

      {mensagemFeedback && (
        <Animated.View style={[styles.mensagemOverlay, { opacity: feedbackAnim, transform: [{ scale: feedbackAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
          <Text style={styles.mensagemText}>{mensagemFeedback}</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}>
        <Text style={styles.displayText}>{resposta || '0'}</Text>
      </Animated.View>

      <View style={styles.tecladoContainer}>
        {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
          <View key={i} style={styles.tecladoRow}>
            {row.map(num => (
              <TouchableOpacity key={num} style={styles.tecla} onPress={() => pressionarTecla(num)}>
                <Text style={styles.teclaText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <View style={styles.tecladoRow}>
          <TouchableOpacity style={[styles.tecla, styles.teclaApagar]} onPress={() => pressionarTecla('apagar')}>
            <Ionicons name="backspace" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tecla} onPress={() => pressionarTecla('0')}>
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tecla, styles.teclaEnviar]} onPress={() => pressionarTecla('enviar')}>
            <Ionicons name="checkmark" size={20} color="#000" />
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
                <Text style={styles.pausaVolumeText}>{Math.round(musicaVolume * 100)}%</Text>
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
  menuTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  volumeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 10, borderRadius: 10, marginBottom: 12 },
  volumeButton: { padding: 4 },
  volumeSlider: { flex: 1, height: 36, marginHorizontal: 8 },
  volumeText: { color: '#FFD700', fontSize: 11, width: 36 },
  recordesContainer: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  recordeCard: { flex: 1, backgroundColor: '#1a1a2e', padding: 12, borderRadius: 10, alignItems: 'center' },
  recordeLabel: { color: '#888', fontSize: 10, marginTop: 4 },
  recordeValor: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginTop: 2 },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  iniciarButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  multiSection: { backgroundColor: '#1a1a2e', padding: 14, borderRadius: 10, marginTop: 14 },
  multiTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  multiButton: { flexDirection: 'row', backgroundColor: '#4169E1', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  multiButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  joinRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  roomInput: { flex: 1, backgroundColor: '#0c0c0c', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 },
  joinButton: { backgroundColor: '#32CD32', padding: 10, borderRadius: 8, justifyContent: 'center' },
  salasButton: { alignItems: 'center', padding: 8 },
  salasButtonText: { color: '#FFD700', fontSize: 13 },
  instrucoes: { backgroundColor: '#1a1a2e', padding: 12, borderRadius: 10, marginTop: 14, marginBottom: 20 },
  instrucoesTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  instrucoesText: { color: '#888', fontSize: 12, marginBottom: 4 },
  
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
  statText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  rodadaText: { color: '#4169E1', fontSize: 14, fontWeight: 'bold' },
  powerUpIndicator: { backgroundColor: '#FFD700' + '30', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muteButton: { padding: 3 },
  voiceHeaderButton: { padding: 4 },
  voiceHeaderRecording: { backgroundColor: '#FF444430', borderRadius: 12 },
  multiScores: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 4 },
  multiScoreItem: { backgroundColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignItems: 'center', minWidth: 70 },
  multiScoreYou: { borderWidth: 1, borderColor: '#FFD700' },
  multiScoreName: { color: '#888', fontSize: 10 },
  multiScorePoints: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  multiScoreVidas: { flexDirection: 'row', gap: 2, marginTop: 2 },
  miniVida: { width: 5, height: 5, borderRadius: 3 },
  miniVidaAtiva: { backgroundColor: '#FF4444' },
  miniVidaInativa: { backgroundColor: '#333' },
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 4 },
  vidaMarca: { width: 6, height: 6, borderRadius: 3 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  gameArea: { flex: 1, position: 'relative', backgroundColor: '#0a0a0a' },
  operacaoCard: { position: 'absolute', backgroundColor: '#4169E1', paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, minWidth: CARD_WIDTH, maxWidth: CARD_WIDTH },
  operacaoEspecial: { backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFF' },
  estrelaEspecial: { position: 'absolute', top: 2, right: 2 },
  operacaoText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  laser: { position: 'absolute', width: 3, height: height },
  mensagemOverlay: { position: 'absolute', top: '28%', alignSelf: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 2, borderColor: '#FFD700' },
  mensagemText: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  displayContainer: { backgroundColor: '#1a1a2e', padding: 8, marginHorizontal: 12, marginVertical: 5, borderRadius: 8, alignItems: 'center' },
  displayText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  tecladoContainer: { paddingHorizontal: 8, paddingVertical: 4, paddingBottom: 8, gap: 4 },
  tecladoRow: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
  tecla: { backgroundColor: '#1a1a2e', width: 56, height: 42, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  // Resultado
  resultadoContainer: { flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 20 },
  winnerCard: { backgroundColor: '#FFD70020', padding: 20, borderRadius: 14, alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#FFD700' },
  winnerName: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  winnerPoints: { color: '#fff', fontSize: 16 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 20 },
  resultadoPontos: { fontSize: 52, fontWeight: 'bold', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  estatisticas: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  estatItem: { alignItems: 'center' },
  estatValor: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  estatLabel: { color: '#888', fontSize: 10, marginTop: 2 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, alignItems: 'center', gap: 8, marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 15, fontWeight: 'bold' },
  voltarMenuButton: { paddingHorizontal: 24, paddingVertical: 12 },
  voltarMenuText: { color: '#888', fontSize: 13 },
  
  // Pausa
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalPausaContainer: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, width: '86%', maxWidth: 320, alignItems: 'center' },
  modalPausaHeader: { alignItems: 'center', marginBottom: 12 },
  modalPausaTitulo: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  pausaVolumeContainer: { width: '100%', marginBottom: 12 },
  pausaVolumeLabel: { color: '#888', fontSize: 11, marginBottom: 6 },
  pausaVolumeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pausaVolumeSlider: { flex: 1, height: 32 },
  pausaVolumeText: { color: '#FFD700', fontSize: 11, width: 32 },
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
