import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Alert, Platform, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { socket, activeMatchData, setActiveMatchData } from '../src/services/socket';
import { useAuth } from '../src/context/AuthContext';

// =========================================================================
// O RAIO DE ENERGIA NEON (Substitui a Corda e Bandeira)
// =========================================================================
const BeamSide = ({ color, isLeft, isGhost }: any) => {
  if (color === 'RAINBOW') {
    return (
      <LinearGradient 
        style={StyleSheet.absoluteFill} 
        colors={isLeft ? ['#00BFFF', '#32CD32', '#FFD700', '#FF4500'] : ['#FF4500', '#FFD700', '#32CD32', '#00BFFF']} 
        start={{x: 0, y: 0}} end={{x: 1, y: 0}} 
      />
    );
  }
  
  if (isGhost) {
    return (
       <View style={[
         StyleSheet.absoluteFill, 
         { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: color, shadowColor: color, shadowRadius: 10, shadowOpacity: 1, elevation: 10 }
       ]} />
    );
  }

  return (
    <View style={[
      StyleSheet.absoluteFill, 
      { backgroundColor: color, shadowColor: color, shadowRadius: 10, shadowOpacity: 1, elevation: 10 }
    ]} />
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

export default function CaboDeGuerraOnline() {
  const { user } = useAuth();
  const router = useRouter();

  const [tela, setTela] = useState<'jogo' | 'resultado'>('jogo');
  const [isP1, setIsP1] = useState(true);
  const [oponenteNome, setOponenteNome] = useState('Oponente');
  const [operacao, setOperacao] = useState<{ texto: string, resposta: number } | null>(null);
  const [resposta, setResposta] = useState('');
  const [ganhador, setGanhador] = useState<string | null>(null);

  const roomIdRef = useRef<string>('');
  const hasLeftMatch = useRef(false);
  const ropeAnim = useRef(new Animated.Value(0)).current;

  // =========================================================================
  // SISTEMA DE CORES DE EQUIPES
  // =========================================================================
  const getTeamColor = (teamName: string, role?: string, email?: string) => {
    if (role === 'ADMIN' || email?.includes('admin')) return 'RAINBOW';
    const upper = teamName?.toUpperCase() || '';
    if (upper === 'VERMELHO') return '#FF4500';
    if (upper === 'AMARELO') return '#FFD700';
    if (upper === 'VERDE') return '#32CD32';
    return '#00BFFF'; // Azul (Padrão)
  };

  const isP1Local = isP1;
  const leftName = isP1Local ? 'Você' : oponenteNome;
  const rightName = !isP1Local ? 'Você' : oponenteNome;

  const meuTime = user?.equipe || 'AZUL';
  // Fallback inteligente para garantir que haja distinção
  const timeOponente = activeMatchData?.opponentTeam || (meuTime === 'AZUL' ? 'VERMELHO' : 'AZUL'); 

  const minhaCor = getTeamColor(meuTime, user?.role, user?.email);
  const oponenteCor = activeMatchData?.opponentRole === 'ADMIN' ? 'RAINBOW' : getTeamColor(timeOponente, '', '');

  const corEsquerda = isP1Local ? minhaCor : oponenteCor;
  const corDireita = !isP1Local ? minhaCor : oponenteCor;

  // Solução para oponente da Mesma Equipe
  let rightIsGhost = false;
  if (corEsquerda === corDireita && corEsquerda !== 'RAINBOW') {
      rightIsGhost = true;
  }

  const displayColorLeft = corEsquerda === 'RAINBOW' ? '#FFD700' : corEsquerda;
  const displayColorRight = corDireita === 'RAINBOW' ? '#FFD700' : corDireita;

  // =========================================================================
  // ANIMAÇÃO DE DISPUTA DE ENERGIA
  // =========================================================================
  // -10: P1 (Esquerda) dominou 100% da tela. +10: P2 (Direita) dominou 100%.
  const leftWidth = ropeAnim.interpolate({
    inputRange: [-10, 10],
    outputRange: ['100%', '0%'],
    extrapolate: 'clamp'
  });

  const rightWidth = ropeAnim.interpolate({
    inputRange: [-10, 10],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp'
  });

  const knotPosition = ropeAnim.interpolate({
    inputRange: [-10, 10],
    outputRange: ['100%', '0%'],
    extrapolate: 'clamp'
  });

  // =========================================================================
  // RADAR MATEMÁTICO (TECLADO)
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
    if (valorAtual !== '') {
      socket.emit('tugofwar_answer', { room_id: roomIdRef.current, resposta: valorAtual });
      setResposta('');
    }
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
  }, [tela]);

  // =========================================================================
  // GESTÃO DE SAÍDA SEGURA E SINCRONIZAÇÃO
  // =========================================================================
  const performLeaveMatch = () => {
    if (!hasLeftMatch.current && roomIdRef.current) {
      hasLeftMatch.current = true;
      socket.emit('leave_match', { room_id: roomIdRef.current });
      setActiveMatchData(null);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      const handleBackPress = () => {
        if (tela === 'jogo') { abandonarPartida(); return true; }
        return false;
      };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => backHandler.remove();
    }
  }, [tela]);

  useEffect(() => {
    return () => {
      // Limpeza brutal: se o componente for destruído e o jogo não acabou, avisa o servidor!
      if (tela === 'jogo') performLeaveMatch();
    };
  }, [tela]);

  useEffect(() => {
    if (activeMatchData && activeMatchData.game_type === 'tugofwar') {
      roomIdRef.current = activeMatchData.room_id;
      setIsP1(activeMatchData.is_p1);
      setOponenteNome(activeMatchData.opponentName);
      setOperacao(activeMatchData.initial_op);
      setTela('jogo');
      hasLeftMatch.current = false;
    }
  }, [activeMatchData]);

  useEffect(() => {
    socket.emit('update_status', { status: 'JOGANDO_ONLINE' });

    const onStateUpdate = (data: any) => {
      Animated.spring(ropeAnim, {
        toValue: data.rope_position,
        useNativeDriver: false, // Obrigatório false para animar 'width' e 'left'
        friction: 5,
        tension: 30
      }).start();
    };

    const onNewOp = (data: any) => setOperacao(data.new_op);
    
    const onGameOver = (data: any) => { 
      setGanhador(data.ganhador); 
      setTela('resultado'); 
    };

    const onOpponentDisconnected = () => {
      if (tela === 'jogo') {
        Alert.alert('Fim de Jogo', 'O oponente fugiu do combate!');
        setGanhador(socket.id);
        setTela('resultado');
      }
    };

    const onLobbyLeft = () => {
      // Se a sala for apagada pelo Admin durante o jogo
      performLeaveMatch();
      Alert.alert('Aviso', 'A sala foi encerrada pelo administrador.');
      router.replace('/salas');
    };

    socket.on('tugofwar_state_update', onStateUpdate);
    socket.on('tugofwar_new_op', onNewOp);
    socket.on('game_over', onGameOver);
    socket.on('match_ended', onGameOver);
    socket.on('opponent_disconnected', onOpponentDisconnected);
    socket.on('lobby_left', onLobbyLeft);

    return () => {
      socket.off('tugofwar_state_update', onStateUpdate);
      socket.off('tugofwar_new_op', onNewOp);
      socket.off('game_over', onGameOver);
      socket.off('match_ended', onGameOver);
      socket.off('opponent_disconnected', onOpponentDisconnected);
      socket.off('lobby_left', onLobbyLeft);
      socket.emit('update_status', { status: 'MENU' });
    };
  }, [tela]);

  const abandonarPartida = () => {
    Alert.alert("Desistir", "Tem certeza que deseja recuar da disputa?", [
      { text: "Não", style: "cancel" },
      { text: "Sim", style: "destructive", onPress: () => {
        performLeaveMatch();
        router.back();
      }}
    ]);
  };

  if (tela === 'resultado') {
    const venci = ganhador === socket.id;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{venci ? 'Seu Raio Venceu!' : 'Você Foi Superado!'}</Text>
          <Ionicons name={venci ? 'trophy' : 'sad'} size={90} color={venci ? displayColorLeft : '#888'} />
          <TouchableOpacity style={[styles.btnVoltar, { backgroundColor: venci ? displayColorLeft : '#333' }]} onPress={() => { performLeaveMatch(); router.back(); }}>
            <Text style={[styles.btnVoltarText, { color: venci ? '#000' : '#FFF' }]}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={abandonarPartida} style={styles.btnSair}>
          <Ionicons name="exit-outline" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DISPUTA NEON</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.arena}>
        <View style={styles.playersRow}>
          <View style={styles.playerWrapper}>
             <Text style={[styles.playerName, { color: displayColorLeft, textShadowColor: displayColorLeft, textShadowRadius: 8 }]}>{leftName}</Text>
          </View>
          <View style={styles.playerWrapper}>
             <Text style={[styles.playerName, { color: rightIsGhost ? '#FFF' : displayColorRight, textShadowColor: rightIsGhost ? displayColorRight : 'transparent', textShadowRadius: rightIsGhost ? 10 : 8 }]}>{rightName}</Text>
          </View>
        </View>

        {/* O Tubo de Colisão */}
        <View style={styles.neonTrack}>
           {/* Raio do Jogador 1 (Esquerda) */}
           <Animated.View style={[styles.ropeLeft, { width: leftWidth }]}>
              <BeamSide color={corEsquerda} isLeft={true} isGhost={false} />
           </Animated.View>
           
           {/* Ponto de Impacto Central */}
           <Animated.View style={[styles.ropeKnot, { left: knotPosition }]}>
              <View style={styles.knotCore}>
                 <Ionicons name="flash" size={20} color="#000" />
              </View>
           </Animated.View>

           {/* Raio do Jogador 2 (Direita) */}
           <Animated.View style={[styles.ropeRight, { width: rightWidth }]}>
              <BeamSide color={corDireita} isLeft={false} isGhost={rightIsGhost} />
           </Animated.View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.instruction}>Resolva para empurrar a energia!</Text>
        
        {operacao ? (
          <View style={styles.operationCard}>
            <Text style={styles.operationText}>{operacao.texto}</Text>
          </View>
        ) : (
          <View style={[styles.operationCard, { backgroundColor: '#333' }]}>
             <Text style={styles.operationText}>---</Text>
          </View>
        )}

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
  
  arena: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  playersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 10 },
  playerWrapper: { alignItems: 'center' },
  playerName: { fontWeight: '900', fontSize: 18, textTransform: 'uppercase' },

  neonTrack: { height: 26, flexDirection: 'row', backgroundColor: '#000', borderRadius: 13, borderWidth: 1, borderColor: '#222', position: 'relative', marginTop: 10 },
  ropeLeft: { height: '100%', borderTopLeftRadius: 13, borderBottomLeftRadius: 13, overflow: 'hidden' },
  ropeRight: { height: '100%', borderTopRightRadius: 13, borderBottomRightRadius: 13, overflow: 'hidden' },
  
  ropeKnot: { position: 'absolute', top: -12, width: 50, height: 50, marginLeft: -25, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  knotCore: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#FFF', shadowRadius: 15, shadowOpacity: 1, elevation: 15 },

  panel: { backgroundColor: '#1a1a2e', padding: 25, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', elevation: 10, borderTopWidth: 1, borderTopColor: '#333' },
  instruction: { color: '#AAA', fontSize: 14, marginBottom: 15, fontWeight: 'bold' },
  operationCard: { backgroundColor: '#4169E1', paddingVertical: 20, paddingHorizontal: 50, borderRadius: 16, marginBottom: 15, elevation: 4 },
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
  resultadoTitle: { fontSize: 32, fontWeight: '900', color: '#FFF', marginBottom: 30, textAlign: 'center' },
  btnVoltar: { marginTop: 40, paddingVertical: 16, paddingHorizontal: 35, borderRadius: 16, elevation: 4 },
  btnVoltarText: { fontSize: 18, fontWeight: '900' }
});
