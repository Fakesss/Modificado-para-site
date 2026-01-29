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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import { useFocusEffect } from 'expo-router';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.5;
const MAX_OPERACOES = 5;
const VELOCIDADE_BASE = 15000;
const SPAWN_INTERVAL = 2500;
const QUESTAO_ESPECIAL_CHANCE = 0.15;
const CARD_WIDTH = 110; // Tamanho menor dos cards
const CARD_HEIGHT = 40;
const MIN_SPACING_X = CARD_WIDTH + 15;
const MIN_SPACING_Y = CARD_HEIGHT + 30;

// Chave para identificar questões (num1, operador, num2)
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

// ==================== MULTIPLAYER TYPES ====================
interface MultiplayerRoom {
  id: string;
  hostId: string;
  players: MultiplayerPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  currentRound: number;
  createdAt: number;
}

interface MultiplayerPlayer {
  id: string;
  nome: string;
  pontos: number;
  vidas: number;
  isReady: boolean;
  isConnected: boolean;
}

interface MultiplayerGameState {
  roomId: string | null;
  isHost: boolean;
  players: MultiplayerPlayer[];
  gameStatus: 'idle' | 'waiting' | 'countdown' | 'playing' | 'finished';
  syncedOperacoes: Operacao[];
  winner: MultiplayerPlayer | null;
}

// ==================== MAIN COMPONENT ====================
export default function Jogo() {
  const { user } = useAuth();
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [modo, setModo] = useState<'single' | 'multi'>('single');
  
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
  
  // Questões na rodada atual (para evitar repetição)
  const [questoesUsadasRodada, setQuestoesUsadasRodada] = useState<Set<string>>(new Set());
  const [questoesErradasRodada, setQuestoesErradasRodada] = useState<Set<string>>(new Set());
  
  // Feedback visual
  const [laserAtivo, setLaserAtivo] = useState<{ x: number; y: number; cor: string; targetId?: string } | null>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const laserAnim = useRef(new Animated.Value(0)).current;
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [powerUpTipo, setPowerUpTipo] = useState<'eliminar' | null>(null);
  const [recordeSingle, setRecordeSingle] = useState(0);
  const [recordeMulti, setRecordeMulti] = useState(0);
  const [modalPausaVisivel, setModalPausaVisivel] = useState(false);
  
  // ==================== MÚSICA ====================
  const [musicaVolume, setMusicaVolume] = useState(0.5);
  const [musicaMuted, setMusicaMuted] = useState(false);
  const [mostrarVolumeControl, setMostrarVolumeControl] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isFocusedRef = useRef(true);
  
  // ==================== MULTIPLAYER STATE ====================
  const [multiplayerState, setMultiplayerState] = useState<MultiplayerGameState>({
    roomId: null,
    isHost: false,
    players: [],
    gameStatus: 'idle',
    syncedOperacoes: [],
    winner: null,
  });
  
  const gameLoop = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const spawnTimer = useRef<any>(null);
  const inicioResposta = useRef<number>(Date.now());
  const operacoesAtuaisRef = useRef<{posX: number, y: number}[]>([]);
  const assistenciaTimer = useRef<any>(null);
  const displayRef = useRef<any>(null);
  const jogoEmAndamentoRef = useRef(false);
  const jogoPausadoRef = useRef(false);

  // Carregar volume salvo
  useEffect(() => {
    loadVolumeSettings();
  }, []);

  const loadVolumeSettings = async () => {
    try {
      const savedVolume = await AsyncStorage.getItem('musicVolume');
      if (savedVolume !== null) {
        setMusicaVolume(parseFloat(savedVolume));
      }
    } catch (e) {
      console.log('Erro ao carregar volume:', e);
    }
  };

  const saveVolumeSettings = async (volume: number) => {
    try {
      await AsyncStorage.setItem('musicVolume', volume.toString());
    } catch (e) {
      console.log('Erro ao salvar volume:', e);
    }
  };

  // Inicializar e gerenciar música
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (e) {
        console.log('Erro ao configurar áudio:', e);
      }
    };
    setupAudio();
    
    return () => {
      stopMusic();
    };
  }, []);

  // Tocar música quando na aba do jogo e com foco
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (tela !== 'resultado') {
        playMusic();
      }
      
      return () => {
        isFocusedRef.current = false;
        pauseMusic();
        
        // Reset do jogo se não estiver pausado
        if (jogoEmAndamentoRef.current && !jogoPausadoRef.current) {
          if (gameLoop.current) clearInterval(gameLoop.current);
          if (spawnTimer.current) clearInterval(spawnTimer.current);
          if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
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

      // Criar uma melodia simples usando tons senoidais
      const { sound } = await Audio.Sound.createAsync(
        // Usando um arquivo de áudio placeholder (tom de 440Hz)
        { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-01.mp3' },
        { 
          isLooping: true, 
          volume: musicaMuted ? 0 : musicaVolume,
          shouldPlay: true 
        }
      );
      soundRef.current = sound;
    } catch (e) {
      console.log('Erro ao tocar música:', e);
    }
  };

  const pauseMusic = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
      }
    } catch (e) {
      console.log('Erro ao pausar música:', e);
    }
  };

  const stopMusic = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (e) {
      console.log('Erro ao parar música:', e);
    }
  };

  const handleVolumeChange = async (value: number) => {
    setMusicaVolume(value);
    saveVolumeSettings(value);
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(musicaMuted ? 0 : value);
      } catch (e) {
        console.log('Erro ao mudar volume:', e);
      }
    }
  };

  const toggleMute = async () => {
    const newMuted = !musicaMuted;
    setMusicaMuted(newMuted);
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(newMuted ? 0 : musicaVolume);
      } catch (e) {
        console.log('Erro ao mutar:', e);
      }
    }
  };

  // Atualizar refs quando estados mudam
  useEffect(() => {
    jogoEmAndamentoRef.current = tela === 'jogo';
  }, [tela]);

  useEffect(() => {
    jogoPausadoRef.current = pausado || modalPausaVisivel;
  }, [pausado, modalPausaVisivel]);

  useEffect(() => {
    carregarRecordes();
  }, []);

  // Detectar quando o usuário sai da aba/app e resetar o jogo
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [tela]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current === 'active' &&
      (nextAppState === 'background' || nextAppState === 'inactive') &&
      tela === 'jogo'
    ) {
      pauseMusic();
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
    if (tela === 'jogo') {
      iniciarAssistenciaInteligente();
    }
    return () => {
      if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
    };
  }, [tela, operacoes, errosConsecutivos]);

  const limparTimers = () => {
    if (gameLoop.current) clearInterval(gameLoop.current);
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
  };

  const carregarRecordes = async () => {
    try {
      const recordes = await api.getRecordesJogo();
      setRecordeSingle(recordes.singleplayer || 0);
      setRecordeMulti(recordes.multiplayer || 0);
    } catch (error) {
      console.log('Recordes ainda não existem');
    }
  };

  const calcularMetaRodada = (numRodada: number): number => {
    const metas: { [key: number]: number } = {
      1: 10, 2: 12, 3: 15, 4: 20, 5: 25,
      6: 30, 7: 40, 8: 45, 9: 55, 10: 70
    };
    if (numRodada <= 10) return metas[numRodada];
    return 70 + (numRodada - 10) * 10;
  };

  const avancarRodada = () => {
    const novaRodada = rodada + 1;
    setRodada(novaRodada);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(novaRodada));
    setQuestoesUsadasRodada(new Set());
    setQuestoesErradasRodada(new Set());
    setDificuldade((d) => Math.min(d + 0.5, 15));
    setVelocidade((v) => Math.min(v + 0.3, 5));
    mostrarMensagem(`🎉 Rodada ${novaRodada}! Meta: ${calcularMetaRodada(novaRodada)} acertos`, 2500);
  };

  // Verificar colisão de posição X com operações existentes
  const verificarColisaoX = (novaPosX: number): boolean => {
    for (const op of operacoesAtuaisRef.current) {
      if (Math.abs(op.posX - novaPosX) < MIN_SPACING_X) {
        // Também verificar se estão próximas verticalmente
        if (op.y < MIN_SPACING_Y * 2) {
          return true;
        }
      }
    }
    return false;
  };

  const gerarPosicaoX = (): number => {
    const padding = 15;
    const maxPos = width - CARD_WIDTH - padding;
    let tentativas = 0;
    let posX: number;
    
    // Dividir tela em slots
    const numSlots = Math.floor((width - padding * 2) / MIN_SPACING_X);
    const slotWidth = (width - padding * 2) / numSlots;
    
    do {
      const slotIndex = Math.floor(Math.random() * numSlots);
      posX = padding + slotIndex * slotWidth + (slotWidth - CARD_WIDTH) / 2;
      tentativas++;
      
      if (tentativas > 20) {
        // Forçar uma posição válida
        for (let i = 0; i < numSlots; i++) {
          const testPosX = padding + i * slotWidth + (slotWidth - CARD_WIDTH) / 2;
          if (!verificarColisaoX(testPosX)) {
            return testPosX;
          }
        }
        break;
      }
    } while (verificarColisaoX(posX) && tentativas < 20);
    
    return posX;
  };

  // Gerar questão diversificada sem repetição na mesma rodada
  const gerarOperacao = (): Operacao | null => {
    const operadores: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];
    const especial = Math.random() < QUESTAO_ESPECIAL_CHANCE;
    
    let tentativas = 0;
    const maxTentativas = 50;
    
    while (tentativas < maxTentativas) {
      tentativas++;
      
      const operador = operadores[Math.floor(Math.random() * operadores.length)];
      let num1: number, num2: number, respostaNum: number;
      
      // Aumentar diversidade baseado na dificuldade
      const minNum = Math.max(1, Math.floor(dificuldade / 2));
      const maxNum = Math.min(10 + Math.floor(dificuldade * 4), 99);
      const maxMult = Math.min(2 + Math.floor(dificuldade), 15);
      
      switch (operador) {
        case '+':
          // Diversificar somas
          if (Math.random() > 0.5) {
            num1 = Math.floor(Math.random() * maxNum) + minNum;
            num2 = Math.floor(Math.random() * maxNum) + minNum;
          } else {
            // Números maiores para mais desafio
            num1 = Math.floor(Math.random() * (maxNum * 2)) + 10;
            num2 = Math.floor(Math.random() * 20) + 1;
          }
          respostaNum = num1 + num2;
          break;
          
        case '-':
          // Garantir subtração positiva
          num1 = Math.floor(Math.random() * maxNum) + minNum + 10;
          num2 = Math.floor(Math.random() * Math.min(num1 - 1, maxNum)) + 1;
          respostaNum = num1 - num2;
          break;
          
        case '×':
          // Tabuadas variadas
          num1 = Math.floor(Math.random() * maxMult) + 1;
          num2 = Math.floor(Math.random() * maxMult) + 1;
          // Evitar multiplicações triviais (x1 ou x0)
          if (num1 === 1) num1 = Math.floor(Math.random() * maxMult) + 2;
          if (num2 === 1) num2 = Math.floor(Math.random() * maxMult) + 2;
          respostaNum = num1 * num2;
          break;
          
        case '÷':
          // Divisões exatas variadas
          num2 = Math.floor(Math.random() * maxMult) + 2;
          respostaNum = Math.floor(Math.random() * maxMult) + 1;
          num1 = num2 * respostaNum;
          break;
          
        default:
          num1 = 1;
          num2 = 1;
          respostaNum = 2;
      }
      
      const chave = gerarChaveQuestao(num1, operador, num2);
      
      // Verificar se questão já foi usada nesta rodada
      if (questoesUsadasRodada.has(chave)) {
        // Permitir apenas se foi errada anteriormente
        if (!questoesErradasRodada.has(chave)) {
          continue;
        }
      }
      
      const posX = gerarPosicaoX();
      
      // Atualizar questões usadas
      setQuestoesUsadasRodada(prev => new Set(prev).add(chave));
      
      // Registrar posição para evitar colisão
      operacoesAtuaisRef.current.push({ posX, y: -100 });
      
      return {
        id: Math.random().toString(),
        num1, num2, operador, resposta: respostaNum,
        y: new Animated.Value(-100),
        speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
        posX,
        especial,
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
        chave,
      };
    }
    
    // Se não conseguiu gerar questão única, permitir repetição
    const operador = operadores[Math.floor(Math.random() * operadores.length)];
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const respostaNum = operador === '+' ? num1 + num2 : 
                       operador === '-' ? Math.max(num1, num2) - Math.min(num1, num2) :
                       operador === '×' ? num1 * num2 : 
                       Math.floor(num1 * num2 / num2);
    
    const posX = gerarPosicaoX();
    operacoesAtuaisRef.current.push({ posX, y: -100 });
    
    return {
      id: Math.random().toString(),
      num1: operador === '-' ? Math.max(num1, num2) : num1,
      num2: operador === '-' ? Math.min(num1, num2) : num2,
      operador,
      resposta: respostaNum,
      y: new Animated.Value(-100),
      speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
      posX,
      especial: false,
      opacity: new Animated.Value(1),
      scale: new Animated.Value(1),
      chave: gerarChaveQuestao(num1, operador, num2),
    };
  };

  const iniciarJogo = () => {
    if (operacoes.length > 0) return;
    
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
    setQuestoesUsadasRodada(new Set());
    setQuestoesErradasRodada(new Set());
    operacoesAtuaisRef.current = [];
    
    // Iniciar com 3 operações
    const operacoesIniciais: Operacao[] = [];
    for (let i = 0; i < 3; i++) {
      const op = gerarOperacao();
      if (op) operacoesIniciais.push(op);
    }
    setOperacoes(operacoesIniciais);
    operacoesIniciais.forEach(op => animarQueda(op));
    
    // Loop de spawn
    spawnTimer.current = setInterval(() => {
      setOperacoes((ops) => {
        if (ops.length < MAX_OPERACOES) {
          const novaOp = gerarOperacao();
          if (novaOp) {
            animarQueda(novaOp);
            return [...ops, novaOp];
          }
        }
        return ops;
      });
    }, SPAWN_INTERVAL);
    
    inicioResposta.current = Date.now();
    mostrarMensagem('🎮 Rodada 1! Meta: 10 acertos', 2000);
  };

  const animarQueda = (op: Operacao) => {
    // Atualizar posição Y no ref
    const updateYPosition = () => {
      const opRef = operacoesAtuaisRef.current.find(o => o.posX === op.posX);
      if (opRef) {
        op.y.addListener(({ value }) => {
          opRef.y = value;
        });
      }
    };
    updateYPosition();
    
    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 100,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // Marcar como errada quando cai
        setQuestoesErradasRodada(prev => new Set(prev).add(op.chave));
        perderVida(op.id);
      }
    });
  };

  const mostrarMensagem = (msg: string, duracao = 2000) => {
    setMensagemFeedback(msg);
    feedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(feedbackAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(duracao - 600),
      Animated.timing(feedbackAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setMensagemFeedback(null));
  };

  const dispararLaser = (targetOp: Operacao | null, acertou: boolean) => {
    const displayY = height - 300;
    const displayX = width / 2;
    
    if (acertou && targetOp) {
      const targetX = targetOp.posX + CARD_WIDTH / 2;
      const targetY = (targetOp.y as any)._value || 100;
      
      setLaserAtivo({ x: targetX, y: targetY, cor: '#32CD32', targetId: targetOp.id });
      
      laserAnim.setValue(0);
      Animated.timing(laserAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        Animated.parallel([
          Animated.timing(targetOp.scale, {
            toValue: 1.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(targetOp.opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setLaserAtivo(null);
        });
      });
    } else {
      const randomX = displayX + (Math.random() - 0.5) * 200;
      const randomY = Math.random() * GAME_AREA_HEIGHT * 0.5;
      
      setLaserAtivo({ x: randomX, y: randomY, cor: '#FF4444' });
      
      laserAnim.setValue(0);
      Animated.timing(laserAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setLaserAtivo(null);
      });
      
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  };

  const verificarResposta = () => {
    const respostaNum = parseInt(resposta);
    if (isNaN(respostaNum) || resposta === '') return;
    
    const tempoResposta = Date.now() - inicioResposta.current;
    const operacaoCorreta = operacoes.find((op) => op.resposta === respostaNum);
    
    if (operacaoCorreta) {
      operacaoCorreta.y.stopAnimation();
      
      // Remover do ref de posições
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(
        o => o.posX !== operacaoCorreta.posX
      );
      
      const bonus = tempoResposta < 3000 ? 20 : 0;
      setPontos((p) => p + 10 + bonus);
      setAcertos((a) => a + 1);
      setAcertosRodada((a) => {
        const novosAcertos = a + 1;
        if (novosAcertos >= metaRodada) {
          avancarRodada();
        }
        return novosAcertos;
      });
      setErrosConsecutivos(0);
      setTempoRespostas((t) => [...t, tempoResposta]);
      
      dispararLaser(operacaoCorreta, true);
      
      if (operacaoCorreta.especial && !powerUpDisponivel) {
        setPowerUpDisponivel(true);
        setPowerUpTipo('eliminar');
        mostrarMensagem('⭐ Power-up obtido: Eliminar Operação!');
      }
      
      setTimeout(() => {
        setOperacoes((ops) => ops.filter((op) => op.id !== operacaoCorreta.id));
      }, 600);
    } else {
      setErros((e) => e + 1);
      setErrosConsecutivos((e) => e + 1);
      setVidas((v) => {
        const novasVidas = v - 1;
        if (novasVidas <= 0) finalizarJogo();
        return novasVidas;
      });
      setPontos((p) => Math.max(0, p - 5));
      
      dispararLaser(null, false);
    }
    
    setResposta('');
    inicioResposta.current = Date.now();
  };

  const iniciarAssistenciaInteligente = () => {
    if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
    
    assistenciaTimer.current = setInterval(() => {
      if (powerUpDisponivel && powerUpTipo) {
        const tempoDecorrido = Date.now() - inicioResposta.current;
        const muitasOperacoes = operacoes.length >= MAX_OPERACOES;
        const demorando = tempoDecorrido > 8000;
        const errandoMuito = errosConsecutivos >= 2;
        
        if (muitasOperacoes || demorando || errandoMuito) {
          usarPowerUpAutomatico();
        }
      }
    }, 2000);
  };

  const usarPowerUpAutomatico = () => {
    if (!powerUpDisponivel || !powerUpTipo || operacoes.length === 0) return;
    
    const operacoesVisiveis = operacoes.filter(op => {
      const yValue = (op.y as any)._value || 0;
      return yValue >= 0 && yValue < GAME_AREA_HEIGHT;
    });
    
    if (operacoesVisiveis.length === 0) return;
    
    operacoesVisiveis.forEach(op => {
      op.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(
        o => o.posX !== op.posX
      );
      
      Animated.sequence([
        Animated.timing(op.scale, {
          toValue: 1.3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(op.opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
    
    setTimeout(() => {
      setOperacoes((ops) => 
        ops.filter((op) => !operacoesVisiveis.find(ov => ov.id === op.id))
      );
    }, 500);
    
    setPowerUpDisponivel(false);
    setPowerUpTipo(null);
    mostrarMensagem(`💥 Power-up: ${operacoesVisiveis.length} operações eliminadas!`, 1500);
  };

  const pausarJogo = () => {
    operacoes.forEach(op => {
      op.y.stopAnimation();
    });
    limparTimers();
    setPausado(true);
    setModalPausaVisivel(true);
  };

  const continuarJogo = () => {
    setPausado(false);
    setModalPausaVisivel(false);
    
    operacoes.forEach(op => {
      const currentY = (op.y as any)._value || 0;
      const remainingDistance = GAME_AREA_HEIGHT + 100 - currentY;
      const remainingTime = (remainingDistance / (GAME_AREA_HEIGHT + 200)) * op.speed;
      
      Animated.timing(op.y, {
        toValue: GAME_AREA_HEIGHT + 100,
        duration: remainingTime,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) perderVida(op.id);
      });
    });
    
    spawnTimer.current = setInterval(() => {
      setOperacoes((ops) => {
        if (ops.length < MAX_OPERACOES) {
          const novaOp = gerarOperacao();
          if (novaOp) {
            animarQueda(novaOp);
            return [...ops, novaOp];
          }
        }
        return ops;
      });
    }, SPAWN_INTERVAL);
    
    inicioResposta.current = Date.now();
  };

  const sairDoJogo = () => {
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
    setTela('menu');
  };

  const perderVida = (operacaoId?: string) => {
    setVidas((v) => {
      const novasVidas = v - 1;
      if (novasVidas <= 0) finalizarJogo();
      return novasVidas;
    });
    setPontos((p) => Math.max(0, p - 5));
    if (operacaoId) {
      setOperacoes((ops) => {
        const op = ops.find(o => o.id === operacaoId);
        if (op) {
          operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(
            o => o.posX !== op.posX
          );
        }
        return ops.filter((op) => op.id !== operacaoId);
      });
    }
  };

  const finalizarJogo = async () => {
    limparTimers();
    setOperacoes([]);
    
    let novoRecorde = false;
    if (modo === 'single' && pontos > recordeSingle) {
      setRecordeSingle(pontos);
      novoRecorde = true;
    }
    
    try {
      await api.salvarRecordeJogo(modo === 'single' ? 'singleplayer' : 'multiplayer', pontos);
    } catch (error) {
      console.error('Erro ao salvar recorde:', error);
    }
    
    setTela('resultado');
    if (novoRecorde) {
      Alert.alert('🏆 NOVO RECORDE!', `Você bateu seu recorde com ${pontos} pontos!`);
    }
  };

  const pressionarTecla = (tecla: string) => {
    if (tecla === 'enviar') {
      verificarResposta();
    } else if (tecla === 'apagar') {
      setResposta((r) => r.slice(0, -1));
    } else {
      setResposta((r) => r + tecla);
    }
  };

  // ==================== MULTIPLAYER FUNCTIONS ====================
  const createMultiplayerRoom = async (): Promise<string> => {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRoom: MultiplayerRoom = {
      id: roomId,
      hostId: user?.id || 'anonymous',
      players: [{
        id: user?.id || 'anonymous',
        nome: user?.nome || 'Jogador 1',
        pontos: 0,
        vidas: 10,
        isReady: false,
        isConnected: true,
      }],
      status: 'waiting',
      currentRound: 1,
      createdAt: Date.now(),
    };
    
    setMultiplayerState({
      roomId,
      isHost: true,
      players: newRoom.players,
      gameStatus: 'waiting',
      syncedOperacoes: [],
      winner: null,
    });
    
    return roomId;
  };

  const joinMultiplayerRoom = async (roomId: string): Promise<boolean> => {
    // Simular entrada na sala
    const newPlayer: MultiplayerPlayer = {
      id: user?.id || 'anonymous_' + Date.now(),
      nome: user?.nome || 'Jogador',
      pontos: 0,
      vidas: 10,
      isReady: false,
      isConnected: true,
    };
    
    setMultiplayerState(prev => ({
      ...prev,
      roomId,
      isHost: false,
      players: [...prev.players, newPlayer],
      gameStatus: 'waiting',
    }));
    
    return true;
  };

  const setPlayerReady = (ready: boolean) => {
    setMultiplayerState(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === (user?.id || 'anonymous') ? { ...p, isReady: ready } : p
      ),
    }));
  };

  const startMultiplayerGame = () => {
    if (!multiplayerState.isHost) return;
    
    const allReady = multiplayerState.players.every(p => p.isReady);
    if (!allReady) return;
    
    setMultiplayerState(prev => ({
      ...prev,
      gameStatus: 'countdown',
    }));
    
    // Countdown de 3 segundos
    setTimeout(() => {
      setMultiplayerState(prev => ({
        ...prev,
        gameStatus: 'playing',
      }));
      setModo('multi');
      setTela('jogo');
    }, 3000);
  };

  const syncMultiplayerScore = (playerId: string, newPontos: number, newVidas: number) => {
    setMultiplayerState(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === playerId ? { ...p, pontos: newPontos, vidas: newVidas } : p
      ),
    }));
  };

  const checkMultiplayerWinner = () => {
    const alivePlayers = multiplayerState.players.filter(p => p.vidas > 0);
    
    if (alivePlayers.length === 1) {
      setMultiplayerState(prev => ({
        ...prev,
        gameStatus: 'finished',
        winner: alivePlayers[0],
      }));
      return alivePlayers[0];
    }
    
    if (alivePlayers.length === 0) {
      // Empate - maior pontuação vence
      const winner = multiplayerState.players.reduce((max, p) => 
        p.pontos > max.pontos ? p : max
      );
      setMultiplayerState(prev => ({
        ...prev,
        gameStatus: 'finished',
        winner,
      }));
      return winner;
    }
    
    return null;
  };

  const leaveMultiplayerRoom = () => {
    setMultiplayerState({
      roomId: null,
      isHost: false,
      players: [],
      gameStatus: 'idle',
      syncedOperacoes: [],
      winner: null,
    });
    setModo('single');
  };

  // ==================== RENDER ====================
  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Ionicons name="game-controller" size={64} color="#FFD700" />
            <Text style={styles.menuTitle}>Jogo de Matemática</Text>
            <Text style={styles.experimentalBadge}>🧪 EXPERIMENTAL</Text>
          </View>

          {/* Controle de Volume */}
          <View style={styles.volumeContainer}>
            <TouchableOpacity onPress={toggleMute} style={styles.volumeButton}>
              <Ionicons 
                name={musicaMuted ? "volume-mute" : "volume-high"} 
                size={24} 
                color="#FFD700" 
              />
            </TouchableOpacity>
            <View style={styles.volumeSliderContainer}>
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                value={musicaVolume}
                onValueChange={handleVolumeChange}
                minimumTrackTintColor="#FFD700"
                maximumTrackTintColor="#333"
                thumbTintColor="#FFD700"
              />
              <Text style={styles.volumeText}>{Math.round(musicaVolume * 100)}%</Text>
            </View>
          </View>

          <View style={styles.recordesContainer}>
            <View style={styles.recordeCard}>
              <Ionicons name="person" size={24} color="#4169E1" />
              <Text style={styles.recordeLabel}>Recorde Solo</Text>
              <Text style={styles.recordeValor}>{recordeSingle} pts</Text>
            </View>
            <View style={styles.recordeCard}>
              <Ionicons name="people" size={24} color="#32CD32" />
              <Text style={styles.recordeLabel}>Recorde Multi</Text>
              <Text style={styles.recordeValor}>{recordeMulti} pts</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.iniciarButton} onPress={() => setTela('jogo')}>
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.iniciarButtonText}>Iniciar Jogo Solo</Text>
          </TouchableOpacity>

          <View style={styles.instrucoes}>
            <Text style={styles.instrucoesTitle}>Como Jogar:</Text>
            <Text style={styles.instrucoesText}>• Resolva as operações que caem</Text>
            <Text style={styles.instrucoesText}>• Use o teclado na tela</Text>
            <Text style={styles.instrucoesText}>• Questões especiais ⭐ dão power-ups</Text>
            <Text style={styles.instrucoesText}>• Power-ups ajudam automaticamente</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (tela === 'resultado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>Fim de Jogo!</Text>
          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{pontos}</Text>
            <Text style={styles.resultadoLabel}>Pontos</Text>
          </View>
          
          <View style={styles.estatisticas}>
            <View style={styles.estatItem}>
              <Ionicons name="checkmark-circle" size={24} color="#32CD32" />
              <Text style={styles.estatValor}>{acertos}</Text>
              <Text style={styles.estatLabel}>Acertos</Text>
            </View>
            <View style={styles.estatItem}>
              <Ionicons name="close-circle" size={24} color="#FF4444" />
              <Text style={styles.estatValor}>{erros}</Text>
              <Text style={styles.estatLabel}>Erros</Text>
            </View>
            <View style={styles.estatItem}>
              <Ionicons name="layers" size={24} color="#FFD700" />
              <Text style={styles.estatValor}>{rodada}</Text>
              <Text style={styles.estatLabel}>Rodadas</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.jogarNovamenteButton}
            onPress={() => {
              setTela('jogo');
              setOperacoes([]);
            }}
          >
            <Ionicons name="refresh" size={24} color="#000" />
            <Text style={styles.jogarNovamenteText}>Jogar Novamente</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.voltarMenuButton} onPress={() => setTela('menu')}>
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
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.statText}>{pontos}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trophy" size={16} color="#4169E1" />
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
            <Ionicons 
              name={musicaMuted ? "volume-mute" : "volume-high"} 
              size={18} 
              color="#888" 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={pausarJogo}>
            <Ionicons name="pause" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.vidasContainer}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.vidaMarca,
              i < vidas ? styles.vidaAtiva : styles.vidaInativa,
            ]}
          />
        ))}
      </View>

      {/* Área de jogo */}
      <View style={[styles.gameArea, { height: GAME_AREA_HEIGHT }]}>
        {operacoes.map((op) => (
          <Animated.View
            key={op.id}
            style={[
              styles.operacaoCard,
              op.especial && styles.operacaoEspecial,
              {
                transform: [
                  { translateY: op.y },
                  { scale: op.scale },
                ],
                left: op.posX,
                opacity: op.opacity,
              },
            ]}
          >
            {op.especial && (
              <Ionicons name="star" size={10} color="#FFD700" style={styles.estrelaEspecial} />
            )}
            <Text style={[styles.operacaoText, op.especial && { color: '#000' }]}>
              {op.num1} {op.operador} {op.num2}
            </Text>
          </Animated.View>
        ))}
        
        {/* Laser */}
        {laserAtivo && (
          <Animated.View
            style={[
              styles.laser,
              {
                opacity: laserAnim,
                transform: [
                  {
                    translateY: laserAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [height - 300, laserAtivo.y],
                    }),
                  },
                ],
                left: laserAtivo.x - 2,
                backgroundColor: laserAtivo.cor,
              },
            ]}
          />
        )}
      </View>

      {/* Mensagem de feedback */}
      {mensagemFeedback && (
        <Animated.View
          style={[
            styles.mensagemOverlay,
            {
              opacity: feedbackAnim,
              transform: [
                {
                  scale: feedbackAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.mensagemText}>{mensagemFeedback}</Text>
        </Animated.View>
      )}

      {/* Display de resposta */}
      <Animated.View
        ref={displayRef}
        style={[
          styles.displayContainer,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <Text style={styles.displayText}>{resposta || '0'}</Text>
      </Animated.View>

      {/* Teclado numérico */}
      <View style={styles.tecladoContainer}>
        <View style={styles.tecladoRow}>
          {['7', '8', '9'].map((num) => (
            <TouchableOpacity key={num} style={styles.tecla} onPress={() => pressionarTecla(num)}>
              <Text style={styles.teclaText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tecladoRow}>
          {['4', '5', '6'].map((num) => (
            <TouchableOpacity key={num} style={styles.tecla} onPress={() => pressionarTecla(num)}>
              <Text style={styles.teclaText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tecladoRow}>
          {['1', '2', '3'].map((num) => (
            <TouchableOpacity key={num} style={styles.tecla} onPress={() => pressionarTecla(num)}>
              <Text style={styles.teclaText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tecladoRow}>
          <TouchableOpacity
            style={[styles.tecla, styles.teclaApagar]}
            onPress={() => pressionarTecla('apagar')}
          >
            <Ionicons name="backspace" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tecla} onPress={() => pressionarTecla('0')}>
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tecla, styles.teclaEnviar]}
            onPress={() => pressionarTecla('enviar')}
          >
            <Ionicons name="checkmark" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Overlay de Pausa */}
      {modalPausaVisivel && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalPausaContainer}>
            <View style={styles.modalPausaHeader}>
              <Ionicons name="pause-circle" size={64} color="#FFD700" />
              <Text style={styles.modalPausaTitulo}>Jogo Pausado</Text>
            </View>
            
            {/* Controle de Volume na Pausa */}
            <View style={styles.pausaVolumeContainer}>
              <Text style={styles.pausaVolumeLabel}>Volume da Música</Text>
              <View style={styles.pausaVolumeRow}>
                <TouchableOpacity onPress={toggleMute}>
                  <Ionicons 
                    name={musicaMuted ? "volume-mute" : "volume-high"} 
                    size={24} 
                    color="#FFD700" 
                  />
                </TouchableOpacity>
                <Slider
                  style={styles.pausaVolumeSlider}
                  minimumValue={0}
                  maximumValue={1}
                  value={musicaVolume}
                  onValueChange={handleVolumeChange}
                  minimumTrackTintColor="#FFD700"
                  maximumTrackTintColor="#333"
                  thumbTintColor="#FFD700"
                />
                <Text style={styles.pausaVolumeText}>{Math.round(musicaVolume * 100)}%</Text>
              </View>
            </View>
            
            <View style={styles.modalPausaStats}>
              <View style={styles.pausaStatItem}>
                <Text style={styles.pausaStatValor}>{pontos}</Text>
                <Text style={styles.pausaStatLabel}>Pontos</Text>
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
              <TouchableOpacity 
                style={styles.continuarButton} 
                onPress={continuarJogo}
              >
                <Ionicons name="play" size={24} color="#000" />
                <Text style={styles.continuarButtonText}>Continuar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.sairButton} 
                onPress={sairDoJogo}
              >
                <Ionicons name="exit" size={24} color="#fff" />
                <Text style={styles.sairButtonText}>Sair do Jogo</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.pausaAviso}>
              ⚠️ Se você sair da aba, o jogo será reiniciado!
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  menuContainer: { flex: 1, padding: 20 },
  menuHeader: { alignItems: 'center', marginTop: 10, marginBottom: 15 },
  menuTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  experimentalBadge: { fontSize: 12, color: '#FFD700', marginTop: 6 },
  
  // Volume Controls
  volumeContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#1a1a2e', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 15 
  },
  volumeButton: { padding: 4 },
  volumeSliderContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  volumeSlider: { flex: 1, height: 40 },
  volumeText: { color: '#FFD700', fontSize: 12, width: 40, textAlign: 'right' },
  
  recordesContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  recordeCard: { flex: 1, backgroundColor: '#1a1a2e', padding: 14, borderRadius: 12, alignItems: 'center' },
  recordeLabel: { color: '#888', fontSize: 11, marginTop: 6 },
  recordeValor: { color: '#FFD700', fontSize: 22, fontWeight: 'bold', marginTop: 3 },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  iniciarButtonText: { color: '#000', fontSize: 17, fontWeight: 'bold' },
  instrucoes: { marginTop: 20, backgroundColor: '#1a1a2e', padding: 14, borderRadius: 12 },
  instrucoesTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  instrucoesText: { color: '#888', fontSize: 13, marginBottom: 5 },
  
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 3 },
  gameStats: { flexDirection: 'row', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  rodadaText: { color: '#4169E1', fontSize: 16, fontWeight: 'bold' },
  powerUpIndicator: { backgroundColor: '#FFD700' + '30', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  muteButton: { padding: 4 },
  
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 5 },
  vidaMarca: { width: 7, height: 7, borderRadius: 4 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  gameArea: { flex: 1, position: 'relative', backgroundColor: '#0a0a0a' },
  
  // Cards menores
  operacaoCard: { 
    position: 'absolute', 
    backgroundColor: '#4169E1', 
    paddingVertical: 8, 
    paddingHorizontal: 10, 
    borderRadius: 10, 
    minWidth: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
  },
  operacaoEspecial: { backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFF' },
  estrelaEspecial: { position: 'absolute', top: 2, right: 2 },
  operacaoText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  
  laser: { position: 'absolute', width: 3, height: height, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8 },
  mensagemOverlay: { position: 'absolute', top: '30%', alignSelf: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: '#FFD700' },
  mensagemText: { color: '#fff', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  displayContainer: { backgroundColor: '#1a1a2e', padding: 10, marginHorizontal: 14, marginVertical: 6, borderRadius: 10, alignItems: 'center' },
  displayText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  tecladoContainer: { paddingHorizontal: 10, paddingVertical: 6, paddingBottom: 10, gap: 5 },
  tecladoRow: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  tecla: { backgroundColor: '#1a1a2e', width: 60, height: 46, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 30, fontWeight: 'bold', color: '#fff', marginBottom: 25 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 35, borderRadius: 18, alignItems: 'center', marginBottom: 25 },
  resultadoPontos: { fontSize: 58, fontWeight: 'bold', color: '#FFD700' },
  resultadoLabel: { fontSize: 16, color: '#888', marginTop: 6 },
  estatisticas: { flexDirection: 'row', gap: 18, marginBottom: 35 },
  estatItem: { alignItems: 'center' },
  estatValor: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 6 },
  estatLabel: { color: '#888', fontSize: 11, marginTop: 3 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 10, alignItems: 'center', gap: 8, marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  voltarMenuButton: { paddingHorizontal: 28, paddingVertical: 14 },
  voltarMenuText: { color: '#888', fontSize: 14 },
  
  // Modal de Pausa
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalPausaContainer: { backgroundColor: '#1a1a2e', borderRadius: 18, padding: 20, width: '88%', maxWidth: 340, alignItems: 'center' },
  modalPausaHeader: { alignItems: 'center', marginBottom: 15 },
  modalPausaTitulo: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 10 },
  
  // Volume na Pausa
  pausaVolumeContainer: { width: '100%', marginBottom: 15 },
  pausaVolumeLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  pausaVolumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pausaVolumeSlider: { flex: 1, height: 36 },
  pausaVolumeText: { color: '#FFD700', fontSize: 12, width: 36 },
  
  modalPausaStats: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 18, paddingVertical: 14, paddingHorizontal: 10, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 10, width: '100%' },
  pausaStatItem: { alignItems: 'center', flex: 1 },
  pausaStatValor: { fontSize: 22, fontWeight: 'bold', color: '#FFD700' },
  pausaStatLabel: { fontSize: 11, color: '#888', marginTop: 3 },
  pausaStatDivider: { width: 1, height: 36, backgroundColor: '#333' },
  modalPausaBotoes: { width: '100%', gap: 10 },
  continuarButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  continuarButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  sairButton: { flexDirection: 'row', backgroundColor: '#E74C3C', paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sairButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  pausaAviso: { marginTop: 14, fontSize: 11, color: '#FFD700', textAlign: 'center', fontStyle: 'italic' },
});
