import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { socket, activeMatchData, setActiveMatchData } from '../src/services/socket';

const { width } = Dimensions.get('window');

// =========================================================================
// O NOVO AVATAR ANIMADO (Substitui as Sprites)
// =========================================================================
const AvatarNeon = ({ nome, isEsquerda, isPuxando, cor }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isPuxando) {
      // Efeito de pulso e tremor de esforço
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: isEsquerda ? -10 : 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
      ]).start();
    }
  }, [isPuxando]);

  return (
    <View style={styles.playerWrapper}>
      <Text style={[styles.playerName, { color: cor }]}>{nome}</Text>
      <Animated.View style={[
        styles.avatarCircle,
        { borderColor: cor, shadowColor: cor, transform: [{ scale: scaleAnim }, { translateX: shakeAnim }] }
      ]}>
        <Ionicons name="person" size={50} color={cor} />
      </Animated.View>
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
  const router = useRouter();

  const [tela, setTela] = useState<'jogo' | 'resultado'>('jogo');
  const [isP1, setIsP1] = useState(true);
  const [oponenteNome, setOponenteNome] = useState('Oponente');
  const [operacao, setOperacao] = useState<{ texto: string, resposta: number } | null>(null);
  const [resposta, setResposta] = useState('');
  const [ganhador, setGanhador] = useState<string | null>(null);
  const [puxandoEsq, setPuxandoEsq] = useState(false);
  const [puxandoDir, setPuxandoDir] = useState(false);

  const roomIdRef = useRef<string>('');
  const ropeAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (activeMatchData && activeMatchData.game_type === 'tugofwar') {
      roomIdRef.current = activeMatchData.room_id;
      setIsP1(activeMatchData.is_p1);
      setOponenteNome(activeMatchData.opponentName);
      setOperacao(activeMatchData.initial_op);
      setTela('jogo');
    }
  }, [activeMatchData]);

  useEffect(() => {
    socket.emit('update_status', { status: 'JOGANDO_ONLINE' });

    let ultimaPosicao = 0;

    const onStateUpdate = (data: any) => {
      // Gatilho visual de esforço: quem puxou a corda agora?
      if (data.rope_position > ultimaPosicao) {
         setPuxandoEsq(true); setTimeout(() => setPuxandoEsq(false), 200);
      } else if (data.rope_position < ultimaPosicao) {
         setPuxandoDir(true); setTimeout(() => setPuxandoDir(false), 200);
      }
      ultimaPosicao = data.rope_position;

      const limiteFisico = (width / 2) - 50; 
      const targetVal = (data.rope_position / 10) * limiteFisico;
      
      Animated.spring(ropeAnim, {
        toValue: targetVal,
        useNativeDriver: true,
        friction: 4,
        tension: 8
      }).start();
    };

    const onNewOp = (data: any) => setOperacao(data.new_op);
    const onGameOver = (data: any) => { setGanhador(data.ganhador); setTela('resultado'); };

    const onOpponentDisconnected = () => {
      Alert.alert('Fim de Jogo', 'O oponente fugiu do combate!');
      setGanhador(socket.id);
      setTela('resultado');
    };

    socket.on('tugofwar_state_update', onStateUpdate);
    socket.on('tugofwar_new_op', onNewOp);
    socket.on('game_over', onGameOver);
    socket.on('opponent_disconnected', onOpponentDisconnected);
    socket.on('match_ended', onOpponentDisconnected);

    return () => {
      socket.off('tugofwar_state_update', onStateUpdate);
      socket.off('tugofwar_new_op', onNewOp);
      socket.off('game_over', onGameOver);
      socket.off('opponent_disconnected', onOpponentDisconnected);
      socket.off('match_ended', onOpponentDisconnected);
      socket.emit('update_status', { status: 'MENU' });
    };
  }, []);

  const abandonarPartida = () => {
    Alert.alert("Desistir", "Tem certeza que deseja abandonar a corda?", [
      { text: "Não", style: "cancel" },
      { text: "Sim", style: "destructive", onPress: () => {
        socket.emit('leave_match', { room_id: roomIdRef.current });
        setActiveMatchData(null);
        router.back();
      }}
    ]);
  };

  if (tela === 'resultado') {
    const venci = ganhador === socket.id;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{venci ? 'Você Puxou Mais Forte!' : 'Você Perdeu!'}</Text>
          <Ionicons name={venci ? 'trophy' : 'sad'} size={90} color={venci ? '#FFD700' : '#888'} />
          <TouchableOpacity style={styles.btnVoltar} onPress={() => { setActiveMatchData(null); router.back(); }}>
            <Text style={styles.btnVoltarText}>Voltar ao Menu</Text>
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
        <View style={styles.playersRow}>
          
          <AvatarNeon 
            nome={isP1 ? 'Você' : oponenteNome} 
            isEsquerda={true} 
            isPuxando={puxandoEsq} 
            cor={isP1 ? '#00FFFF' : '#FFA500'} 
          />

          <AvatarNeon 
            nome={!isP1 ? 'Você' : oponenteNome} 
            isEsquerda={false} 
            isPuxando={puxandoDir} 
            cor={!isP1 ? '#00FFFF' : '#FFA500'} 
          />

        </View>

        <View style={styles.ropeContainer}>
          <View style={styles.rope} />
          <View style={styles.ropeCenterMark} />
          <Animated.View style={[styles.flagContainer, { transform: [{ translateX: ropeAnim }] }]}>
            <Ionicons name="flag" size={44} color="#FF4444" style={{ transform: [{ rotate: '-10deg' }] }} />
          </Animated.View>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.instruction}>Resolva as contas para puxar a corda!</Text>
        
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
  headerTitle: { color: '#FFD700', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  
  arena: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  playersRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-end' },
  
  playerWrapper: { alignItems: 'center', zIndex: 2 },
  playerName: { fontWeight: '900', fontSize: 16, textTransform: 'uppercase', marginBottom: 10 },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 10 },

  ropeContainer: { height: 80, justifyContent: 'center', alignItems: 'center', position: 'relative', marginTop: -60, zIndex: 1 },
  rope: { position: 'absolute', width: '100%', height: 12, backgroundColor: '#8B4513', borderRadius: 6, elevation: 3 },
  ropeCenterMark: { position: 'absolute', width: 4, height: 24, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 },
  flagContainer: { position: 'absolute', zIndex: 10, paddingBottom: 35 },

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
  btnVoltar: { marginTop: 40, backgroundColor: '#FFD700', paddingVertical: 16, paddingHorizontal: 35, borderRadius: 16, elevation: 4 },
  btnVoltarText: { fontSize: 18, fontWeight: '900', color: '#000' }
});
