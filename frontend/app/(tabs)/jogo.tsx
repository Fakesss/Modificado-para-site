import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

const { width, height } = Dimensions.get('window');
// Aumentamos a área de jogo para 60% da tela dinamicamente
const INITIAL_GAME_AREA_HEIGHT = height * 0.60; 
const CARD_WIDTH = 105;
const NUM_LANES = 3; 
const LANE_WIDTH = width / NUM_LANES;

export default function Jogo() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === 'ADMIN';

  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [modo, setModo] = useState<'single' | 'bot'>('single');
  const [modoMatematica, setModoMatematica] = useState('misto');
  
  // Game state
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [vidas, setVidas] = useState(10);
  const [pontos, setPontos] = useState(0);
  const [rodada, setRodada] = useState(1);
  const [acertosRodada, setAcertosRodada] = useState(0);
  const [metaRodada, setMetaRodada] = useState(10);
  const [resposta, setResposta] = useState('');
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [gameAreaHeight, setGameAreaHeight] = useState(INITIAL_GAME_AREA_HEIGHT);
  
  // Bot State (Multiplayer Prototype)
  const [botPontos, setBotPontos] = useState(0);
  const [laserAtivo, setLaserAtivo] = useState<{ x: number; y: number; cor: string } | null>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Refs de Lógica e IA (Inteligência Invisível)
  const spawnTimer = useRef<any>(null);
  const botTimer = useRef<any>(null);
  const operacoesAtuaisRef = useRef<{lane: number, y: number, chave: string}[]>([]);
  const operacoesListRef = useRef<any[]>([]); 
  const rodadaRef = useRef(1);
  const congeladoRef = useRef(false);
  const jogoPausadoRef = useRef(false);
  
  // 🧠 VARIÁVEIS DA IA DE DIFICULDADE DINÂMICA
  const desempenhoOcultoRef = useRef(0); // Varia de 0 (sofrendo) a 10 (voando)
  const questoesAcertadasRef = useRef<Set<string>>(new Set()); // Memória do Round
  const inicioRespostaRef = useRef<number>(Date.now()); // Cronômetro de agilidade

  useEffect(() => { rodadaRef.current = rodada; }, [rodada]);
  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);

  // Limpa tudo ao sair ou reiniciar
  const resetGame = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (botTimer.current) clearInterval(botTimer.current);
    setOperacoes([]);
    setVidas(10);
    setPontos(0);
    setBotPontos(0);
    setRodada(1);
    setAcertosRodada(0);
    setMetaRodada(10);
    setPowerUpDisponivel(false);
    operacoesAtuaisRef.current = [];
    questoesAcertadasRef.current.clear();
    desempenhoOcultoRef.current = 0;
    congeladoRef.current = false;
  };

  const calcularMetaRodada = (r: number) => {
    return r <= 10 ? 10 + (r * 2) : 30 + (r * 5);
  };

  const avancarRodada = () => {
    const nr = rodada + 1;
    setRodada(nr);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(nr));
    questoesAcertadasRef.current.clear(); // Limpa a memória para o novo round
  };

  const obterPistaLivre = (): number => {
    const pistasDisponiveis = [0, 1, 2].filter(pista => {
      const opNaPista = operacoesAtuaisRef.current.find(op => op.lane === pista);
      return !opNaPista || opNaPista.y > gameAreaHeight * 0.2;
    });
    if (pistasDisponiveis.length === 0) return Math.floor(Math.random() * 3);
    return pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
  };

  // 🧠 CÉREBRO DA MATEMÁTICA E IA
  const gerarOperacao = () => {
    const currentRodada = rodadaRef.current;
    const desempenho = desempenhoOcultoRef.current; // Pega o nível de calor atual do jogador
    
    let opsPermitidas = ['+'];
    
    // A dificuldade evolui com a rodada E um pouco com o desempenho (se o cara for gênio, puxa números maiores)
    const bonusDesempenho = Math.floor(desempenho / 3); 
    let numMaximo = 10 + (currentRodada * 3) + bonusDesempenho; 
    let multMaximo = 3 + Math.floor(currentRodada / 2) + Math.floor(bonusDesempenho / 2); 

    if (modoMatematica === 'misto') {
      if (currentRodada >= 3) opsPermitidas.push('-');
      if (currentRodada >= 6) opsPermitidas.push('×');
      if (currentRodada >= 9) opsPermitidas.push('÷');
      if (currentRodada >= 12) opsPermitidas.push('^');
      if (currentRodada >= 15) opsPermitidas.push('√');
    } else {
      opsPermitidas = [modoMatematica === 'soma' ? '+' :
                       modoMatematica === 'subtracao' ? '-' :
                       modoMatematica === 'multiplicacao' ? '×' :
                       modoMatematica === 'divisao' ? '÷' :
                       modoMatematica === 'potenciacao' ? '^' : '√'];
      numMaximo = 10 + (currentRodada * 4);
      multMaximo = 3 + Math.floor(currentRodada / 2);
    }

    // Tenta gerar uma conta inédita (Até 50 tentativas para não travar o celular)
    for (let t = 0; t < 50; t++) {
      const op = opsPermitidas[Math.floor(Math.random() * opsPermitidas.length)];
      let n1=0, n2: number | string = 0, res=0, texto='';
      
      switch (op) {
        case '+':
          n1 = Math.floor(Math.random() * numMaximo) + 1;
          n2 = Math.floor(Math.random() * numMaximo) + 1;
          res = n1 + (n2 as number);
          texto = `${n1} + ${n2}`;
          break;
        case '-':
          n1 = Math.floor(Math.random() * (numMaximo * 1.5)) + 5;
          n2 = Math.floor(Math.random() * n1) + 1;
          res = n1 - (n2 as number);
          texto = `${n1} - ${n2}`;
          break;
        case '×':
          n1 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2;
          n2 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2;
          res = n1 * (n2 as number);
          texto = `${n1} × ${n2}`;
          break;
        case '÷':
          n2 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2;
          res = Math.floor(Math.random() * Math.min(multMaximo, 10)) + 1;
          n1 = (n2 as number) * res;
          texto = `${n1} ÷ ${n2}`;
          break;
        case '^': 
          n1 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2;
          n2 = 2;
          res = n1 * n1;
          texto = `${n1}²`;
          break;
        case '√':
          res = Math.floor(Math.random() * Math.min(multMaximo, 15)) + 2;
          n1 = res * res;
          n2 = '';
          texto = `√${n1}`;
          break;
        default:
          n1 = 1; n2 = 1; res = 2; texto = '1+1';
      }
      
      const chave = gerarChaveQuestao(n1, op, n2);
      
      // 🚨 ANTI-REPETIÇÃO: Já acertou neste round ou já está caindo na tela?
      const jaAcertou = questoesAcertadasRef.current.has(chave);
      const estaNaTela = operacoesAtuaisRef.current.some(o => o.chave === chave);
      
      if (jaAcertou || estaNaTela) continue; // Descarta e tenta gerar outra
      
      const isEspecial = Math.random() < 0.15;
      const laneSelecionada = obterPistaLivre();
      const posX = (laneSelecionada * LANE_WIDTH) + (LANE_WIDTH - CARD_WIDTH) / 2;
      
      operacoesAtuaisRef.current.push({ lane: laneSelecionada, y: -100, chave });
      
      // Cálculo dinâmico da velocidade de queda (Fica mais rápido se o desempenho for alto)
      const tempoQueda = Math.max(4500, 15000 - (currentRodada * 500) - (desempenho * 400));

      return {
        id: Math.random().toString(),
        num1: n1, num2: n2, operador: op, resposta: res, textoTela: texto, chave: chave,
        y: new Animated.Value(-100),
        speed: tempoQueda,
        posX,
        lane: laneSelecionada,
        especial: isEspecial,
        opacity: new Animated.Value(1),
        scale: new Animated.Value(1),
      };
    }
    return null;
  };

  // Spawner Inteligente que se adapta em tempo real
  const iniciarSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);

    const loopSpawner = () => {
      if (!jogoPausadoRef.current && !congeladoRef.current) {
        setOperacoes(ops => {
          // Máximo de contas na tela cresce junto com a rodada e com o desempenho (se ele for rápido, enche a tela)
          const maxOps = Math.min(8, 3 + Math.floor(rodadaRef.current / 3) + Math.floor(desempenhoOcultoRef.current / 3));
          
          if (ops.length < maxOps) {
            const nova = gerarOperacao();
            if (nova) { 
              animarQueda(nova); 
              return [...ops, nova]; 
            }
          }
          return ops;
        });
      }
      
      // O intervalo de nascimento (spawn) diminui se ele estiver jogando muito bem
      const spawnInterval = Math.max(1200, 3500 - (rodadaRef.current * 150) - (desempenhoOcultoRef.current * 150));
      spawnTimer.current = setTimeout(loopSpawner, spawnInterval);
    };

    loopSpawner();
  };

  const iniciarJogo = (modoEscolhido: 'single' | 'bot') => {
    resetGame();
    setModo(modoEscolhido);
    setTela('jogo');
    inicioRespostaRef.current = Date.now();
    
    const inicial: any[] = [];
    for (let i = 0; i < 3; i++) {
      const op = gerarOperacao();
      if (op) inicial.push(op);
    }
    setOperacoes(inicial);
    inicial.forEach(op => animarQueda(op));
    
    iniciarSpawner();

    if (modoEscolhido === 'bot') {
      botTimer.current = setInterval(() => {
        const ops = operacoesListRef.current;
        const alvosValidos = ops.filter(o => {
          const yVal = (o.y as any)._value || 0;
          return yVal > (gameAreaHeight * 0.35); // Bot espera a conta descer 35% para atirar
        });

        if (alvosValidos.length > 0 && Math.random() > 0.3) { 
          const alvo = alvosValidos[0];
          alvo.y.stopAnimation();
          
          setOperacoes(curr => curr.filter(o => o.id !== alvo.id));
          operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== alvo.chave);
          
          setBotPontos(p => p + 10);
          dispararLaser(alvo, true, 'bot');
        }
      }, Math.max(2000, 5000 - (rodadaRef.current * 150))); 
    }
  };

  const animarQueda = (op: any) => {
    if (congeladoRef.current) return;
    
    op.y.addListener(({ value }: { value: number }) => {
      const ref = operacoesAtuaisRef.current.find(o => o.chave === op.chave);
      if (ref) ref.y = value;
    });
    
    Animated.timing(op.y, {
      toValue: gameAreaHeight + 50,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) perderVida(op.id, true); // True indica que caiu (erro passivo)
    });
  };

  const dispararLaser = (targetOp: any, acertou: boolean, atirador: 'player' | 'bot' = 'player') => {
    if (acertou && targetOp) {
      const tX = targetOp.posX + CARD_WIDTH / 2;
      const tY = (targetOp.y as any)._value || 100;
      const corLaser = atirador === 'bot' ? '#FF00FF' : '#32CD32'; 

      setLaserAtivo({ x: tX, y: tY, cor: corLaser });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        Animated.parallel([
          Animated.timing(targetOp.scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
          Animated.timing(targetOp.opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => setLaserAtivo(null));
      });
    } else {
      setLaserAtivo({ x: width / 2, y: gameAreaHeight * 0.2, cor: '#FF4444' });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start(() => setLaserAtivo(null));
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
    }
  };

  const verificarResposta = () => {
    if (congeladoRef.current) return;
    
    const resN = parseInt(resposta);
    if (isNaN(resN) || resposta === '') return;
    
    const opCorreta = operacoes.find(op => op.resposta === resN);
    const tempoLevado = Date.now() - inicioRespostaRef.current;
    
    if (opCorreta) {
      opCorreta.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opCorreta.chave);
      
      // 🧠 IA AVALIA O TEMPO (Aumenta o heat se for rápido)
      if (tempoLevado <= 3000) {
        desempenhoOcultoRef.current = Math.min(desempenhoOcultoRef.current + 1, 10);
      } else if (tempoLevado > 6000) {
        desempenhoOcultoRef.current = Math.max(desempenhoOcultoRef.current - 1, 0);
      }

      questoesAcertadasRef.current.add(opCorreta.chave); // Guarda no cofre para não repetir
      
      setPontos(p => p + 10 + (tempoLevado < 3000 ? 5 : 0)); // Bônus de agilidade real
      setAcertosRodada(a => {
        const na = a + 1;
        if (na >= metaRodada) avancarRodada();
        return na;
      });
      
      if (opCorreta.especial && !powerUpDisponivel) setPowerUpDisponivel(true);
      
      dispararLaser(opCorreta, true, 'player');
      setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id));
    } else {
      perderVida(undefined, false); // Falso indica erro ativo (teclado)
      dispararLaser(null, false, 'player');
    }
    
    setResposta('');
    inicioRespostaRef.current = Date.now();
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel || operacoes.length === 0 || congeladoRef.current) return;
    
    const visiveis = operacoes.filter(op => {
      const y = (op.y as any)._value || 0;
      return y >= 0 && y < gameAreaHeight;
    });
    if (visiveis.length === 0) return;
    
    visiveis.forEach(op => op.y.stopAnimation());
    
    setPontos(p => p + (visiveis.length * 10)); 
    setOperacoes([]);
    operacoesAtuaisRef.current = [];
    setPowerUpDisponivel(false);
  };

  const perderVida = (opId?: string, caiuNoChao: boolean = false) => {
    // 🧠 IA AVALIA O ERRO (Reduz brutalmente a dificuldade temporariamente para ajudar)
    desempenhoOcultoRef.current = Math.max(desempenhoOcultoRef.current - (caiuNoChao ? 2 : 1), 0);

    setVidas(v => {
      const nv = v - 1;
      if (nv <= 0) {
        if (spawnTimer.current) clearTimeout(spawnTimer.current);
        if (botTimer.current) clearInterval(botTimer.current);
        setOperacoes([]);
        setTela('resultado');
      }
      return nv;
    });

    if (opId) {
      setOperacoes(ops => {
        const op = ops.find(o => o.id === opId);
        if (op) operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== op.chave);
        return ops.filter(o => o.id !== opId);
      });
    }
  };

  const pressionarTecla = (tecla: string) => {
    if (congeladoRef.current) return;
    if (tecla === 'enviar') verificarResposta();
    else if (tecla === 'apagar') setResposta(r => r.slice(0, -1));
    else setResposta(r => r + tecla);
  };

  // ==================== TELA DE MENU ====================
  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuScrollContent}>
            <View style={styles.menuHeader}>
              <Ionicons name="game-controller" size={56} color="#FFD700" />
              <Text style={styles.menuTitle}>Matemática Turbo</Text>
              <Text style={styles.menuSubtitle}>Treinamento Adaptativo</Text>
            </View>

            <Text style={styles.sectionLabel}>1. Escolha a Matéria:</Text>
            <View style={styles.modosGrid}>
              {[
                { id: 'misto', name: 'Jornada (Misto)', color: '#FFD700' },
                { id: 'soma', name: 'Soma', color: '#32CD32' },
                { id: 'subtracao', name: 'Subtração', color: '#FF4444' },
                { id: 'multiplicacao', name: 'Multiplicação', color: '#4169E1' },
                { id: 'divisao', name: 'Divisão', color: '#9B59B6' },
                { id: 'potenciacao', name: 'Potências', color: '#FF8C00' },
                { id: 'radiciacao', name: 'Raízes', color: '#00CED1' },
              ].map(m => (
                <TouchableOpacity 
                  key={m.id} 
                  style={[styles.modoCardItem, modoMatematica === m.id && { borderColor: m.color, borderWidth: 2 }]}
                  onPress={() => setModoMatematica(m.id)}
                >
                  <Text style={styles.modoTextItem}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.iniciarButton} onPress={() => iniciarJogo('single')}>
              <Ionicons name="play" size={24} color="#000" />
              <Text style={styles.iniciarButtonText}>JOGAR SOLO</Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.botButton} onPress={() => iniciarJogo('bot')}>
                <Ionicons name="hardware-chip" size={22} color="#000" />
                <Text style={styles.botButtonText}>🤖 Testar Multiplayer vs BOT</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ==================== TELA DE RESULTADO ====================
  if (tela === 'resultado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{modo === 'bot' && botPontos > pontos ? '🤖 O Bot Venceu!' : 'Fim de Treino!'}</Text>
          
          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{pontos}</Text>
            <Text style={styles.resultadoLabel}>Seus Pontos (Rodada {rodada})</Text>
          </View>

          {modo === 'bot' && (
             <View style={[styles.resultadoCard, { backgroundColor: '#FF00FF20', padding: 20, marginBottom: 30 }]}>
               <Text style={[styles.resultadoPontos, { color: '#FF00FF', fontSize: 40 }]}>{botPontos}</Text>
               <Text style={styles.resultadoLabel}>Pontos do Bot</Text>
             </View>
          )}

          <TouchableOpacity style={styles.jogarNovamenteButton} onPress={() => iniciarJogo(modo)}>
            <Ionicons name="refresh" size={22} color="#000" />
            <Text style={styles.jogarNovamenteText}>Tentar Novamente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.voltarMenuButton} onPress={() => setTela('menu')}>
            <Text style={styles.voltarMenuText}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ==================== TELA DO JOGO ====================
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.gameHeader}>
        <View style={styles.placarContainer}>
          <View style={styles.gameStats}>
            <Ionicons name="person" size={16} color="#32CD32" />
            <Text style={[styles.statText, { color: '#32CD32' }]}>{pontos}</Text>
          </View>
          {modo === 'bot' && (
            <View style={styles.gameStats}>
              <Ionicons name="hardware-chip" size={16} color="#FF00FF" />
              <Text style={[styles.statText, { color: '#FF00FF' }]}>{botPontos}</Text>
            </View>
          )}
        </View>
        <View style={{alignItems: 'flex-end'}}>
          <Text style={styles.rodadaText}>Rodada {rodada}</Text>
          <Text style={styles.metaText}>{acertosRodada}/{metaRodada}</Text>
        </View>
      </View>

      <View style={styles.vidasContainer}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={[styles.vidaMarca, i < vidas ? styles.vidaAtiva : styles.vidaInativa]} />
        ))}
      </View>

      {/* ÁREA DE JOGO DINÂMICA COM FLEX: 1 */}
      <View 
        style={styles.gameArea} 
        onLayout={(e) => setGameAreaHeight(e.nativeEvent.layout.height)}
      >
        {operacoes.map((op) => (
          <Animated.View key={op.id} style={[
            styles.operacaoCard,
            op.especial && styles.operacaoEspecial,
            { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity }
          ]}>
            {op.especial && <Ionicons name="flash" size={12} color="#000" style={styles.estrelaEspecial} />}
            <Text style={[styles.operacaoText, op.especial && { color: '#000' }]}>
              {op.textoTela}
            </Text>
          </Animated.View>
        ))}

        {laserAtivo && (
          <Animated.View style={[
            styles.laser,
            { opacity: laserAnim, transform: [{ translateY: laserAnim.interpolate({ inputRange: [0, 1], outputRange: [height, laserAtivo.y] }) }],
              left: laserAtivo.x - 2, backgroundColor: laserAtivo.cor }
          ]} />
        )}
      </View>

      <View style={styles.powerUpRow}>
        {powerUpDisponivel ? (
          <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}>
            <Ionicons name="flash" size={18} color="#000" />
            <Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btnPowerUpInativo}>
            <Text style={styles.txtPowerUpInativo}>Acerte a conta amarela para carregar o poder</Text>
          </View>
        )}
      </View>

      {/* TECLADO REDUZIDO */}
      <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}>
        <Text style={styles.displayText}>{resposta || '?'}</Text>
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
            <Ionicons name="backspace" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tecla} onPress={() => pressionarTecla('0')}>
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tecla, styles.teclaEnviar]} onPress={() => pressionarTecla('enviar')}>
            <Ionicons name="checkmark-circle" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  
  // Menu
  menuContainer: { flex: 1 },
  menuScrollContent: { padding: 20, alignItems: 'center' },
  menuHeader: { alignItems: 'center', marginBottom: 20, marginTop: 20 },
  menuTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 10 },
  menuSubtitle: { fontSize: 14, color: '#888' },
  sectionLabel: { color: '#888', fontSize: 14, fontWeight: 'bold', marginBottom: 10, alignSelf: 'flex-start', marginTop: 10 },
  modosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
  modoCardItem: { backgroundColor: '#1a1a2e', paddingVertical: 12, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: '30%' },
  modoTextItem: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 10 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  botButton: { flexDirection: 'row', backgroundColor: '#FF00FF', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10, width: '100%' },
  botButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  
  // Game
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  placarContainer: { flexDirection: 'row', gap: 10 },
  gameStats: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a2e', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statText: { fontSize: 16, fontWeight: 'bold' },
  rodadaText: { color: '#4169E1', fontSize: 16, fontWeight: '900' },
  metaText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 3, paddingBottom: 5 },
  vidaMarca: { width: 8, height: 8, borderRadius: 4 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  
  // A Área de Jogo agora tem flex: 1 para empurrar o teclado para baixo
  gameArea: { flex: 1, position: 'relative', backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderColor: '#333' },
  operacaoCard: { position: 'absolute', backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, width: CARD_WIDTH, alignItems: 'center' },
  operacaoEspecial: { backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFF' },
  estrelaEspecial: { position: 'absolute', top: -8, right: -4, backgroundColor: '#FFF', borderRadius: 10, padding: 2 },
  operacaoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  laser: { position: 'absolute', width: 4, height: height, zIndex: -1 },
  
  powerUpRow: { paddingHorizontal: 16, paddingVertical: 5 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  btnPowerUpInativo: { backgroundColor: '#1a1a2e', padding: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  txtPowerUpInativo: { color: '#555', fontSize: 11, fontWeight: 'bold' },

  // Teclado Encolhido
  displayContainer: { backgroundColor: '#1a1a2e', marginHorizontal: 16, padding: 6, marginVertical: 4, borderRadius: 8, alignItems: 'center' },
  displayText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  tecladoContainer: { paddingHorizontal: 16, paddingBottom: 15, gap: 6 },
  tecladoRow: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  tecla: { backgroundColor: '#1a1a2e', flex: 1, height: 46, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  // Resultado
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 15 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 10, width: '100%' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
  voltarMenuButton: { padding: 16 },
  voltarMenuText: { color: '#888', fontSize: 14 },
});
