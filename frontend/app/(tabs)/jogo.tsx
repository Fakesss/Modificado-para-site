import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.50; 
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
  const [pausado, setPausado] = useState(false); 
  
  // Bot State
  const [botPontos, setBotPontos] = useState(0);
  const [laserAtivo, setLaserAtivo] = useState<{ x: number; y: number; cor: string } | null>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Refs
  const spawnTimer = useRef<any>(null);
  const botTimer = useRef<any>(null);
  const operacoesAtuaisRef = useRef<{lane: number, y: number, chave: string}[]>([]);
  const operacoesListRef = useRef<any[]>([]); 
  const rodadaRef = useRef(1);
  const jogoPausadoRef = useRef(false); 
  
  // IA de Dificuldade
  const desempenhoOcultoRef = useRef(0); 
  const questoesAcertadasRef = useRef<Set<string>>(new Set()); 
  const inicioRespostaRef = useRef<number>(Date.now()); 

  useEffect(() => { rodadaRef.current = rodada; }, [rodada]);
  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);

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
    setPausado(false);
    jogoPausadoRef.current = false;
    operacoesAtuaisRef.current = [];
    questoesAcertadasRef.current.clear();
    desempenhoOcultoRef.current = 0;
    setResposta('');
  };

  const calcularMetaRodada = (r: number) => r <= 10 ? 10 + (r * 2) : 30 + (r * 5);

  const avancarRodada = () => {
    const nr = rodada + 1;
    setRodada(nr);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(nr));
    questoesAcertadasRef.current.clear(); 
  };

  const obterPistaLivre = (): number => {
    const pistasDisponiveis = [0, 1, 2].filter(pista => {
      const opNaPista = operacoesAtuaisRef.current.find(op => op.lane === pista);
      return !opNaPista || opNaPista.y > GAME_AREA_HEIGHT * 0.2;
    });
    if (pistasDisponiveis.length === 0) return Math.floor(Math.random() * 3);
    return pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
  };

  const gerarOperacao = () => {
    const currentRodada = rodadaRef.current;
    const desempenho = desempenhoOcultoRef.current; 
    let opsPermitidas = ['+'];
    
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

    for (let t = 0; t < 50; t++) {
      const op = opsPermitidas[Math.floor(Math.random() * opsPermitidas.length)];
      let n1=0, n2: number | string = 0, res=0, texto='';
      
      switch (op) {
        case '+': n1 = Math.floor(Math.random() * numMaximo) + 1; n2 = Math.floor(Math.random() * numMaximo) + 1; res = n1 + (n2 as number); texto = `${n1} + ${n2}`; break;
        case '-': n1 = Math.floor(Math.random() * (numMaximo * 1.5)) + 5; n2 = Math.floor(Math.random() * n1) + 1; res = n1 - (n2 as number); texto = `${n1} - ${n2}`; break;
        case '×': n1 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2; n2 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2; res = n1 * (n2 as number); texto = `${n1} × ${n2}`; break;
        case '÷': n2 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2; res = Math.floor(Math.random() * Math.min(multMaximo, 10)) + 1; n1 = (n2 as number) * res; texto = `${n1} ÷ ${n2}`; break;
        case '^': n1 = Math.floor(Math.random() * Math.min(multMaximo, 12)) + 2; n2 = 2; res = n1 * n1; texto = `${n1}²`; break;
        case '√': res = Math.floor(Math.random() * Math.min(multMaximo, 15)) + 2; n1 = res * res; n2 = ''; texto = `√${n1}`; break;
        default: n1 = 1; n2 = 1; res = 2; texto = '1+1';
      }
      
      const chave = `${n1}${op}${n2}`;
      const jaAcertou = questoesAcertadasRef.current.has(chave);
      const estaNaTela = operacoesAtuaisRef.current.some(o => o.chave === chave);
      
      if (jaAcertou || estaNaTela) continue; 
      
      const isEspecial = Math.random() < 0.10; 
      const laneSelecionada = obterPistaLivre();
      const posX = (laneSelecionada * LANE_WIDTH) + (LANE_WIDTH - CARD_WIDTH) / 2;
      
      operacoesAtuaisRef.current.push({ lane: laneSelecionada, y: 0, chave });
      const tempoQueda = Math.max(4500, 15000 - (currentRodada * 500) - (desempenho * 400));

      return {
        id: Math.random().toString(),
        num1: n1, num2: n2, operador: op, resposta: res, textoTela: texto, chave: chave,
        y: new Animated.Value(0), 
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

  const iniciarSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);

    const loopSpawner = () => {
      if (!jogoPausadoRef.current) {
        const maxOps = Math.min(8, 3 + Math.floor(rodadaRef.current / 3) + Math.floor(desempenhoOcultoRef.current / 3));
        
        if (operacoesListRef.current.length < maxOps) {
          const nova = gerarOperacao();
          if (nova) { 
            setOperacoes(ops => [...ops, nova]);
            setTimeout(() => animarQueda(nova), 50); 
          }
        }
      }
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
    
    // 🚨 CORREÇÃO DAS CONTAS JUNTAS: Agora spawna apenas 1 no começo
    const inicial: any[] = [];
    const opInicial = gerarOperacao();
    if (opInicial) inicial.push(opInicial);
    
    setOperacoes(inicial);
    
    setTimeout(() => {
      inicial.forEach(op => animarQueda(op));
    }, 50);
    
    iniciarSpawner();

    if (modoEscolhido === 'bot') {
      botTimer.current = setInterval(() => {
        if (jogoPausadoRef.current) return;
        
        const ops = operacoesListRef.current;
        const alvosValidos = ops.filter(o => {
          const yVal = (o.y as any)._value || 0;
          return yVal > (GAME_AREA_HEIGHT * 0.35); 
        });

        if (alvosValidos.length > 0 && Math.random() > 0.3) { 
          const alvo = alvosValidos[0];
          alvo.y.stopAnimation();
          dispararLaser(alvo, true, 'bot');
          
          setTimeout(() => {
            setOperacoes(curr => curr.filter(o => o.id !== alvo.id));
            operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== alvo.chave);
            setBotPontos(p => p + 10);
          }, 350);
        }
      }, Math.max(2000, 5000 - (rodadaRef.current * 150))); 
    }
  };

  const animarQueda = (op: any, duracaoPersonalizada?: number) => {
    if (jogoPausadoRef.current) return;
    
    op.y.removeAllListeners(); 
    op.y.addListener(({ value }: { value: number }) => {
      const ref = operacoesAtuaisRef.current.find(o => o.chave === op.chave);
      if (ref) ref.y = value;
    });
    
    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 50,
      duration: duracaoPersonalizada || op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) perderVida(op.id, true); 
    });
  };

  const pausarJogo = () => {
    jogoPausadoRef.current = true;
    setPausado(true);
    operacoesListRef.current.forEach(op => op.y.stopAnimation());
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
  };

  const continuarJogo = () => {
    jogoPausadoRef.current = false;
    setPausado(false);
    
    operacoesListRef.current.forEach(op => {
      const posAtual = (op.y as any)._value || 0;
      const distanciaRestante = (GAME_AREA_HEIGHT + 50) - posAtual;
      const tempoRestante = (distanciaRestante / (GAME_AREA_HEIGHT + 50)) * op.speed;
      
      animarQueda(op, Math.max(tempoRestante, 500));
    });
    
    iniciarSpawner(); 
  };

  const sairDoJogo = () => {
    resetGame();
    setTela('menu');
  };

  const dispararLaser = (targetOp: any, acertou: boolean, atirador: 'player' | 'bot' = 'player') => {
    if (acertou && targetOp) {
      const tX = targetOp.posX + CARD_WIDTH / 2;
      const tY = (targetOp.y as any)._value || 100;

      setLaserAtivo({ x: tX, y: tY, cor: atirador === 'bot' ? '#FF00FF' : '#32CD32' });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
        Animated.parallel([
          Animated.timing(targetOp.scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
          Animated.timing(targetOp.opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start(() => setLaserAtivo(null));
      });
    } else {
      setLaserAtivo({ x: width / 2, y: GAME_AREA_HEIGHT * 0.2, cor: '#FF4444' });
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
    if (jogoPausadoRef.current) return;
    
    const resN = parseInt(resposta);
    if (isNaN(resN) || resposta === '') return;
    
    const opCorreta = operacoes.find(op => op.resposta === resN);
    const tempoLevado = Date.now() - inicioRespostaRef.current;
    
    if (opCorreta) {
      opCorreta.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opCorreta.chave);
      
      if (tempoLevado <= 3000) {
        desempenhoOcultoRef.current = Math.min(desempenhoOcultoRef.current + 1, 10);
      } else if (tempoLevado > 6000) {
        desempenhoOcultoRef.current = Math.max(desempenhoOcultoRef.current - 1, 0);
      }

      questoesAcertadasRef.current.add(opCorreta.chave); 
      
      setPontos(p => p + 10 + (tempoLevado < 3000 ? 5 : 0)); 
      setAcertosRodada(a => {
        const na = a + 1;
        if (na >= metaRodada) avancarRodada();
        return na;
      });
      
      if (opCorreta.especial && !powerUpDisponivel) setPowerUpDisponivel(true);
      
      dispararLaser(opCorreta, true, 'player');
      
      // 🚨 CORREÇÃO DO SUMIÇO: Só remove a conta da tela DEPOIS que o laser atingir ela
      setTimeout(() => {
        setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id));
      }, 350);

    } else {
      perderVida(undefined, false); 
      dispararLaser(null, false, 'player');
    }
    
    setResposta('');
    inicioRespostaRef.current = Date.now();
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel || operacoes.length === 0 || jogoPausadoRef.current) return;
    
    const visiveis = operacoes.filter(op => {
      const y = (op.y as any)._value || 0;
      return y >= 0 && y < GAME_AREA_HEIGHT;
    });
    if (visiveis.length === 0) return;
    
    visiveis.forEach(op => {
      op.y.stopAnimation();
      Animated.parallel([
        Animated.timing(op.scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
        Animated.timing(op.opacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    });
    
    setPontos(p => p + (visiveis.length * 10)); 
    
    setTimeout(() => {
      setOperacoes([]);
      operacoesAtuaisRef.current = [];
    }, 200);

    setPowerUpDisponivel(false);
  };

  const perderVida = (opId?: string, caiuNoChao: boolean = false) => {
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
    if (jogoPausadoRef.current) return;
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

            <Text style={styles.sectionLabel}>Escolha a Matéria:</Text>
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
        <View style={styles.headerStatsGroup}>
          <Ionicons name="star" size={18} color="#FFD700" />
          <Text style={styles.statTextScore}>{pontos}</Text>
          <Ionicons name="trophy" size={16} color="#4169E1" style={{ marginLeft: 15 }} />
          <Text style={styles.statTextMeta}>{acertosRodada}/{metaRodada}</Text>
        </View>
        <View style={styles.headerRightGroup}>
          <TouchableOpacity onPress={pausarJogo} style={styles.btnPausaIcone}>
            <Ionicons name="pause" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

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

      {/* PAINEL INFERIOR E TECLADO */}
      <View style={styles.bottomPanel}>
        <View style={styles.powerUpContainer}>
          {powerUpDisponivel ? (
            <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}>
              <Ionicons name="flash" size={18} color="#000" />
              <Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.btnPowerUpInativo}>
              <Text style={styles.txtPowerUpInativo}>Acerte a conta amarela para carregar</Text>
            </View>
          )}
        </View>

        <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.displayText}>{resposta || '0'}</Text>
        </Animated.View>

        <View style={styles.tecladoContainer}>
          {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
            <View key={i} style={styles.tecladoRow}>
              {row.map(num => (
                // 🚨 CORREÇÃO DO TECLADO: onPressIn para resposta em tempo real, sem delay!
                <TouchableOpacity key={num} style={styles.tecla} onPressIn={() => pressionarTecla(num)}>
                  <Text style={styles.teclaText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          <View style={styles.tecladoRow}>
            <TouchableOpacity style={[styles.tecla, styles.teclaApagar]} onPressIn={() => pressionarTecla('apagar')}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.tecla} onPressIn={() => pressionarTecla('0')}>
              <Text style={styles.teclaText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tecla, styles.teclaEnviar]} onPressIn={() => pressionarTecla('enviar')}>
              <Ionicons name="checkmark" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* MODAL DE PAUSA */}
      {pausado && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalPausaContainer}>
            <Ionicons name="pause-circle" size={64} color="#FFD700" />
            <Text style={styles.modalPausaTitulo}>Jogo Pausado</Text>
            <Text style={styles.modalPausaSub}>Respire fundo!</Text>

            <TouchableOpacity style={styles.continuarButton} onPress={continuarJogo}>
              <Ionicons name="play" size={22} color="#000" />
              <Text style={styles.continuarButtonText}>Continuar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sairButton} onPress={sairDoJogo}>
              <Ionicons name="exit" size={22} color="#fff" />
              <Text style={styles.sairButtonText}>Sair para o Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  
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
  
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerStatsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextScore: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statTextMeta: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  headerRightGroup: { flexDirection: 'row', alignItems: 'center' },
  btnPausaIcone: { padding: 4, marginLeft: 10 },
  
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingBottom: 10 },
  vidaMarca: { width: 8, height: 8, borderRadius: 4 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  
  gameArea: { position: 'relative', width: '100%', flex: 1, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  operacaoCard: { position: 'absolute', top: 0, backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, width: CARD_WIDTH, alignItems: 'center', zIndex: 10 },
  operacaoEspecial: { backgroundColor: '#FFD700' },
  estrelaEspecial: { position: 'absolute', top: -8, right: -4, backgroundColor: '#FFF', borderRadius: 10, padding: 2 },
  operacaoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  laser: { position: 'absolute', width: 4, height: height, zIndex: 1 },

  bottomPanel: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20, width: '100%' },
  powerUpContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 10 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  btnPowerUpInativo: { backgroundColor: '#1a1a2e', padding: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  txtPowerUpInativo: { color: '#444', fontSize: 12, fontWeight: 'bold' },

  displayContainer: { backgroundColor: '#1a1a2e', width: 250, height: 55, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  displayText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  tecladoContainer: { width: 250, gap: 6 },
  tecladoRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  tecla: { backgroundColor: '#1a1a2e', flex: 1, height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 15 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 10, width: '100%' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
  voltarMenuButton: { padding: 16 },
  voltarMenuText: { color: '#888', fontSize: 14 },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalPausaContainer: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', width: '80%' },
  modalPausaTitulo: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  modalPausaSub: { color: '#888', fontSize: 14, marginBottom: 20 },
  continuarButton: { backgroundColor: '#32CD32', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, width: '100%', justifyContent: 'center', marginBottom: 10 },
  continuarButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  sairButton: { backgroundColor: '#E74C3C', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, width: '100%', justifyContent: 'center' },
  sairButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
