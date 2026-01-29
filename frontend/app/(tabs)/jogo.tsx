import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

const { width, height } = Dimensions.get('window');

interface Operacao {
  id: string;
  num1: number;
  num2: number;
  operador: '+' | '-' | '×' | '÷';
  resposta: number;
  y: Animated.Value;
  speed: number;
}

interface PowerUp {
  id: string;
  tipo: 'eliminar' | 'congelar' | 'escudo';
  icone: string;
  nome: string;
}

const POWER_UPS: PowerUp[] = [
  { id: 'eliminar', tipo: 'eliminar', icone: 'close-circle', nome: 'Eliminar 1' },
  { id: 'congelar', tipo: 'congelar', icone: 'snow', nome: 'Congelar 2s' },
  { id: 'escudo', tipo: 'escudo', icone: 'shield', nome: 'Escudo' },
];

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
  const [congelado, setCongelado] = useState(false);
  const [temEscudo, setTemEscudo] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [tempoRespostas, setTempoRespostas] = useState<number[]>([]);
  
  // Power-ups
  const [powerUpsDisponiveis, setPowerUpsDisponiveis] = useState({
    eliminar: 2,
    congelar: 1,
    escudo: 1,
  });
  
  // Recordes
  const [recordeSingle, setRecordeSingle] = useState(0);
  const [recordeMulti, setRecordeMulti] = useState(0);
  
  const gameLoop = useRef<any>(null);
  const inputRef = useRef<TextInput>(null);
  const inicioResposta = useRef<number>(Date.now());

  useEffect(() => {
    carregarRecordes();
  }, []);

  useEffect(() => {
    if (tela === 'jogo') {
      iniciarJogo();
      return () => {
        if (gameLoop.current) {
          clearInterval(gameLoop.current);
        }
      };
    }
  }, [tela]);

  const carregarRecordes = async () => {
    try {
      const recordes = await api.getRecordesJogo();
      setRecordeSingle(recordes.singleplayer || 0);
      setRecordeMulti(recordes.multiplayer || 0);
    } catch (error) {
      console.log('Recordes ainda não existem');
    }
  };

  const gerarOperacao = (): Operacao => {
    const operadores: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];
    const operador = operadores[Math.floor(Math.random() * operadores.length)];
    
    let num1: number;
    let num2: number;
    let resposta: number;
    
    // Gerar números baseado na dificuldade
    const maxNum = Math.min(5 + dificuldade * 5, 100);
    
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
      speed: 0.5 + velocidade * 0.3,
    };
  };

  const iniciarJogo = () => {
    setVidas(10);
    setPontos(0);
    setRodada(1);
    setAcertos(0);
    setErros(0);
    setTempoRespostas([]);
    setDificuldade(1);
    setVelocidade(1);
    setPowerUpsDisponiveis({ eliminar: 2, congelar: 1, escudo: 1 });
    setTemEscudo(false);
    setCongelado(false);
    
    // Criar operações iniciais
    const ops = Array.from({ length: 3 }, () => gerarOperacao());
    setOperacoes(ops);
    
    // Animar operações
    ops.forEach((op) => {
      Animated.timing(op.y, {
        toValue: height,
        duration: 8000 / op.speed,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          // Operação saiu da tela sem resposta
          perderVida(op.id);
        }
      });
    });
    
    // Loop para adicionar novas operações
    gameLoop.current = setInterval(() => {
      if (!congelado) {
        setOperacoes((ops) => {
          if (ops.length < 5) {
            const novaOp = gerarOperacao();
            Animated.timing(novaOp.y, {
              toValue: height,
              duration: 8000 / novaOp.speed,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) {
                perderVida(novaOp.id);
              }
            });
            return [...ops, novaOp];
          }
          return ops;
        });
      }
    }, 3000);
    
    inicioResposta.current = Date.now();
  };

  const verificarResposta = () => {
    const respostaNum = parseInt(resposta);
    if (isNaN(respostaNum)) return;
    
    const tempoResposta = Date.now() - inicioResposta.current;
    
    const operacaoCorreta = operacoes.find((op) => op.resposta === respostaNum);
    
    if (operacaoCorreta) {
      // ACERTOU!
      const bonus = tempoResposta < 3000 ? 20 : 10;
      setPontos((p) => p + 10 + bonus);
      setAcertos((a) => a + 1);
      setTempoRespostas((t) => [...t, tempoResposta]);
      
      // Remover operação
      setOperacoes((ops) => ops.filter((op) => op.id !== operacaoCorreta.id));
      
      // Feedback visual
      Alert.alert('✓', `+${10 + bonus} pontos!`, [{ text: 'OK' }], { cancelable: true });
    } else {
      // ERROU!
      setErros((e) => e + 1);
      if (temEscudo) {
        setTemEscudo(false);
        Alert.alert('🛡️', 'Escudo usado! Vida preservada.');
      } else {
        perderVida();
      }
    }
    
    setResposta('');
    inicioResposta.current = Date.now();
    inputRef.current?.focus();
  };

  const perderVida = (operacaoId?: string) => {
    if (temEscudo) {
      setTemEscudo(false);
      if (operacaoId) {
        setOperacoes((ops) => ops.filter((op) => op.id !== operacaoId));
      }
      return;
    }
    
    setVidas((v) => {
      const novasVidas = v - 1;
      if (novasVidas <= 0) {
        finalizarJogo();
      }
      return novasVidas;
    });
    setPontos((p) => Math.max(0, p - 5)); // Penalidade
    
    if (operacaoId) {
      setOperacoes((ops) => ops.filter((op) => op.id !== operacaoId));
    }
  };

  const usarPowerUp = (tipo: 'eliminar' | 'congelar' | 'escudo') => {
    if (powerUpsDisponiveis[tipo] <= 0) return;
    
    setPowerUpsDisponiveis((p) => ({ ...p, [tipo]: p[tipo] - 1 }));
    
    switch (tipo) {
      case 'eliminar':
        if (operacoes.length > 0) {
          const opRemover = operacoes[0];
          setOperacoes((ops) => ops.filter((op) => op.id !== opRemover.id));
          Alert.alert('💥', 'Uma operação foi eliminada!');
        }
        break;
      case 'congelar':
        setCongelado(true);
        setTimeout(() => setCongelado(false), 2000);
        Alert.alert('❄️', 'Congelado por 2 segundos!');
        break;
      case 'escudo':
        setTemEscudo(true);
        Alert.alert('🛡️', 'Escudo ativado! Próximo erro não conta.');
        break;
    }
  };

  const finalizarJogo = async () => {
    if (gameLoop.current) {
      clearInterval(gameLoop.current);
    }
    
    // Atualizar recorde
    let novoRecorde = false;
    if (modo === 'single' && pontos > recordeSingle) {
      setRecordeSingle(pontos);
      novoRecorde = true;
    } else if (modo === 'multi' && pontos > recordeMulti) {
      setRecordeMulti(pontos);
      novoRecorde = true;
    }
    
    // Salvar recorde no backend
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

  const ajustarDificuldade = () => {
    const taxaAcerto = acertos / (acertos + erros || 1);
    const tempoMedio = tempoRespostas.reduce((a, b) => a + b, 0) / (tempoRespostas.length || 1);
    
    if (modo === 'single') {
      // Singleplayer: ajuste adaptativo
      if (taxaAcerto > 0.8 && tempoMedio < 4000) {
        setDificuldade((d) => Math.min(d + 0.5, 10));
        setVelocidade((v) => Math.min(v + 0.2, 3));
      } else if (taxaAcerto < 0.5 || tempoMedio > 8000) {
        setDificuldade((d) => Math.max(d - 0.3, 1));
        setVelocidade((v) => Math.max(v - 0.1, 1));
      }
    } else {
      // Multiplayer: progressão fixa
      setDificuldade((d) => Math.min(d + 0.3, 10));
      setVelocidade((v) => Math.min(v + 0.15, 3));
    }
    
    setRodada((r) => r + 1);
    setAcertos(0);
    setErros(0);
    setTempoRespostas([]);
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

          <View style={styles.modoContainer}>
            <TouchableOpacity
              style={[styles.modoButton, modo === 'single' && styles.modoButtonActive]}
              onPress={() => setModo('single')}
            >
              <Ionicons name="person" size={32} color={modo === 'single' ? '#000' : '#fff'} />
              <Text style={[styles.modoText, modo === 'single' && { color: '#000' }]}>Solo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modoButton, styles.modoButtonDisabled]}
              disabled
            >
              <Ionicons name="people" size={32} color="#666" />
              <Text style={[styles.modoText, { color: '#666' }]}>Multiplayer</Text>
              <Text style={styles.emBreveText}>Em breve</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.iniciarButton}
            onPress={() => setTela('jogo')}
          >
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.iniciarButtonText}>Iniciar Jogo</Text>
          </TouchableOpacity>

          <View style={styles.instrucoes}>
            <Text style={styles.instrucoesTitle}>Como Jogar:</Text>
            <Text style={styles.instrucoesText}>• Resolva as operações que caem</Text>
            <Text style={styles.instrucoesText}>• Digite a resposta e confirme</Text>
            <Text style={styles.instrucoesText}>• Use power-ups para ajudar</Text>
            <Text style={styles.instrucoesText}>• Não deixe cair ou erre demais!</Text>
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
            <Ionicons name="heart" size={20} color="#FF4444" />
            <Text style={styles.statText}>{vidas}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.statText}>{pontos}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="layers" size={20} color="#4169E1" />
            <Text style={styles.statText}>R{rodada}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => {
          if (gameLoop.current) clearInterval(gameLoop.current);
          setTela('menu');
        }}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Área de jogo */}
      <View style={styles.gameArea}>
        {operacoes.map((op) => (
          <Animated.View
            key={op.id}
            style={[
              styles.operacaoCard,
              {
                transform: [{ translateY: op.y }],
                left: Math.random() * (width - 150),
              },
            ]}
          >
            <Text style={styles.operacaoText}>
              {op.num1} {op.operador} {op.num2} = ?
            </Text>
          </Animated.View>
        ))}
      </View>

      {/* Power-ups */}
      <View style={styles.powerUpsContainer}>
        {POWER_UPS.map((pu) => (
          <TouchableOpacity
            key={pu.id}
            style={[
              styles.powerUpButton,
              powerUpsDisponiveis[pu.tipo] <= 0 && styles.powerUpButtonDisabled,
            ]}
            onPress={() => usarPowerUp(pu.tipo)}
            disabled={powerUpsDisponiveis[pu.tipo] <= 0}
          >
            <Ionicons name={pu.icone as any} size={24} color="#fff" />
            <Text style={styles.powerUpCount}>{powerUpsDisponiveis[pu.tipo]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input de resposta */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={resposta}
          onChangeText={setResposta}
          keyboardType="numeric"
          placeholder="Digite a resposta"
          placeholderTextColor="#666"
          autoFocus
          onSubmitEditing={verificarResposta}
        />
        <TouchableOpacity style={styles.enviarButton} onPress={verificarResposta}>
          <Ionicons name="arrow-forward" size={24} color="#000" />
        </TouchableOpacity>
      </View>
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
  modoContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },
  modoButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modoButtonActive: {
    backgroundColor: '#FFD700',
  },
  modoButtonDisabled: {
    opacity: 0.5,
  },
  modoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emBreveText: {
    color: '#666',
    fontSize: 12,
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
  gameArea: {
    flex: 1,
    position: 'relative',
  },
  operacaoCard: {
    position: 'absolute',
    backgroundColor: '#4169E1',
    padding: 16,
    borderRadius: 12,
    minWidth: 150,
  },
  operacaoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  powerUpsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  powerUpButton: {
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 60,
  },
  powerUpButtonDisabled: {
    opacity: 0.3,
  },
  powerUpCount: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    borderRadius: 12,
    textAlign: 'center',
  },
  enviarButton: {
    backgroundColor: '#32CD32',
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
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
