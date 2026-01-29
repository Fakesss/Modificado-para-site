import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.55;
const MAX_OPERACOES = 3;
const VELOCIDADE_BASE = 15000; // 15 segundos para cair
const SPAWN_INTERVAL = 4000; // 4 segundos entre spawns
const QUESTAO_ESPECIAL_CHANCE = 0.15; // 15% de chance

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
}

export default function Jogo() {
  const { user } = useAuth();
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [modo, setModo] = useState<'single' | 'multi'>('single');
  
  // Estado do jogo
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [vidas, setVidas] = useState(10);
  const [pontos, setPontos] = useState(0);
  const [rodada, setRodada] = useState(1);
  const [resposta, setResposta] = useState('');
  const [dificuldade, setDificuldade] = useState(1);
  const [velocidade, setVelocidade] = useState(1);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [errosConsecutivos, setErrosConsecutivos] = useState(0);
  const [tempoRespostas, setTempoRespostas] = useState<number[]>([]);
  const [pausado, setPausado] = useState(false);
  
  // Power-up único
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [powerUpTipo, setPowerUpTipo] = useState<'eliminar' | null>(null);
  
  // Recordes
  const [recordeSingle, setRecordeSingle] = useState(0);
  const [recordeMulti, setRecordeMulti] = useState(0);
  
  // Refs
  const gameLoop = useRef<any>(null);
  const spawnTimer = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const inicioResposta = useRef<number>(Date.now());
  const posXUsadas = useRef<number[]>([]);
  const assistenciaTimer = useRef<any>(null);

  useEffect(() => {
    carregarRecordes();
  }, []);

  useEffect(() => {
    if (tela === 'jogo' && !pausado) {
      iniciarJogo();
      return () => {
        limparTimers();
      };
    }
  }, [tela, pausado]);

  useEffect(() => {
    if (tela === 'jogo' && !pausado) {
      inputRef.current?.focus();
      iniciarAssistenciaInteligente();
    }
    return () => {
      if (assistenciaTimer.current) {
        clearInterval(assistenciaTimer.current);
      }
    };
  }, [tela, pausado, operacoes, errosConsecutivos]);

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

  const gerarPosicaoX = (): number => {
    const padding = 20;
    const cardWidth = 150;
    const maxPos = width - cardWidth - padding;
    let tentativas = 0;
    let posX: number;
    
    do {
      posX = padding + Math.random() * (maxPos - padding);
      tentativas++;
      if (tentativas > 10) break; // Evitar loop infinito
    } while (posXUsadas.current.some(usado => Math.abs(usado - posX) < cardWidth + 10));
    
    posXUsadas.current.push(posX);
    if (posXUsadas.current.length > 5) {
      posXUsadas.current.shift();
    }
    
    return posX;
  };

  const gerarOperacao = (): Operacao => {
    const operadores: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];
    const operador = operadores[Math.floor(Math.random() * operadores.length)];
    const especial = Math.random() < QUESTAO_ESPECIAL_CHANCE;
    
    let num1: number;
    let num2: number;
    let resposta: number;
    
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
      num1,
      num2,
      operador,
      resposta,
      y: new Animated.Value(-100),
      speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
      posX: gerarPosicaoX(),
      especial,
    };
  };

  const iniciarJogo = () => {
    if (operacoes.length > 0) return; // Já iniciado
    
    setVidas(10);
    setPontos(0);
    setRodada(1);
    setAcertos(0);
    setErros(0);
    setErrosConsecutivos(0);
    setTempoRespostas([]);
    setDificuldade(1);
    setVelocidade(1);
    setPowerUpDisponivel(false);
    setPowerUpTipo(null);
    posXUsadas.current = [];
    
    // Spawnar primeira operação
    const primeiraOp = gerarOperacao();
    setOperacoes([primeiraOp]);
    animarQueda(primeiraOp);
    
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
  };

  const animarQueda = (op: Operacao) => {
    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 100,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        perderVida(op.id);
      }
    });
  };

  const iniciarAssistenciaInteligente = () => {
    if (assistenciaTimer.current) clearInterval(assistenciaTimer.current);
    
    assistenciaTimer.current = setInterval(() => {
      // Verificar se precisa usar power-up automaticamente
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
    if (!powerUpDisponivel || !powerUpTipo) return;
    
    if (powerUpTipo === 'eliminar' && operacoes.length > 0) {
      // Eliminar a operação mais próxima do fim (maior y)
      const opMaisProxima = operacoes.reduce((prev, curr) => {
        const prevY = (prev.y as any)._value || 0;
        const currY = (curr.y as any)._value || 0;
        return currY > prevY ? curr : prev;
      });
      
      setOperacoes((ops) => ops.filter((op) => op.id !== opMaisProxima.id));
      setPowerUpDisponivel(false);
      setPowerUpTipo(null);
      
      Alert.alert('💥 Power-Up!', 'Uma operação foi eliminada automaticamente!');
    }
  };

  const verificarResposta = () => {
    const respostaNum = parseInt(resposta);
    if (isNaN(respostaNum) || resposta === '') return;
    
    const tempoResposta = Date.now() - inicioResposta.current;
    const operacaoCorreta = operacoes.find((op) => op.resposta === respostaNum);
    
    if (operacaoCorreta) {
      // ACERTOU! - PARAR A ANIMAÇÃO
      operacaoCorreta.y.stopAnimation();
      
      const bonus = tempoResposta < 3000 ? 20 : 0;
      setPontos((p) => p + 10 + bonus);
      setAcertos((a) => a + 1);
      setErrosConsecutivos(0);
      setTempoRespostas((t) => [...t, tempoResposta]);
      
      // Ganhar power-up se for questão especial
      if (operacaoCorreta.especial && !powerUpDisponivel) {
        setPowerUpDisponivel(true);
        setPowerUpTipo('eliminar');
        Alert.alert('⭐ Questão Especial!', 'Power-up obtido! Será usado automaticamente quando necessário.');
      }
      
      // Remover operação da lista
      setOperacoes((ops) => ops.filter((op) => op.id !== operacaoCorreta.id));
    } else {
      // ERROU! - Perde vida
      setErros((e) => e + 1);
      setErrosConsecutivos((e) => e + 1);
      setVidas((v) => {
        const novasVidas = v - 1;
        if (novasVidas <= 0) {
          finalizarJogo();
        }
        return novasVidas;
      });
      setPontos((p) => Math.max(0, p - 5));
    }
    
    setResposta('');
    inicioResposta.current = Date.now();
    inputRef.current?.focus();
  };

  const perderVida = (operacaoId?: string) => {
    setVidas((v) => {
      const novasVidas = v - 1;
      if (novasVidas <= 0) {
        finalizarJogo();
      }
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
    } else if (modo === 'multi' && pontos > recordeMulti) {
      setRecordeMulti(pontos);
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

          <TouchableOpacity
            style={styles.iniciarButton}
            onPress={() => setTela('jogo')}
          >
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.iniciarButtonText}>Iniciar Jogo Solo</Text>
          </TouchableOpacity>

          <View style={styles.instrucoes}>
            <Text style={styles.instrucoesTitle}>Como Jogar:</Text>
            <Text style={styles.instrucoesText}>• Resolva as operações que caem</Text>
            <Text style={styles.instrucoesText}>• Use o teclado na tela para responder</Text>
            <Text style={styles.instrucoesText}>• Questões especiais ⭐ dão power-ups</Text>
            <Text style={styles.instrucoesText}>• Power-ups são usados automaticamente</Text>
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

          <TouchableOpacity
            style={styles.voltarMenuButton}
            onPress={() => setTela('menu')}
          >
            <Text style={styles.voltarMenuText}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // TELA DE JOGO
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gameHeader}>
        <View style={styles.gameStats}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.statText}>{pontos}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="layers" size={20} color="#4169E1" />
            <Text style={styles.statText}>R{rodada}</Text>
          </View>
        </View>
        
        {/* Power-up indicator */}
        {powerUpDisponivel && (
          <View style={styles.powerUpIndicator}>
            <Ionicons name="flash" size={16} color="#FFD700" />
          </View>
        )}
        
        <TouchableOpacity onPress={() => {
          limparTimers();
          setTela('menu');
        }}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vidas - discreto */}
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
                transform: [{ translateY: op.y }],
                left: op.posX,
              },
            ]}
          >
            {op.especial && (
              <Ionicons name="star" size={16} color="#FFD700" style={styles.estrelaEspecial} />
            )}
            <Text style={styles.operacaoText}>
              {op.num1} {op.operador} {op.num2} = ?
            </Text>
          </Animated.View>
        ))}
      </View>

      {/* Display de resposta */}
      <View style={styles.displayContainer}>
        <Text style={styles.displayText}>{resposta || '0'}</Text>
      </View>

      {/* Teclado numérico */}
      <View style={styles.tecladoContainer}>
        <View style={styles.tecladoRow}>
          {['7', '8', '9'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.tecla}
              onPress={() => pressionarTecla(num)}
            >
              <Text style={styles.teclaText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tecladoRow}>
          {['4', '5', '6'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.tecla}
              onPress={() => pressionarTecla(num)}
            >
              <Text style={styles.teclaText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tecladoRow}>
          {['1', '2', '3'].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.tecla}
              onPress={() => pressionarTecla(num)}
            >
              <Text style={styles.teclaText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.tecladoRow}>
          <TouchableOpacity
            style={[styles.tecla, styles.teclaApagar]}
            onPress={() => pressionarTecla('apagar')}
          >
            <Ionicons name="backspace" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tecla}
            onPress={() => pressionarTecla('0')}
          >
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tecla, styles.teclaEnviar]}
            onPress={() => pressionarTecla('enviar')}
          >
            <Ionicons name="checkmark" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Input invisível para teclado físico */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={resposta}
        onChangeText={setResposta}
        keyboardType="numeric"
        autoFocus
        onSubmitEditing={verificarResposta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  menuContainer: {
    flex: 1,
    padding: 20,
  },
  menuHeader: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  experimentalBadge: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 8,
  },
  recordesContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  recordeCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordeLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  recordeValor: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  iniciarButton: {
    flexDirection: 'row',
    backgroundColor: '#32CD32',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iniciarButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  instrucoes: {
    marginTop: 30,
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
  },
  instrucoesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  instrucoesText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 6,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  gameStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  powerUpIndicator: {
    backgroundColor: '#FFD700' + '30',
    padding: 8,
    borderRadius: 8,
  },
  vidasContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  vidaMarca: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vidaAtiva: {
    backgroundColor: '#FF4444',
  },
  vidaInativa: {
    backgroundColor: '#333',
  },
  gameArea: {
    position: 'relative',
    backgroundColor: '#0a0a0a',
  },
  operacaoCard: {
    position: 'absolute',
    backgroundColor: '#4169E1',
    padding: 16,
    borderRadius: 12,
    minWidth: 150,
  },
  operacaoEspecial: {
    backgroundColor: '#FFD700',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  estrelaEspecial: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  operacaoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  displayContainer: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  displayText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  tecladoContainer: {
    padding: 16,
    gap: 8,
  },
  tecladoRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  tecla: {
    backgroundColor: '#1a1a2e',
    width: 70,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teclaText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  teclaApagar: {
    backgroundColor: '#E74C3C',
  },
  teclaEnviar: {
    backgroundColor: '#32CD32',
  },
  hiddenInput: {
    position: 'absolute',
    left: -9999,
    opacity: 0,
  },
  resultadoContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultadoTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 30,
  },
  resultadoCard: {
    backgroundColor: '#1a1a2e',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  resultadoPontos: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  resultadoLabel: {
    fontSize: 18,
    color: '#888',
    marginTop: 8,
  },
  estatisticas: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 40,
  },
  estatItem: {
    alignItems: 'center',
  },
  estatValor: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  estatLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  jogarNovamenteButton: {
    flexDirection: 'row',
    backgroundColor: '#32CD32',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  jogarNovamenteText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  voltarMenuButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  voltarMenuText: {
    color: '#888',
    fontSize: 16,
  },
});
