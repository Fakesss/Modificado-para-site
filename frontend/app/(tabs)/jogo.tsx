import React, { useState, useEffect, useRef } from 'react';
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
const GAME_AREA_HEIGHT = height * 0.45;
const MAX_OPERACOES = 5;
const VELOCIDADE_BASE = 15000;
const SPAWN_INTERVAL = 2500;
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
  const [velocidade, setVelocidade] = useState(1);
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  
  // Bot State (Multiplayer Prototype)
  const [botPontos, setBotPontos] = useState(0);
  const [laserAtivo, setLaserAtivo] = useState<{ x: number; y: number; cor: string } | null>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Refs
  const spawnTimer = useRef<any>(null);
  const botTimer = useRef<any>(null);
  const operacoesAtuaisRef = useRef<{lane: number, y: number}[]>([]);
  const operacoesListRef = useRef<any[]>([]); // Para o bot conseguir ler a lista atualizada
  const rodadaRef = useRef(1);

  useEffect(() => {
    rodadaRef.current = rodada;
  }, [rodada]);

  useEffect(() => {
    operacoesListRef.current = operacoes;
  }, [operacoes]);

  // Limpa tudo ao sair ou reiniciar
  const resetGame = () => {
    if (spawnTimer.current) clearInterval(spawnTimer.current);
    if (botTimer.current) clearInterval(botTimer.current);
    setOperacoes([]);
    setVidas(10);
    setPontos(0);
    setBotPontos(0);
    setRodada(1);
    setAcertosRodada(0);
    setMetaRodada(10);
    setVelocidade(1);
    setPowerUpDisponivel(false);
    operacoesAtuaisRef.current = [];
  };

  const calcularMetaRodada = (r: number) => {
    return r <= 10 ? 10 + (r * 2) : 30 + (r * 5);
  };

  const avancarRodada = () => {
    const nr = rodada + 1;
    setRodada(nr);
    setAcertosRodada(0);
    setMetaRodada(calcularMetaRodada(nr));
    setVelocidade(v => Math.min(v + 0.3, 6)); 
  };

  const obterPistaLivre = (): number => {
    const pistasDisponiveis = [0, 1, 2].filter(pista => {
      const opNaPista = operacoesAtuaisRef.current.find(op => op.lane === pista);
      return !opNaPista || opNaPista.y > GAME_AREA_HEIGHT * 0.2;
    });
    if (pistasDisponiveis.length === 0) return Math.floor(Math.random() * 3);
    return pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
  };

  // 🧠 CÉREBRO DA MATEMÁTICA PROGRESSIVA
  const gerarOperacao = () => {
    const currentRodada = rodadaRef.current;
    let opsPermitidas = ['+'];
    let numMaximo = 10;
    let multMaximo = 5;

    // Se for modo Misto, a dificuldade é uma jornada que evolui com os rounds
    if (modoMatematica === 'misto') {
      if (currentRodada >= 3) opsPermitidas.push('-'); // Round 3: Entra subtração
      if (currentRodada >= 6) opsPermitidas.push('×'); // Round 6: Entra multiplicação
      if (currentRodada >= 9) opsPermitidas.push('÷'); // Round 9: Entra divisão
      if (currentRodada >= 12) opsPermitidas.push('^'); // Round 12: Entra potência
      if (currentRodada >= 15) opsPermitidas.push('√'); // Round 15: Entra raiz quadrada
      
      numMaximo = 10 + (currentRodada * 3); // Os números vão crescendo aos poucos
      multMaximo = 3 + Math.floor(currentRodada / 2); // Tabuada cresce devagar
    } else {
      // Modos isolados
      opsPermitidas = [modoMatematica === 'soma' ? '+' :
                       modoMatematica === 'subtracao' ? '-' :
                       modoMatematica === 'multiplicacao' ? '×' :
                       modoMatematica === 'divisao' ? '÷' :
                       modoMatematica === 'potenciacao' ? '^' : '√'];
      numMaximo = 10 + (currentRodada * 4);
      multMaximo = 3 + Math.floor(currentRodada / 2);
    }

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
        n2 = Math.floor(Math.random() * n1) + 1; // Garante que não dê negativo
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
        n2 = 2; // Foco em quadrados perfeitos
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
    
    const isEspecial = Math.random() < 0.15; // 15% de chance de power-up
    const laneSelecionada = obterPistaLivre();
    const posX = (laneSelecionada * LANE_WIDTH) + (LANE_WIDTH - CARD_WIDTH) / 2;
    
    operacoesAtuaisRef.current.push({ lane: laneSelecionada, y: -100 });
    
    return {
      id: Math.random().toString(),
      num1: n1, num2: n2, operador: op, resposta: res, textoTela: texto,
      y: new Animated.Value(-100),
      speed: VELOCIDADE_BASE / (1 + velocidade * 0.2),
      posX,
      lane: laneSelecionada,
      especial: isEspecial,
      opacity: new Animated.Value(1),
      scale: new Animated.Value(1),
    };
  };

  const iniciarJogo = (modoEscolhido: 'single' | 'bot') => {
    resetGame();
    setModo(modoEscolhido);
    setTela('jogo');
    
    const inicial: any[] = [];
    for (let i = 0; i < 3; i++) {
      const op = gerarOperacao();
      if (op) inicial.push(op);
    }
    setOperacoes(inicial);
    inicial.forEach(op => animarQueda(op));
    
    // Spawner de Contas
    spawnTimer.current = setInterval(() => {
      setOperacoes(ops => {
        if (ops.length < MAX_OPERACOES) {
          const nova = gerarOperacao();
          if (nova) { animarQueda(nova); return [...ops, nova]; }
        }
        return ops;
      });
    }, SPAWN_INTERVAL);

    // 🤖 PROTÓTIPO MULTIPLAYER (BOT)
    if (modoEscolhido === 'bot') {
      botTimer.current = setInterval(() => {
        const ops = operacoesListRef.current;
        // O Bot só atira em contas que já desceram um pouco (para dar chance ao humano)
        const alvosValidos = ops.filter(o => {
          const yVal = (o.y as any)._value || 0;
          return yVal > (GAME_AREA_HEIGHT * 0.3);
        });

        if (alvosValidos.length > 0 && Math.random() > 0.3) { // 70% de chance de acerto do bot
          const alvo = alvosValidos[0];
          alvo.y.stopAnimation();
          
          setOperacoes(curr => curr.filter(o => o.id !== alvo.id));
          operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.lane !== alvo.lane);
          
          setBotPontos(p => p + 10);
          dispararLaser(alvo, true, 'bot');
        }
      }, Math.max(2000, 5000 - (rodadaRef.current * 150))); // Bot fica mais rápido a cada round!
    }
  };

  const animarQueda = (op: any) => {
    op.y.addListener(({ value }: { value: number }) => {
      const ref = operacoesAtuaisRef.current.find(o => o.lane === op.lane);
      if (ref) ref.y = value;
    });
    
    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 100,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) perderVida(op.id);
    });
  };

  const dispararLaser = (targetOp: any, acertou: boolean, atirador: 'player' | 'bot' = 'player') => {
    if (acertou && targetOp) {
      const tX = targetOp.posX + CARD_WIDTH / 2;
      const tY = (targetOp.y as any)._value || 100;
      // Laser Verde pro Player, Roxo pro Bot
      const corLaser = atirador === 'bot' ? '#FF00FF' : '#32CD32'; 
      const origemX = atirador === 'bot' ? width - 50 : 50;

      setLaserAtivo({ x: tX, y: tY, cor: corLaser });
      laserAnim.setValue(0);
      Animated.timing(laserAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
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
    const resN = parseInt(resposta);
    if (isNaN(resN) || resposta === '') return;
    
    const opCorreta = operacoes.find(op => op.resposta === resN);
    
    if (opCorreta) {
      opCorreta.y.stopAnimation();
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.lane !== opCorreta.lane);
      
      setPontos(p => p + 10);
      setAcertosRodada(a => {
        const na = a + 1;
        if (na >= metaRodada) avancarRodada();
        return na;
      });
      
      if (opCorreta.especial && !powerUpDisponivel) {
        setPowerUpDisponivel(true);
      }
      
      dispararLaser(opCorreta, true, 'player');
      setOperacoes(ops => ops.filter(o => o.id !== opCorreta.id));
    } else {
      perderVida();
      dispararLaser(null, false, 'player');
    }
    
    setResposta('');
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel || operacoes.length === 0) return;
    
    const visiveis = operacoes.filter(op => {
      const y = (op.y as any)._value || 0;
      return y >= 0 && y < GAME_AREA_HEIGHT;
    });
    if (visiveis.length === 0) return;
    
    visiveis.forEach(op => {
      op.y.stopAnimation();
    });
    
    setPontos(p => p + (visiveis.length * 10)); 
    setOperacoes([]);
    operacoesAtuaisRef.current = [];
    setPowerUpDisponivel(false);
  };

  const perderVida = (opId?: string) => {
    setVidas(v => {
      const nv = v - 1;
      if (nv <= 0) {
        if (spawnTimer.current) clearInterval(spawnTimer.current);
        if (botTimer.current) clearInterval(botTimer.current);
        setOperacoes([]);
        setTela('resultado');
      }
      return nv;
    });
    if (opId) {
      setOperacoes(ops => {
        const op = ops.find(o => o.id === opId);
        if (op) operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.lane !== op.lane);
        return ops.filter(o => o.id !== opId);
      });
    }
  };

  const pressionarTecla = (tecla: string) => {
    if (tecla === 'enviar') verificarResposta();
    else if (tecla === 'apagar') setResposta(r => r.slice(0, -1));
    else setResposta(r => r + tecla);
  };

  // ==================== TELA DE MENU ====================
  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Ionicons name="game-controller" size={64} color="#FFD700" />
            <Text style={styles.menuTitle}>Matemática Turbo</Text>
            <Text style={styles.menuSubtitle}>Modo de Treino</Text>
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
        </View>
      </SafeAreaView>
    );
  }

  // ==================== TELA DE RESULTADO ====================
  if (tela === 'resultado') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{modo === 'bot' && botPontos > pontos ? '🤖 O Bot Venceu!' : 'Fim de Jogo!'}</Text>
          
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
      {/* HEADER DE PONTUAÇÃO DUPLA SE FOR BOT */}
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

        {/* Efeito de Tiro (Laser) */}
        {laserAtivo && (
          <Animated.View style={[
            styles.laser,
            { opacity: laserAnim, transform: [{ translateY: laserAnim.interpolate({ inputRange: [0, 1], outputRange: [height - 280, laserAtivo.y] }) }],
              left: laserAtivo.x - 2, backgroundColor: laserAtivo.cor }
          ]} />
        )}
      </View>

      <View style={styles.powerUpRow}>
        {powerUpDisponivel ? (
          <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}>
            <Ionicons name="flash" size={20} color="#000" />
            <Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.btnPowerUpInativo}>
            <Text style={styles.txtPowerUpInativo}>Acerte a conta amarela para carregar</Text>
          </View>
        )}
      </View>

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
            <Ionicons name="backspace" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tecla} onPress={() => pressionarTecla('0')}>
            <Text style={styles.teclaText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tecla, styles.teclaEnviar]} onPress={() => pressionarTecla('enviar')}>
            <Ionicons name="checkmark-circle" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  
  // Menu
  menuContainer: { flex: 1, padding: 20, justifyContent: 'center' },
  menuHeader: { alignItems: 'center', marginBottom: 30 },
  menuTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 10 },
  menuSubtitle: { fontSize: 16, color: '#888' },
  sectionLabel: { color: '#888', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  modosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 30 },
  modoCardItem: { backgroundColor: '#1a1a2e', padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', minWidth: '30%' },
  modoTextItem: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  botButton: { flexDirection: 'row', backgroundColor: '#FF00FF', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  botButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  // Game
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  placarContainer: { flexDirection: 'row', gap: 15 },
  gameStats: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statText: { fontSize: 18, fontWeight: 'bold' },
  rodadaText: { color: '#4169E1', fontSize: 18, fontWeight: '900' },
  metaText: { color: '#888', fontSize: 14, fontWeight: 'bold' },
  
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 3, paddingBottom: 10 },
  vidaMarca: { width: 10, height: 10, borderRadius: 5 },
  vidaAtiva: { backgroundColor: '#FF4444' },
  vidaInativa: { backgroundColor: '#333' },
  
  gameArea: { flex: 1, position: 'relative', backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderColor: '#333' },
  operacaoCard: { position: 'absolute', backgroundColor: '#4169E1', paddingVertical: 12, borderRadius: 10, width: CARD_WIDTH, alignItems: 'center' },
  operacaoEspecial: { backgroundColor: '#FFD700', borderWidth: 2, borderColor: '#FFF' },
  estrelaEspecial: { position: 'absolute', top: -10, right: -5, backgroundColor: '#FFF', borderRadius: 10, padding: 2 },
  operacaoText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  laser: { position: 'absolute', width: 4, height: height, zIndex: -1 },
  
  powerUpRow: { paddingHorizontal: 16, paddingVertical: 8 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 16 },
  btnPowerUpInativo: { backgroundColor: '#1a1a2e', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  txtPowerUpInativo: { color: '#444', fontSize: 12, fontWeight: 'bold' },

  displayContainer: { backgroundColor: '#1a1a2e', marginHorizontal: 16, padding: 10, marginVertical: 5, borderRadius: 8, alignItems: 'center' },
  displayText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  tecladoContainer: { paddingHorizontal: 16, paddingBottom: 20, gap: 8 },
  tecladoRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  tecla: { backgroundColor: '#1a1a2e', flex: 1, height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  // Resultado
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 20 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 10, width: '100%' },
  resultadoPontos: { fontSize: 72, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 16, color: '#888', marginTop: 10 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 18, borderRadius: 12, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
  voltarMenuButton: { padding: 16 },
  voltarMenuText: { color: '#888', fontSize: 16 },
});
