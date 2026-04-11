import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

const { width } = Dimensions.get('window');

// =========================================================================
// EMOJIS FLUTUANTES DA RISADA (QUANDO O ROBÔ GANHA)
// =========================================================================
const RisadinhasAnimadas = () => {
  const anims = useRef(Array.from({length: 6}).map(() => new Animated.Value(0))).current;

  useEffect(() => {
     anims.forEach((anim, i) => {
        Animated.sequence([
           Animated.delay(i * 300),
           Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true })
        ]).start();
     });
  }, []);
  
  return (
      <View style={{position: 'absolute', top: -80, left: 10, flexDirection: 'row', zIndex: 50}}>
         {anims.map((anim, i) => (
            <Animated.Text key={i} style={{
                fontSize: 28,
                marginHorizontal: -5,
                opacity: anim.interpolate({inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0]}),
                transform: [
                    { translateY: anim.interpolate({inputRange: [0, 1], outputRange: [0, -80]}) },
                    { translateX: anim.interpolate({inputRange: [0, 1], outputRange: [0, (i % 2 === 0 ? 20 : -20)]}) }
                ]
            }}>🤣🤣</Animated.Text>
         ))}
      </View>
  );
}

// =========================================================================
// ANIMAÇÃO DOS TIMES
// =========================================================================
const AnimatedTeam = ({ isLeft, config, teamState }: any) => {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animVal.stopAnimation();
    if (teamState === 'pull') {
      Animated.sequence([
        Animated.timing(animVal, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(animVal, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
    } else if (teamState === 'win') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animVal, { toValue: 2, duration: 250, useNativeDriver: true }),
          Animated.timing(animVal, { toValue: 0, duration: 250, useNativeDriver: true })
        ])
      ).start();
    } else if (teamState === 'lose') {
      Animated.timing(animVal, { toValue: 3, duration: 400, useNativeDriver: true }).start();
    } else {
      Animated.timing(animVal, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [teamState]);

  const rotation = animVal.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: ['0deg', isLeft ? '-25deg' : '25deg', '0deg', isLeft ? '-90deg' : '90deg']
  });

  const translateY = animVal.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, 0, -25, 20]
  });

  const translateX = animVal.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, isLeft ? -10 : 10, 0, isLeft ? -15 : 15]
  });

  const glowStyle: any = Platform.OS === 'web' 
    ? { filter: `drop-shadow(0px 0px 8px ${config.glow})` }
    : { textShadowColor: config.glow, textShadowRadius: 15 };

  return (
    <View style={[styles.teamContainer, { flexDirection: isLeft ? 'row' : 'row-reverse' }]}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={{ 
          transform: [{ rotate: rotation }, { translateY }, { translateX }],
          marginLeft: isLeft && i > 0 ? -15 : 0, 
          marginRight: !isLeft && i > 0 ? -15 : 0,
          zIndex: 3 - i,
          justifyContent: 'center', alignItems: 'center'
        }}>
          <Ionicons name="body" size={55} color={config.core} style={glowStyle} />
        </Animated.View>
      ))}
    </View>
  );
};

// =========================================================================
// BOTÃO VISUAL DO TECLADO
// =========================================================================
const BotaoVisual = ({ valor, isPressed, onPressWeb }: any) => {
  return (
    <TouchableOpacity
      style={[
        styles.tecla,
        valor === 'apagar' ? styles.teclaApagar : valor === 'enviar' ? styles.teclaEnviar : null,
        isPressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }
      ]}
      onPress={Platform.OS === 'web' ? () => onPressWeb(valor) : undefined}
      disabled={Platform.OS !== 'web'}
      activeOpacity={1}
    >
      {valor === 'apagar' ? <Ionicons name="close" size={24} color="#fff" /> :
       valor === 'enviar' ? <Ionicons name="checkmark" size={28} color="#fff" /> :
       <Text style={styles.teclaText}>{valor}</Text>}
    </TouchableOpacity>
  );
};

export default function CaboDeGuerraOffline() {
  const { user } = useAuth();
  const router = useRouter();

  // ESTADOS DO JOGO
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [modoEscolhido, setModoEscolhido] = useState('misto');
  const [operacao, setOperacao] = useState<{ texto: string, resposta: number } | null>(null);
  const [resposta, setResposta] = useState('');
  const [ganhador, setGanhador] = useState<'player' | 'bot' | null>(null);
  const [ropePosition, setRopePosition] = useState(0);

  const [leftState, setLeftState] = useState('idle');
  const [rightState, setRightState] = useState('idle');

  // I.A. DO ROBÔ E TIMERS
  const playerTimes = useRef<number[]>([]);
  const timeUltimaPergunta = useRef<number>(0);
  const botTimer = useRef<NodeJS.Timeout | null>(null);
  const isGameOver = useRef(false);
  const ropeAnim = useRef(new Animated.Value(0)).current;

  // =========================================================================
  // FÁBRICA DE MATEMÁTICA CORRIGIDA (FRONTEND)
  // =========================================================================
  const gerarNovaOperacao = (modo: string) => {
    const ops_disponiveis = modo === 'soma' ? ['+'] :
                            modo === 'subtracao' ? ['-'] :
                            modo === 'multiplicacao' ? ['x'] :
                            modo === 'divisao' ? ['/'] :
                            modo === 'potenciacao' ? ['^', 'v'] :
                            ['+', '-', 'x', '/', '^', 'v']; // misto
                            
    const op = ops_disponiveis[Math.floor(Math.random() * ops_disponiveis.length)];
    let texto = "";
    let res = 0;

    if (op === '+') { 
        const n1 = Math.floor(Math.random() * 20) + 1; const n2 = Math.floor(Math.random() * 20) + 1;
        res = n1 + n2; texto = `${n1} + ${n2}`;
    } else if (op === '-') { 
        const n1 = Math.floor(Math.random() * 20) + 10; const n2 = Math.floor(Math.random() * n1) + 1;
        res = n1 - n2; texto = `${n1} - ${n2}`;
    } else if (op === 'x') { 
        const n1 = Math.floor(Math.random() * 10) + 1; const n2 = Math.floor(Math.random() * 10) + 1;
        res = n1 * n2; texto = `${n1} x ${n2}`;
    } else if (op === '/') {
        const n2 = Math.floor(Math.random() * 9) + 2; 
        res = Math.floor(Math.random() * 9) + 2; 
        const n1 = n2 * res; texto = `${n1} ÷ ${n2}`;
    } else if (op === '^') {
        const n1 = Math.floor(Math.random() * 9) + 2; 
        res = n1 * n1; texto = `${n1}²`;
    } else if (op === 'v') {
        res = Math.floor(Math.random() * 9) + 2; 
        const n1 = res * res; texto = `√${n1}`;
    }
    setOperacao({ texto, resposta: res });
    timeUltimaPergunta.current = Date.now();
  };

  // =========================================================================
  // I.A. ADAPTATIVA DO ROBÔ
  // =========================================================================
  const agendarPuxadaRobo = () => {
    if (botTimer.current) clearTimeout(botTimer.current);
    if (isGameOver.current || tela !== 'jogo') return;

    // A MÁGICA ADAPTATIVA ACONTECE AQUI
    let delayDoRobo = 4500; // Padrão inicial: 4.5 segundos
    
    if (playerTimes.current.length > 0) {
        // Calcula a média de tempo que o aluno leva para responder
        const mediaAluno = playerTimes.current.reduce((a,b)=>a+b,0) / playerTimes.current.length;
        
        // O Robô ajusta sua velocidade para ser 15% mais lento que a média do aluno
        delayDoRobo = mediaAluno * 1.15; 
        
        if (delayDoRobo < 1500) delayDoRobo = 1500; // Limite Máximo (muito rápido)
        if (delayDoRobo > 7000) delayDoRobo = 7000; // Limite Mínimo (muito lento)
    }

    // ===== NÍVEIS DE DIFICULDADE FIXA (DESATIVADOS) =====
    // Para ativar a velocidade fixa, remova os "//" abaixo e comente a lógica Adaptativa acima
    // const VELOCIDADES_FIXAS = { facil: 6000, medio: 4000, dificil: 2500, hardcore: 1200 };
    // delayDoRobo = VELOCIDADES_FIXAS.medio; 

    botTimer.current = setTimeout(() => {
        if (isGameOver.current) return;
        
        setRopePosition(prev => {
            const next = prev - 1; // Robô puxa para a esquerda (negativo)
            Animated.spring(ropeAnim, { toValue: next * -1, useNativeDriver: false, friction: 5, tension: 30 }).start();
            
            setLeftState('pull');
            setTimeout(() => { if (!isGameOver.current) setLeftState('idle') }, 300);

            if (next <= -10) handleFimDeJogo('bot');
            else agendarPuxadaRobo(); // Agenda a próxima puxada se o jogo continuar

            return next;
        });
    }, delayDoRobo);
  };

  const iniciarJogo = (modo: string) => {
      setModoEscolhido(modo);
      setRopePosition(0);
      playerTimes.current = [];
      isGameOver.current = false;
      setGanhador(null);
      setLeftState('idle');
      setRightState('idle');
      Animated.spring(ropeAnim, { toValue: 0, useNativeDriver: false }).start();
      
      setTela('jogo');
      gerarNovaOperacao(modo);
      agendarPuxadaRobo(); // Dá a largada no robô
  };

  const handleFimDeJogo = async (vencedor: 'player' | 'bot') => {
      isGameOver.current = true;
      if (botTimer.current) clearTimeout(botTimer.current);
      
      setLeftState(vencedor === 'bot' ? 'win' : 'lose');
      setRightState(vencedor === 'player' ? 'win' : 'lose');
      setGanhador(vencedor);
      
      setTimeout(() => setTela('resultado'), 1500);

      // RISADA SONORA DO ROBÔ (Seguro: funciona no Web e tenta no Mobile)
      if (vencedor === 'bot') {
         if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const utter = new SpeechSynthesisUtterance("Ha ha ha ha! Eu venci!");
            utter.lang = 'pt-BR';
            utter.pitch = 0.5; // Voz grossa
            window.speechSynthesis.speak(utter);
         } else {
             try {
                 const { Audio } = require('expo-av');
                 const somRisada = new Audio.Sound();
                 await somRisada.loadAsync({ uri: 'https://www.myinstants.com/media/sounds/evil-laugh.mp3' });
                 await somRisada.playAsync();
             } catch (e) {
                 console.log("Áudio não pôde ser reproduzido, usando apenas emojis visuais.");
             }
         }
      }
  };

  // =========================================================================
  // TECLADO RADAR 
  // =========================================================================
  const [teclasPressionadas, setTeclasPressionadas] = useState<string[]>([]);
  const triggeredTouchesRef = useRef<Set<string>>(new Set());

  const getTeclaFromCoords = (x: number, y: number) => {
    let col = -1;
    if (x >= 0 && x <= 100) col = 0;
    else if (x > 100 && x <= 200) col = 1;
    else if (x > 200 && x <= 300) col = 2;
    let row = -1;
    if (y >= 0 && y <= 60) row = 0;
    else if (y > 60 && y <= 120) row = 1;
    else if (y > 120 && y <= 180) row = 2;
    else if (y > 180 && y <= 240) row = 3;

    if (col === -1 || row === -1) return null;
    const layout = [['7','8','9'], ['4','5','6'], ['1','2','3'], ['apagar','0','enviar']];
    return layout[row][col];
  };

  const handleMultiTouch = (evt: any) => {
    if (Platform.OS === 'web') return;
    const touches = evt.nativeEvent.touches;
    const currentActive = new Set<string>();

    for (let i = 0; i < touches.length; i++) {
      const key = getTeclaFromCoords(touches[i].locationX, touches[i].locationY);
      if (key) currentActive.add(key);
    }
    setTeclasPressionadas(Array.from(currentActive));

    currentActive.forEach(key => {
      if (!triggeredTouchesRef.current.has(key)) {
        triggeredTouchesRef.current.add(key);
        executarAcaoTecla(key);
      }
    });

    triggeredTouchesRef.current.forEach(key => {
      if (!currentActive.has(key)) triggeredTouchesRef.current.delete(key);
    });
  };

  const executarAcaoTecla = (valor: string) => {
    setResposta(prev => {
        if (valor === 'apagar') return prev.slice(0, -1);
        if (valor === 'enviar') {
            setTimeout(() => submeterResposta(prev), 0);
            return prev;
        }
        return prev.length < 5 ? prev + valor : prev;
    });
  };

  const submeterResposta = (valorAtual: string) => {
    if (!operacao || isGameOver.current) return;

    if (parseInt(valorAtual) === operacao.resposta) {
        // ACERTOU! Salva o tempo para o Robô aprender e puxa a corda
        const tempoGasto = Date.now() - timeUltimaPergunta.current;
        playerTimes.current.push(tempoGasto);
        
        setRopePosition(prev => {
            const next = prev + 1; // Player puxa para a direita (positivo)
            Animated.spring(ropeAnim, { toValue: next * -1, useNativeDriver: false, friction: 5, tension: 30 }).start();
            
            setRightState('pull');
            setTimeout(() => { if (!isGameOver.current) setRightState('idle') }, 300);

            if (next >= 10) handleFimDeJogo('player');
            return next;
        });

        gerarNovaOperacao(modoEscolhido);
    } else {
        // Errou, a corda escorrega um pouco para o robô por penalidade (Opcional)
        // Aqui deixei sem penalidade de corda, apenas perdeu tempo
    }
    setResposta('');
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handleKeyDownLocal = (e: any) => {
            if (tela !== 'jogo') return;
            let key = '';
            if (e.key >= '0' && e.key <= '9') key = e.key;
            else if (e.key === 'Backspace' || e.key === 'Delete') key = 'apagar';
            else if (e.key === 'Enter') key = 'enviar';

            if (key) {
                executarAcaoTecla(key);
                setTeclasPressionadas(prev => [...prev, key]);
                setTimeout(() => setTeclasPressionadas(prev => prev.filter(k => k !== key)), 150);
            }
        };
        window.addEventListener('keydown', handleKeyDownLocal);
        return () => window.removeEventListener('keydown', handleKeyDownLocal);
    }
  }, [tela, operacao]);

  // Limpeza de Timers ao sair
  useEffect(() => {
     return () => { if (botTimer.current) clearTimeout(botTimer.current); };
  }, []);

  const ropeKnotPosition = ropeAnim.interpolate({ inputRange: [-10, 10], outputRange: ['10%', '90%'], extrapolate: 'clamp' });

  // =========================================================================
  // TELAS (RENDER)
  // =========================================================================

  if (tela === 'menu') {
      return (
          <SafeAreaView style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.btnSair}>
                <Ionicons name="arrow-back" size={24} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>TREINO OFFLINE</Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="hardware-chip" size={80} color="#FF4500" style={{ marginBottom: 20 }} />
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>Desafie a I.A.</Text>
                <Text style={{ color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 }}>
                   O robô vai se adaptar à sua velocidade. Escolha a operação que deseja treinar:
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
                   {['soma', 'subtracao', 'multiplicacao', 'divisao', 'potenciacao', 'misto'].map((modo) => (
                      <TouchableOpacity key={modo} style={styles.menuButton} onPress={() => iniciarJogo(modo)}>
                          <Text style={styles.menuButtonText}>
                             {modo === 'potenciacao' ? 'Potência / Raiz' : modo.toUpperCase()}
                          </Text>
                      </TouchableOpacity>
                   ))}
                </View>
            </View>
          </SafeAreaView>
      );
  }

  if (tela === 'resultado') {
    const venci = ganhador === 'player';
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={[styles.resultadoTitle, { color: venci ? '#32CD32' : '#FF4500' }]}>
              {venci ? 'Você Venceu o Robô!' : 'Fim da Linha!'}
          </Text>
          <Ionicons name={venci ? 'trophy' : 'skull'} size={100} color={venci ? '#FFD700' : '#888'} style={{ marginBottom: 20 }} />
          <Text style={{ color: '#aaa', fontSize: 16, marginBottom: 30 }}>
              {venci ? 'Você foi muito rápido!' : 'A Inteligência Artificial foi mais veloz desta vez.'}
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 15 }}>
             <TouchableOpacity style={[styles.btnAcao, { backgroundColor: '#333' }]} onPress={() => setTela('menu')}>
               <Text style={styles.btnAcaoText}>Mudar Modo</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.btnAcao, { backgroundColor: '#FFD700' }]} onPress={() => iniciarJogo(modoEscolhido)}>
               <Text style={[styles.btnAcaoText, { color: '#000' }]}>Jogar Novamente</Text>
             </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { isGameOver.current = true; setTela('menu'); }} style={styles.btnSair}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CABO DE GUERRA</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.arena}>
        <View style={styles.namesRow}>
           <Text style={[styles.playerName, { color: '#555', textShadowColor: '#FF0000', textShadowRadius: 10 }]}>ROBÔ I.A.</Text>
           <Text style={[styles.playerName, { color: '#4169E1', textShadowColor: '#4169E1', textShadowRadius: 10 }]}>VOCÊ</Text>
        </View>

        <View style={styles.field}>
            <View style={styles.teamLeftZone}>
               {ganhador === 'bot' && <RisadinhasAnimadas />}
               <AnimatedTeam isLeft={true} config={{ core: '#555', glow: '#FF0000' }} teamState={leftState} />
            </View>

            <View style={styles.teamRightZone}>
               <AnimatedTeam isLeft={false} config={{ core: '#4169E1', glow: '#4169E1' }} teamState={rightState} />
            </View>

            <View style={styles.ropeLine} />
            <Animated.View style={[styles.ropeKnot, { left: ropeKnotPosition }]}>
               <View style={styles.knotCore} />
            </Animated.View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.instruction}>Puxe a corda resolvendo rápido!</Text>
        
        <View style={styles.operationCard}>
           <Text style={styles.operationText}>{operacao?.texto || '---'}</Text>
        </View>

        <View style={styles.displayContainer}>
          <Text style={styles.displayText}>{resposta || ' '}</Text>
        </View>

        <View style={styles.tecladoContainer}>
          <View style={styles.tecladoGrid}>
            {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
              <View key={i} style={styles.tecladoRow}>
                {row.map(num => (
                  <BotaoVisual key={num} valor={num} isPressed={teclasPressionadas.includes(num)} onPressWeb={executarAcaoTecla} />
                ))}
              </View>
            ))}
            <View style={styles.tecladoRow}>
              <BotaoVisual valor="apagar" isPressed={teclasPressionadas.includes('apagar')} onPressWeb={executarAcaoTecla} />
              <BotaoVisual valor="0" isPressed={teclasPressionadas.includes('0')} onPressWeb={executarAcaoTecla} />
              <BotaoVisual valor="enviar" isPressed={teclasPressionadas.includes('enviar')} onPressWeb={executarAcaoTecla} />
            </View>
          </View>

          {Platform.OS !== 'web' && (
             <View
                style={StyleSheet.absoluteFillObject}
                onStartShouldSetResponder={() => true}
                onResponderGrant={handleMultiTouch}
                onResponderMove={handleMultiTouch}
                onResponderRelease={handleMultiTouch}
                onResponderTerminate={handleMultiTouch}
             />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15 },
  btnSair: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  
  menuButton: { backgroundColor: '#333', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minWidth: '45%', alignItems: 'center', borderWidth: 1, borderColor: '#555' },
  menuButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  arena: { flex: 1, justifyContent: 'center', paddingHorizontal: 10, position: 'relative' },
  namesRow: { flexDirection: 'row', justifyContent: 'space-between', position: 'absolute', top: 10, width: '100%', paddingHorizontal: 20 },
  playerName: { fontWeight: '900', fontSize: 18, textTransform: 'uppercase' },

  field: { height: 120, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 10, position: 'relative' },
  teamLeftZone: { flex: 1, alignItems: 'flex-start', zIndex: 5, paddingLeft: 10 },
  teamRightZone: { flex: 1, alignItems: 'flex-end', zIndex: 5, paddingRight: 10 },
  teamContainer: { alignItems: 'flex-end', paddingBottom: 10 },

  ropeLine: { position: 'absolute', top: 25, width: '100%', height: 3, backgroundColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 0.8, shadowRadius: 10, elevation: 10, zIndex: 1 },
  ropeKnot: { position: 'absolute', top: 25, width: 24, height: 24, marginTop: -10, marginLeft: -12, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  knotCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF4500', shadowColor: '#FF4500', shadowOpacity: 1, shadowRadius: 15, elevation: 15, borderWidth: 2, borderColor: '#FFF' },

  panel: { backgroundColor: '#1a1a2e', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', elevation: 10, borderTopWidth: 1, borderTopColor: '#333' },
  instruction: { color: '#AAA', fontSize: 14, marginBottom: 15, fontWeight: 'bold' },
  operationCard: { backgroundColor: '#8A2BE2', paddingVertical: 20, paddingHorizontal: 50, borderRadius: 16, marginBottom: 15, elevation: 4 },
  operationText: { color: '#FFF', fontSize: 38, fontWeight: '900', letterSpacing: 2 },
  displayContainer: { backgroundColor: 'rgba(0,0,0,0.5)', width: '100%', maxWidth: 300, height: 55, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  displayText: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  tecladoContainer: { width: '100%', maxWidth: 300, position: 'relative' },
  tecladoGrid: { width: '100%', gap: 5 },
  tecladoRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  tecla: { backgroundColor: 'rgba(255, 255, 255, 0.1)', flex: 1, height: 55, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  teclaText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: 'rgba(231, 76, 60, 0.85)' },
  teclaEnviar: { backgroundColor: 'rgba(50, 205, 50, 0.85)' },

  resultadoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultadoTitle: { fontSize: 32, fontWeight: '900', marginBottom: 30, textAlign: 'center' },
  btnAcao: { paddingVertical: 16, paddingHorizontal: 25, borderRadius: 16, elevation: 4, minWidth: 120, alignItems: 'center' },
  btnAcaoText: { fontSize: 16, fontWeight: '900', color: '#fff' }
});
