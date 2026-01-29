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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import { useFocusEffect } from 'expo-router';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.5;
const MAX_OPERACOES = 5; // Aumentar para 5 operações simultâneas
const VELOCIDADE_BASE = 15000;
const SPAWN_INTERVAL = 2500; // Reduzir para 2.5 segundos (mais rápido)
const QUESTAO_ESPECIAL_CHANCE = 0.15;

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
}

export default function Jogo() {
  const { user } = useAuth();
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [modo, setModo] = useState<'single' | 'multi'>('single');
  
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [vidas, setVidas] = useState(10);
  const [vidasAnterior, setVidasAnterior] = useState(10);
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
  
  const gameLoop = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const spawnTimer = useRef<any>(null);
  const inicioResposta = useRef<number>(Date.now());
  const posXUsadas = useRef<number[]>([]);
  const assistenciaTimer = useRef<any>(null);
  const displayRef = useRef<any>(null);

  // Detectar quando o usuário sai da aba do jogo (troca de tab)
  useFocusEffect(
    useCallback(() => {
      // Quando a tela ganha foco - não faz nada especial
      return () => {
        // Quando a tela perde foco (usuário saiu da aba)
        // Só reseta se o jogo NÃO estiver pausado
        if (tela === 'jogo' && !pausado && !modalPausaVisivel) {
          // Resetar o jogo completamente
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
          posXUsadas.current = [];
          setTela('menu');
        }
      };
    }, [tela, pausado, modalPausaVisivel])
  );

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
    // Se o usuário saiu do app (foi para background) durante o jogo
    if (
      appStateRef.current === 'active' &&
      (nextAppState === 'background' || nextAppState === 'inactive') &&
      tela === 'jogo'
    ) {
      // Resetar o jogo completamente
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
      posXUsadas.current = [];
      
      // Voltar ao menu
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
    
    if (numRodada <= 10) {
      return metas[numRodada];
    }
    // Após rodada 10: aumenta 10 a cada rodada
    return 70 + (numRodada - 10) * 10;
  };

  const avancarRodada = () => {
    const novaRodada = rodada + 1;
    setRodada(novaRodada);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(novaRodada));
    
    // Aumentar dificuldade e velocidade
    setDificuldade((d) => Math.min(d + 0.5, 15));
    setVelocidade((v) => Math.min(v + 0.3, 5));
    
    mostrarMensagem(`🎉 Rodada ${novaRodada}! Meta: ${calcularMetaRodada(novaRodada)} acertos`, 2500);
  };

  const gerarPosicaoX = (): number => {
    const padding = 20;
    const cardWidth = 140;
    const maxPos = width - cardWidth - padding;
    const minEspacamento = cardWidth + 20; // Espaço mínimo entre operações
    let tentativas = 0;
    let posX: number;
    
    do {
      posX = padding + Math.random() * (maxPos - padding);
      tentativas++;
      
      // Se tentou muitas vezes, limpar histórico
      if (tentativas > 15) {
        posXUsadas.current = [];
        tentativas = 0;
      }
      
      // Verificar se tem espaço suficiente
      const temEspaco = !posXUsadas.current.some(usado => 
        Math.abs(usado - posX) < minEspacamento
      );
      
      if (temEspaco) break;
      
    } while (tentativas < 20);
    
    posXUsadas.current.push(posX);
    // Manter apenas últimas 8 posições
    if (posXUsadas.current.length > 8) {
      posXUsadas.current.shift();
    }
    
    return posX;
  };

  const gerarOperacao = (): Operacao => {
    const operadores: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];
    const operador = operadores[Math.floor(Math.random() * operadores.length)];
    const especial = Math.random() < QUESTAO_ESPECIAL_CHANCE;
    
    let num1: number, num2: number, resposta: number;
    const maxNum = Math.min(10 + dificuldade * 3, 50);
    
    switch (operador) {
      case '+':
        num1 = Math.floor(Math.random() * maxNum) + 1;
        num2 = Math.floor(Math.random() * maxNum) + 1;
        resposta = num1 + num2;
        break;
      case '-':
        num1 = Math.floor(Math.random() * maxNum) + 10;
        num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
        resposta = num1 - num2;
        break;
      case '×':
        num1 = Math.floor(Math.random() * Math.min(maxNum / 2, 12)) + 1;
        num2 = Math.floor(Math.random() * Math.min(maxNum / 2, 12)) + 1;
        resposta = num1 * num2;
        break;
      case '÷':
        num2 = Math.floor(Math.random() * Math.min(maxNum / 2, 12)) + 1;
        resposta = Math.floor(Math.random() * Math.min(maxNum / 2, 12)) + 1;
        num1 = num2 * resposta;
        break;
    }
    
    return {
      id: Math.random().toString(),
      num1, num2, operador, resposta,
      y: new Animated.Value(-100),
      speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
      posX: gerarPosicaoX(),
      especial,
      opacity: new Animated.Value(1),
      scale: new Animated.Value(1),
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
    posXUsadas.current = [];
    
    // Iniciar com 3 operações simultâneas
    const operacoesIniciais = Array.from({ length: 3 }, () => gerarOperacao());
    setOperacoes(operacoesIniciais);
    operacoesIniciais.forEach(op => animarQueda(op));
    
    // Loop de spawn
    spawnTimer.current = setInterval(() => {
      setOperacoes((ops) => {
        if (ops.length < MAX_OPERACOES) {
          const novaOp = gerarOperacao();
          animarQueda(novaOp);
          return [...ops, novaOp];
        }
        return ops;
      });
    }, SPAWN_INTERVAL);
    
    inicioResposta.current = Date.now();
    mostrarMensagem('🎮 Rodada 1! Meta: 10 acertos', 2000);
  };

  const animarQueda = (op: Operacao) => {
    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 100,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) perderVida(op.id);
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
      const targetX = targetOp.posX + 70;
      const targetY = (targetOp.y as any)._value || 100;
      
      setLaserAtivo({ x: targetX, y: targetY, cor: '#32CD32', targetId: targetOp.id });
      
      laserAnim.setValue(0);
      Animated.timing(laserAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Explodir operação
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
      // Laser vermelho que erra
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
      
      // Shake no display
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
      // ACERTOU!
      operacaoCorreta.y.stopAnimation();
      
      const bonus = tempoResposta < 3000 ? 20 : 0;
      setPontos((p) => p + 10 + bonus);
      setAcertos((a) => a + 1);
      setAcertosRodada((a) => {
        const novosAcertos = a + 1;
        // Verificar se completou a rodada
        if (novosAcertos >= metaRodada) {
          avancarRodada();
        }
        return novosAcertos;
      });
      setErrosConsecutivos(0);
      setTempoRespostas((t) => [...t, tempoResposta]);
      
      // Laser verde
      dispararLaser(operacaoCorreta, true);
      
      // Ganhar power-up
      if (operacaoCorreta.especial && !powerUpDisponivel) {
        setPowerUpDisponivel(true);
        setPowerUpTipo('eliminar');
        mostrarMensagem('⭐ Power-up obtido: Eliminar Operação!');
      }
      
      // Remover após animação
      setTimeout(() => {
        setOperacoes((ops) => ops.filter((op) => op.id !== operacaoCorreta.id));
      }, 600);
    } else {
      // ERROU!
      setErros((e) => e + 1);
      setErrosConsecutivos((e) => e + 1);
      setVidas((v) => {
        const novasVidas = v - 1;
        if (novasVidas <= 0) finalizarJogo();
        return novasVidas;
      });
      setPontos((p) => Math.max(0, p - 5));
      
      // Laser vermelho
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
    
    // Filtrar apenas operações visíveis na tela
    const operacoesVisiveis = operacoes.filter(op => {
      const yValue = (op.y as any)._value || 0;
      return yValue >= 0 && yValue < GAME_AREA_HEIGHT;
    });
    
    if (operacoesVisiveis.length === 0) return;
    
    // ELIMINAR TODAS AS OPERAÇÕES VISÍVEIS
    operacoesVisiveis.forEach(op => {
      op.y.stopAnimation();
      
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
    
    // Remover todas após animação
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
    // Pausar todas as animações das operações
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
    
    // Reiniciar animações das operações existentes
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
    
    // Reiniciar spawn timer
    spawnTimer.current = setInterval(() => {
      setOperacoes((ops) => {
        if (ops.length < MAX_OPERACOES) {
          const novaOp = gerarOperacao();
          animarQueda(novaOp);
          return [...ops, novaOp];
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
    posXUsadas.current = [];
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
      setOperacoes((ops) => ops.filter((op) => op.id !== operacaoId));
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

  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Ionicons name="game-controller" size={64} color="#FFD700" />
            <Text style={styles.menuTitle}>Jogo de Matemática</Text>
            <Text style={styles.experimentalBadge}>🧪 EXPERIMENTAL</Text>
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
            <Ionicons name="star" size={18} color="#FFD700" />
            <Text style={styles.statText}>{pontos}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="trophy" size={18} color="#4169E1" />
            <Text style={styles.statText}>{acertosRodada}/{metaRodada}</Text>
          </View>
        </View>
        
        <Text style={styles.rodadaText}>R{rodada}</Text>
        
        {powerUpDisponivel && (
          <View style={styles.powerUpIndicator}>
            <Ionicons name="flash" size={14} color="#FFD700" />
            <Text style={styles.powerUpText}>⚡</Text>
          </View>
        )}
        
        <TouchableOpacity onPress={pausarJogo}>
          <Ionicons name="pause" size={24} color="#fff" />
        </TouchableOpacity>
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
              <Ionicons name="star" size={14} color="#FFD700" style={styles.estrelaEspecial} />
            )}
            <Text style={[styles.operacaoText, op.especial && { color: '#000' }]}>
              {op.num1} {op.operador} {op.num2} = ?
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
            <Ionicons name="backspace" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tecla} onPress={() => pressionarTecla('0')}>
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tecla, styles.teclaEnviar]}
            onPress={() => pressionarTecla('enviar')}
          >
            <Ionicons name="checkmark" size={24} color="#000" />
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
  menuHeader: { alignItems: 'center', marginTop: 20, marginBottom: 30 },
  menuTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 12 },
  experimentalBadge: { fontSize: 14, color: '#FFD700', marginTop: 8 },
  recordesContainer: { flexDirection: 'row', gap: 12, marginBottom: 30 },
  recordeCard: { flex: 1, backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, alignItems: 'center' },
  recordeLabel: { color: '#888', fontSize: 12, marginTop: 8 },
  recordeValor: { color: '#FFD700', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  instrucoes: { marginTop: 30, backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12 },
  instrucoesTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  instrucoesText: { color: '#888', fontSize: 14, marginBottom: 6 },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  gameStats: { flexDirection: 'row', gap: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  rodadaText: { color: '#4169E1', fontSize: 18, fontWeight: 'bold' },
  powerUpIndicator: { backgroundColor: '#FFD700' + '30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  powerUpText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 6 },
  vidaMarca: { width: 8, height: 8, borderRadius: 4 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  gameArea: { flex: 1, position: 'relative', backgroundColor: '#0a0a0a' },
  operacaoCard: { position: 'absolute', backgroundColor: '#4169E1', padding: 12, borderRadius: 12, minWidth: 140 },
  operacaoEspecial: { backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFF' },
  estrelaEspecial: { position: 'absolute', top: 4, right: 4 },
  operacaoText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  laser: { position: 'absolute', width: 4, height: height, shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
  mensagemOverlay: { position: 'absolute', top: '30%', alignSelf: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#FFD700' },
  mensagemText: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  displayContainer: { backgroundColor: '#1a1a2e', padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 12, alignItems: 'center' },
  displayText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  tecladoContainer: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 12, gap: 6 },
  tecladoRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  tecla: { backgroundColor: '#1a1a2e', width: 64, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  hiddenInput: { position: 'absolute', left: -9999, opacity: 0, height: 0 },
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 30 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 40, borderRadius: 20, alignItems: 'center', marginBottom: 30 },
  resultadoPontos: { fontSize: 64, fontWeight: 'bold', color: '#FFD700' },
  resultadoLabel: { fontSize: 18, color: '#888', marginTop: 8 },
  estatisticas: { flexDirection: 'row', gap: 20, marginBottom: 40 },
  estatItem: { alignItems: 'center' },
  estatValor: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  estatLabel: { color: '#888', fontSize: 12, marginTop: 4 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, alignItems: 'center', gap: 8, marginBottom: 12 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  voltarMenuButton: { paddingHorizontal: 32, paddingVertical: 16 },
  voltarMenuText: { color: '#888', fontSize: 16 },
  // Modal de Pausa
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalPausaContainer: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, width: '85%', maxWidth: 360, alignItems: 'center' },
  modalPausaHeader: { alignItems: 'center', marginBottom: 20 },
  modalPausaTitulo: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 12 },
  modalPausaStats: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, paddingVertical: 16, paddingHorizontal: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, width: '100%' },
  pausaStatItem: { alignItems: 'center', flex: 1 },
  pausaStatValor: { fontSize: 24, fontWeight: 'bold', color: '#FFD700' },
  pausaStatLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  pausaStatDivider: { width: 1, height: 40, backgroundColor: '#333' },
  modalPausaBotoes: { width: '100%', gap: 12 },
  continuarButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  continuarButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  sairButton: { flexDirection: 'row', backgroundColor: '#E74C3C', paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  sairButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  pausaAviso: { marginTop: 16, fontSize: 12, color: '#FFD700', textAlign: 'center', fontStyle: 'italic' },
});
