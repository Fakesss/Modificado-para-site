import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, Alert, Platform, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { socket, activeMatchData, setActiveMatchData } from '../src/services/socket';
import { useAuth } from '../src/context/AuthContext';
import * as api from '../src/services/api';

const { width } = Dimensions.get('window');

// Necessário para poder animar a cor da fita perfeitamente
const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

// =========================================================================
// O TIME ANIMADO (3 Personagens)
// =========================================================================
const AnimatedTeam = ({ isLeft, config, teamState }: any) => {
  const animVal = useRef(new Animated.Value(0)).current;
  const adminAnimColor = useRef(new Animated.Value(0)).current;

  // Animação de puxar a corda
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

  // Animação contínua da linha/fita do Administrador mudando de cor
  useEffect(() => {
    if (config.isRainbow && config.rainbowColors && config.rainbowColors.length > 0) {
      Animated.loop(
        Animated.timing(adminAnimColor, {
          toValue: config.rainbowColors.length,
          duration: config.rainbowColors.length * 1200, // 1.2 segundos para cada cor
          easing: Easing.linear,
          useNativeDriver: false, // Interpolação de cor exige false
        })
      ).start();
    }
  }, [config.isRainbow, config.rainbowColors]);

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

  let outlineColor: any = 'transparent';
  if (config.isRainbow && config.rainbowColors && config.rainbowColors.length > 0) {
    const cycle = [...config.rainbowColors, config.rainbowColors[0]];
    outlineColor = adminAnimColor.interpolate({
      inputRange: cycle.map((_, i) => i),
      outputRange: cycle
    });
  }

  const color = config.isGhost ? '#FFFFFF' : config.core;
  const shadow = config.glow;

  const glowStyle: any = Platform.OS === 'web' 
    ? { filter: `drop-shadow(0px 0px 4px ${shadow})` }
    : { textShadowColor: shadow, textShadowRadius: 6 };

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
          
          {/* CORPO PRINCIPAL (Sempre será branco para o Admin) */}
          <Ionicons 
            name="body" 
            size={55} 
            color={config.isRainbow ? '#FFFFFF' : color} 
            style={!config.isRainbow ? glowStyle : undefined} 
          />

          {/* A FITA/LINHA NEON EXATA DA SILHUETA DO ADMIN */}
          {config.isRainbow && (
            <AnimatedIcon
              name="body-outline"
              size={55}
              style={{
                position: 'absolute',
                color: outlineColor,
              }}
            />
          )}

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

export default function CaboDeGuerraOnline() {
  const { user } = useAuth();
  const router = useRouter();

  const [tela, setTela] = useState<'jogo' | 'resultado'>('jogo');
  const [isP1, setIsP1] = useState(true);
  const [oponenteNome, setOponenteNome] = useState('Oponente');
  const [operacao, setOperacao] = useState<{ texto: string, resposta: number } | null>(null);
  const [resposta, setResposta] = useState('');
  const [ganhador, setGanhador] = useState<string | null>(null);
  
  const [leftState, setLeftState] = useState('idle');
  const [rightState, setRightState] = useState('idle');

  const [equipesDb, setEquipesDb] = useState<any[]>([]);

  const roomIdRef = useRef<string>('');
  const hasLeftMatch = useRef(false);
  const isGameOver = useRef(false);
  const ultimaPosicao = useRef(0);
  const ropeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api.getEquipes().then(data => setEquipesDb(data)).catch(console.error);
  }, []);

  const getTeamConfig = (equipeId: string, perfil: string, email: string, isLocalPlayer: boolean, opponentEquipeId: string) => {
    if (perfil === 'ADMIN' || perfil?.includes('admin') || email === 'danielprofessormatematica@gmail.com') {
        const cores = equipesDb.length > 0 ? equipesDb.map(e => e.cor) : ['#00BFFF', '#FFD700', '#32CD32'];
        return { isRainbow: true, core: '#FFFFFF', rainbowColors: cores, isGhost: false };
    }
  
    const equipeEncontrada = equipesDb.find(e => e.id === equipeId);
    const teamColor = equipeEncontrada ? equipeEncontrada.cor : '#00BFFF';
  
    if (!isLocalPlayer && equipeId && equipeId === opponentEquipeId) {
        return { isRainbow: false, core: '#FFFFFF', glow: teamColor, isGhost: true };
    }
  
    return { isRainbow: false, core: teamColor, glow: teamColor, isGhost: false };
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
  // GESTÃO DE SAÍDA SEGURA
  // =========================================================================
  const performLeaveMatch = () => {
    if (!hasLeftMatch.current && roomIdRef.current) {
      hasLeftMatch.current = true;
      socket.emit('leave_match', { room_id: roomIdRef.current });
      setActiveMatchData(null);
    }
  };

  const abandonarPartida = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Tem certeza que deseja abandonar a corda? Oponente vencerá!")) {
        performLeaveMatch();
        router.replace('/salas');
      }
    } else {
      Alert.alert("Recuar", "Tem certeza que deseja abandonar a corda?", [
        { text: "Não", style: "cancel" },
        { text: "Sim", style: "destructive", onPress: () => { performLeaveMatch(); router.replace('/salas'); }}
      ]);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      const handleBackPress = () => { if (tela === 'jogo') { abandonarPartida(); return true; } return false; };
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      return () => backHandler.remove();
    }
  }, [tela]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleUnload = () => performLeaveMatch();
      window.addEventListener('beforeunload', handleUnload);
      return () => window.removeEventListener('beforeunload', handleUnload);
    }
  }, []);

  useEffect(() => { return () => { if (tela === 'jogo') performLeaveMatch(); }; }, [tela]);

  // =========================================================================
  // SINCRONIZAÇÃO COM O SERVIDOR E CORREÇÃO DE LADOS
  // =========================================================================
  useEffect(() => {
    if (activeMatchData && activeMatchData.game_type === 'tugofwar') {
      roomIdRef.current = activeMatchData.room_id;
      setIsP1(activeMatchData.is_p1);
      setOponenteNome(activeMatchData.opponentName);
      setOperacao(activeMatchData.initial_op);
      setTela('jogo');
      hasLeftMatch.current = false;
      isGameOver.current = false;
      ultimaPosicao.current = 0;
    }
  }, [activeMatchData]);

  useEffect(() => {
    socket.emit('update_status', { status: 'JOGANDO_ONLINE' });

    const onStateUpdate = (data: any) => {
      if (isGameOver.current) return; 
      
      const diff = data.rope_position - ultimaPosicao.current;
      
      if (diff !== 0) {
         const iPulled = isP1 ? (diff > 0) : (diff < 0);
         
         if (iPulled) {
            setRightState('pull');
            setTimeout(() => { if(!isGameOver.current) setRightState('idle') }, 300);
         } else {
            setLeftState('pull');
            setTimeout(() => { if(!isGameOver.current) setLeftState('idle') }, 300);
         }
      }
      
      ultimaPosicao.current = data.rope_position;

      const visualTarget = isP1 ? data.rope_position : (data.rope_position * -1);
      Animated.spring(ropeAnim, { toValue: visualTarget, useNativeDriver: false, friction: 5, tension: 30 }).start();
    };

    const onNewOp = (data: any) => setOperacao(data.new_op);
    
    const onGameOver = (data: any) => { 
      isGameOver.current = true;
      const amIWinner = data.ganhador === socket.id;

      setLeftState(amIWinner ? 'lose' : 'win');
      setRightState(amIWinner ? 'win' : 'lose');

      setTimeout(() => {
         setGanhador(data.ganhador); 
         setTela('resultado'); 
      }, 2000); 
    };

    const onOpponentDisconnected = () => {
      if (tela === 'jogo') {
        isGameOver.current = true;
        setLeftState('lose'); setRightState('win'); 
        setTimeout(() => {
            Alert.alert('Vitória!', 'A equipe adversária fugiu da batalha!');
            setGanhador(socket.id);
            setTela('resultado');
        }, 1500);
      }
    };

    const onLobbyLeft = () => {
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
      socket.off('tugofwar_state_update'); socket.off('tugofwar_new_op');
      socket.off('game_over'); socket.off('match_ended');
      socket.off('opponent_disconnected'); socket.off('lobby_left');
      socket.emit('update_status', { status: 'MENU' });
    };
  }, [tela, isP1]);

  const meuTimeId = user?.equipeId || '';
  const meuPerfil = user?.perfil || 'ALUNO';
  const meuEmail = user?.email || '';

  const timeOponenteId = activeMatchData?.opponentEquipeId || ''; 
  const roleOponente = activeMatchData?.opponentPerfil || 'ALUNO';

  const leftConfig = getTeamConfig(timeOponenteId, roleOponente, '', false, meuTimeId);
  const rightConfig = getTeamConfig(meuTimeId, meuPerfil, meuEmail, true, timeOponenteId);

  const knotPosition = ropeAnim.interpolate({ inputRange: [-10, 10], outputRange: ['10%', '90%'], extrapolate: 'clamp' });

  if (tela === 'resultado') {
    const venci = ganhador === socket.id;
    const finalColor = venci ? (rightConfig.isRainbow ? (rightConfig.rainbowColors && rightConfig.rainbowColors.length > 0 ? rightConfig.rainbowColors[0] : '#FFD700') : rightConfig.core) : '#888';
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{venci ? 'Sua Equipe Venceu!' : 'Vocês Foram Puxados!'}</Text>
          <Ionicons name={venci ? 'trophy' : 'sad'} size={90} color={finalColor} style={{ marginBottom: 20 }} />
          <AnimatedTeam isLeft={!venci} config={venci ? rightConfig : leftConfig} teamState="win" />
          <TouchableOpacity style={[styles.btnVoltar, { backgroundColor: finalColor === '#888' ? '#333' : finalColor }]} onPress={() => { performLeaveMatch(); router.replace('/salas'); }}>
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
        <Text style={styles.headerTitle}>CABO DE GUERRA</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.arena}>
        <View style={styles.namesRow}>
           {/* Removi o brilho fantasma do nome do admin para manter o padrão sem blur */}
           <Text style={[styles.playerName, { color: leftConfig.isRainbow ? '#FFFFFF' : leftConfig.core, textShadowColor: leftConfig.glow || '#FFFFFF', textShadowRadius: 10 }]}>{oponenteNome}</Text>
           <Text style={[styles.playerName, { color: rightConfig.isGhost ? '#FFF' : rightConfig.core, textShadowColor: rightConfig.glow || '#FFFFFF', textShadowRadius: 10 }]}>Você</Text>
        </View>

        <View style={styles.field}>
            <View style={styles.teamLeftZone}>
               <AnimatedTeam isLeft={true} config={leftConfig} teamState={leftState} />
            </View>

            <View style={styles.teamRightZone}>
               <AnimatedTeam isLeft={false} config={rightConfig} teamState={rightState} />
            </View>

            <View style={styles.ropeLine} />
            <Animated.View style={[styles.ropeKnot, { left: knotPosition }]}>
               <View style={styles.knotCore} />
            </Animated.View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.instruction}>Resolva para puxar a corda!</Text>
        
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
