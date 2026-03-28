import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Alert, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { socket, activeMatchData, setActiveMatchData } from '../src/services/socket';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.62; 
const CARD_WIDTH = 105;
const DROP_LIMIT = GAME_AREA_HEIGHT - 30; 

const Particula = ({ char }: { char: string }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [randomX] = useState((Math.random() - 0.5) * 200); 
  const [randomY] = useState((Math.random() - 0.5) * 250 - 80); 
  const [randomRot] = useState((Math.random() - 0.5) * 720); 
  
  useEffect(() => { 
    Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }).start(); 
  }, []);
  
  return (
    <Animated.Text style={[styles.particulaTexto, {
        transform: [ 
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomX] }) }, 
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomY] }) }, 
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${randomRot}deg`] }) }, 
          { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1.8, 0] }) } 
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })
      }]}>
      {char}
    </Animated.Text>
  );
};

const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => {
  const lastPress = useRef(0);
  return (
    <Pressable style={({ pressed }) => [styles.tecla, styleExtra, pressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]}
      onPressIn={() => { 
        const now = Date.now(); 
        if (now - lastPress.current > 150) { 
          lastPress.current = now; 
          onPress(valor); 
        } 
      }}>
      {children}
    </Pressable>
  );
};

export default function ArcadeMultiplayer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [tela, setTela] = useState<'jogo' | 'resultado'>('jogo');
  const [modo, setModo] = useState<'multi' | 'espectador'>('multi');
  
  const [pontos, setPontos] = useState(0);
  const [vidas, setVidas] = useState(5); 
  const [pontosOponente, setPontosOponente] = useState(0);
  const [vidasOponente, setVidasOponente] = useState(5);
  
  const [oponenteNome, setOponenteNome] = useState('Oponente');
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [meuStatus, setMeuStatus] = useState<'vivo' | 'morto'>('vivo');
  const [ganhador, setGanhador] = useState<string | null>(null);
  
  const roomIdRef = useRef<string>('');
  const [resposta, setResposta] = useState('');
  const [operacoes, setOperacoes] = useState<any[]>([]); 
  const [corLaserPersonalizada, setCorLaserPersonalizada] = useState('#32CD32');

  const filaMultiplayerRef = useRef<any[]>([]); 
  const operacoesAtuaisRef = useRef<any[]>([]);
  const operacoesListRef = useRef<any[]>([]); 
  
  const rodadaRef = useRef(1);
  const jogoAtivoRef = useRef(false);
  const isHostRef = useRef(false);
  const modoMatematicaRef = useRef('misto');
  const meuStatusRef = useRef<'vivo' | 'morto'>('vivo');
  const modoRef = useRef<'multi' | 'espectador'>('multi');
  
  const spawnTimer = useRef<any>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [lasersAtivos, setLasersAtivos] = useState<any[]>([]);
  const [explosoes, setExplosoes] = useState<any[]>([]); 

  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);

  useEffect(() => {
    socket.emit('update_status', { status: 'JOGANDO_ONLINE' });

    const onArcadeNewBatch = (data: any) => {
        filaMultiplayerRef.current.push(...data.ops);
        if (modoRef.current === 'espectador' && filaMultiplayerRef.current.length > 0 && !jogoAtivoRef.current) {
            jogoAtivoRef.current = true;
            iniciarLoopSpawner();
        }
    };

    const onArcadeOpDestroyed = (data: any) => {
        const { op_id, winner_sid, pontos: novosPontos } = data;
        const opInfo = operacoesListRef.current.find(o => o.chaveOriginal === op_id);
        
        if (modoRef.current === 'espectador') {
            const sids = Object.keys(novosPontos);
            setPontos(novosPontos[sids[0]]);
            setPontosOponente(novosPontos[sids[1]]);
        } else {
            const mySid = socket.id;
            setPontos(novosPontos[mySid]);
            const oppSid = Object.keys(novosPontos).find(sid => sid !== mySid);
            if(oppSid) setPontosOponente(novosPontos[oppSid]);
        }

        if (opInfo) {
            opInfo.y.stopAnimation();
            const isMe = winner_sid === socket.id;
            if (modoRef.current === 'espectador') {
                const playerIndex = Object.keys(novosPontos).indexOf(winner_sid);
                dispararLaserUnico(opInfo, true, false, true, playerIndex);
            } else {
                dispararLaserUnico(opInfo, true, isMe, false, 0);
            }
            
            // Dá 300ms para a animação do laser bater antes de eliminar a conta
            setTimeout(() => {
                setOperacoes(prev => prev.filter(o => o.chaveOriginal !== op_id));
                operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chaveOriginal !== op_id);
            }, 300);
        }
    };

    const onArcadeStateUpdate = (data: any) => {
        if (modoRef.current === 'espectador') {
            const sids = Object.keys(data.vidas);
            setVidas(data.vidas[sids[0]]);
            setVidasOponente(data.vidas[sids[1]]);
        } else {
            const mySid = socket.id;
            const newMyLives = data.vidas[mySid];
            setVidas(newMyLives);
            const oppSid = Object.keys(data.vidas).find(sid => sid !== mySid);
            if(oppSid) setVidasOponente(data.vidas[oppSid]);

            if (newMyLives <= 0 && meuStatusRef.current === 'vivo') {
                setMeuStatus('morto');
                meuStatusRef.current = 'morto';
                setResposta('');
            }
        }
    };

    const onGameOver = (data: any) => {
        setGanhador(data.ganhador);
        gameOver();
    };

    const onOpponentDisconnected = () => {
        Alert.alert("Fim de Jogo", "Um dos jogadores abandonou a partida.");
        setGanhador(modoRef.current === 'espectador' ? 'Empate' : socket.id);
        gameOver();
    };

    const onSpectatorJoined = (data: any) => {
        const sids = Object.keys(data.names);
        setPlayer1Name(data.names[sids[0]]);
        setOponenteNome(data.names[sids[1]]);
        setVidas(data.vidas[sids[0]]);
        setVidasOponente(data.vidas[sids[1]]);
        setPontos(data.pontos[sids[0]]);
        setPontosOponente(data.pontos[sids[1]]);
    };

    socket.on('arcade_new_batch', onArcadeNewBatch);
    socket.on('arcade_op_destroyed', onArcadeOpDestroyed);
    socket.on('arcade_state_update', onArcadeStateUpdate);
    socket.on('game_over', onGameOver);
    socket.on('opponent_disconnected', onOpponentDisconnected);
    socket.on('match_ended', onOpponentDisconnected);
    socket.on('spectator_joined', onSpectatorJoined);

    return () => {
        socket.off('arcade_new_batch', onArcadeNewBatch);
        socket.off('arcade_op_destroyed', onArcadeOpDestroyed);
        socket.off('arcade_state_update', onArcadeStateUpdate);
        socket.off('game_over', onGameOver);
        socket.off('opponent_disconnected', onOpponentDisconnected);
        socket.off('match_ended', onOpponentDisconnected);
        socket.off('spectator_joined', onSpectatorJoined);
        socket.emit('update_status', { status: 'MENU' });
    };
  }, []);

  useEffect(() => {
      if (activeMatchData && activeMatchData.game_type === 'arcade') {
          setupMultiplayerMatch(activeMatchData);
      } else if (params.spectate) {
          setupSpectatorMode(params.spectate as string);
      }
  }, [activeMatchData, params.spectate]);

  const setupMultiplayerMatch = (data: any) => {
      setModo('multi'); 
      modoRef.current = 'multi';
      
      modoMatematicaRef.current = data.modo_operacao || 'misto';
      roomIdRef.current = data.room_id;
      setOponenteNome(data.opponentName);
      
      isHostRef.current = data.is_host; 

      setVidas(5); setVidasOponente(5);
      setPontos(0); setPontosOponente(0);
      setMeuStatus('vivo');
      meuStatusRef.current = 'vivo';

      filaMultiplayerRef.current = [];
      setOperacoes([]); setExplosoes([]); setResposta('');
      operacoesAtuaisRef.current = []; rodadaRef.current = 1;
      
      setTela('jogo');
      jogoAtivoRef.current = true;

      if (data.is_host) { gerarEnviarBatchMultiplayer(data.modo_operacao || 'misto'); }
      setTimeout(() => { iniciarLoopSpawner(); }, 1000);
  };

  const setupSpectatorMode = (roomId: string) => {
      setModo('espectador'); 
      modoRef.current = 'espectador';
      
      roomIdRef.current = roomId;
      setVidas(5); setVidasOponente(5);
      setPontos(0); setPontosOponente(0);
      filaMultiplayerRef.current = [];
      setOperacoes([]); setExplosoes([]);
      
      socket.emit('spectate_match', { room_id: roomId });
      setTela('jogo');
  };

  const abandonarPartida = () => {
      const msg = modoRef.current === 'espectador' ? "Deseja parar de assistir?" : "Deseja abandonar a partida? Você perderá o jogo.";
      
      const executarSaida = () => {
          if (modoRef.current === 'espectador') socket.emit('leave_spectator', { room_id: roomIdRef.current });
          else if (modoRef.current === 'multi') socket.emit('leave_match', { room_id: roomIdRef.current });
          setActiveMatchData(null);
          socket.emit('update_status', { status: 'MENU' });
          router.back();
      };

      if (Platform.OS === 'web') {
          if (window.confirm(msg)) executarSaida();
      } else {
          Alert.alert("Sair", msg, [
              { text: "Não", style: "cancel" },
              { text: "Sim", style: "destructive", onPress: executarSaida }
          ]);
      }
  };

  const gerarEnviarBatchMultiplayer = (modoEscolhido: string) => {
      const novasOps = [];
      const r = (max: number) => Math.floor(Math.random() * max);
      let opsPermitidas = ['+'];
      
      if (modoEscolhido === 'misto') {
        if (rodadaRef.current >= 2) opsPermitidas.push('-');
        if (rodadaRef.current >= 4) opsPermitidas.push('×');
        if (rodadaRef.current >= 6) opsPermitidas.push('÷');
        if (rodadaRef.current >= 8) opsPermitidas.push('^');
        if (rodadaRef.current >= 10) opsPermitidas.push('√');
      } else {
        opsPermitidas = [modoEscolhido==='soma'?'+': modoEscolhido==='subtracao'?'-': modoEscolhido==='multiplicacao'?'×': modoEscolhido==='divisao'?'÷': modoEscolhido==='potenciacao'?'^':'√'];
      }

      let numMax = 8 + (rodadaRef.current * 2);
      let multMax = 5 + Math.floor(rodadaRef.current / 1.5); 

      for(let i=0; i<15; i++) {
          const op = opsPermitidas[r(opsPermitidas.length)];
          let n1=0, n2:any=0, res=0, txt='';
          switch(op) {
            case '+': n1=r(numMax)+1; n2=r(numMax)+1; res=n1+n2; txt=`${n1} + ${n2}`; break;
            case '-': n1=r(numMax*1.5)+5; n2=r(n1)+1; res=n1-n2; txt=`${n1} - ${n2}`; break;
            case '×': n1=r(multMax)+2; n2=r(multMax)+2; res=n1*n2; txt=`${n1} × ${n2}`; break;
            case '÷': n2=r(multMax)+2; res=r(multMax + 4)+1; n1=n2*res; txt=`${n1} ÷ ${n2}`; break;
            case '^': 
              let maxBase = Math.min(5 + Math.floor(rodadaRef.current / 2), 20); n1 = r(maxBase - 1) + 2; let maxExp = 2;
              if (n1 === 2) maxExp = Math.min(3 + Math.floor(rodadaRef.current / 3), 7); else if (n1 === 3) maxExp = Math.min(2 + Math.floor(rodadaRef.current / 4), 4); else if (n1 <= 5) maxExp = Math.min(2 + Math.floor(rodadaRef.current / 10), 3);
              n2 = r(maxExp - 1) + 2; res = Math.pow(n1, n2); const s:any = {2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷'}; txt = `${n1}${s[n2] || '^'+n2}`; break;
            case '√': res=r(multMax+4)+2; n1=res*res; n2=''; txt=`√${n1}`; break;
          }
          const speed = Math.max(3500, 10000 - (rodadaRef.current * 200));
          novasOps.push({ id: Math.random().toString(), texto: txt, resposta: res, speed });
      }
      filaMultiplayerRef.current.push(...novasOps);
      socket.emit('arcade_sync_batch', { room_id: roomIdRef.current, ops: novasOps });
      rodadaRef.current += 1;
  };

  const iniciarLoopSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const loop = () => {
      if (!jogoAtivoRef.current) return;
      if (filaMultiplayerRef.current.length > 0) {
          const maxOps = modoRef.current === 'espectador' ? 15 : Math.min(15, 3 + Math.floor(pontos / 150)); 
          if (operacoesListRef.current.length < maxOps) spawnarQuestao();
      }
      
      if (isHostRef.current && filaMultiplayerRef.current.length < 5) {
          gerarEnviarBatchMultiplayer(modoMatematicaRef.current);
      }
      spawnTimer.current = setTimeout(loop, Math.max(800, 2500 - (rodadaRef.current * 100)));
    };
    loop();
  };

  const spawnarQuestao = () => {
    if (filaMultiplayerRef.current.length === 0) return;
    const dados = filaMultiplayerRef.current.shift();
    
    let numLanes = 3;
    if (rodadaRef.current >= 4) numLanes = 4; if (rodadaRef.current >= 7) numLanes = 5; if (rodadaRef.current >= 10) numLanes = 6;
    const laneWidth = width / numLanes; const baseScale = 3 / numLanes; const minDropDistance = 0.20; 
    
    const pistasDisponiveis = Array.from({length: numLanes}, (_, i) => i).filter(p => {
      const opsNaPista = operacoesAtuaisRef.current.filter(o => o.lane === p);
      if (opsNaPista.length === 0) return true;
      const menorY = Math.min(...opsNaPista.map(o => (o.y as any)._value || 0));
      return menorY > (DROP_LIMIT * minDropDistance);
    });
    
    if (pistasDisponiveis.length === 0) {
        filaMultiplayerRef.current.unshift(dados); 
        return;
    }

    const lane = pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
    const id = Math.random().toString();
    operacoesAtuaisRef.current.push({ lane, y: 0, chaveOriginal: dados.chave || dados.id, chave: id, missed: false });

    const posX = (lane * laneWidth) + (laneWidth / 2) - (CARD_WIDTH / 2);
    const yValue = new Animated.Value(0);
    
    yValue.addListener(({ value }: any) => {
      const ref = operacoesAtuaisRef.current.find((o:any) => o.chave === id);
      if (ref) {
         ref.y = value;
         if (value >= DROP_LIMIT && !ref.missed) {
            ref.missed = true;
            processarErro(id);
         }
      }
    });

    const novaOp = { 
      id, chaveOriginal: dados.chave || dados.id, resposta: dados.resposta, textoTela: dados.texto, y: yValue, speed: dados.speed, posX, lane, tipoEspecial: 'nenhum', baseScale,
      opacity: new Animated.Value(1), scale: new Animated.Value(baseScale) 
    };

    setOperacoes(prev => [...prev, novaOp]); 
    
    setTimeout(() => {
        if (jogoAtivoRef.current) {
            const realDuration = novaOp.speed * ((height + 100) / DROP_LIMIT);
            Animated.timing(novaOp.y, { toValue: height + 100, duration: realDuration, useNativeDriver: true }).start();
        }
    }, 50); 
  };

  const processarErro = useCallback((opId: string) => {
    if (opId === 'nenhum') return; 

    const opInfo = operacoesListRef.current.find(o => o.id === opId);
    if (!opInfo) return;
    opInfo.y.stopAnimation();

    const expId = Math.random().toString();
    setExplosoes(prev => [...prev, { id: expId, x: opInfo.posX, y: DROP_LIMIT, texto: opInfo.textoTela, corEspecial: false }]);
    setTimeout(() => { setExplosoes(prev => prev.filter(e => e.id !== expId)); }, 800);

    if (meuStatusRef.current === 'vivo' && modoRef.current !== 'espectador') {
        socket.emit('arcade_miss', { room_id: roomIdRef.current, op_id: opInfo.chaveOriginal });
    }

    setOperacoes(prev => prev.filter(o => o.id !== opId));
    operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opId);
  }, []);

  const gameOver = () => { 
    jogoAtivoRef.current = false;
    if (spawnTimer.current) clearTimeout(spawnTimer.current); 
    setOperacoes([]); setExplosoes([]); setTela('resultado'); 
  };

  const verificarResposta = () => {
    if (!jogoAtivoRef.current || isNaN(parseInt(resposta)) || meuStatusRef.current === 'morto') return;
    const alvo = operacoes.find(op => op.resposta === parseInt(resposta));

    if (alvo) {
      alvo.y.stopAnimation(); 
      socket.emit('arcade_answer', { room_id: roomIdRef.current, op_id: alvo.chaveOriginal });
    } else { 
      dispararLaserUnico(null, false, true, false, 0); 
    }
    setResposta('');
  };

  const dispararLaserUnico = (alvo: any, acertou: boolean, isMe: boolean, isSpectator: boolean, playerIndex: number) => {
    let originX = width / 2;
    let originY = DROP_LIMIT + 30;
    let targetX = width / 2;
    let targetY = 0; 

    if (acertou && alvo) {
        targetX = alvo.posX + CARD_WIDTH / 2;
        targetY = (alvo.y as any)._value + 20;
    } 

    const dx = targetX - originX;
    const dy = targetY - originY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + Math.PI / 2; 

    let cor = isMe ? corLaserPersonalizada : '#FF4444'; 
    if (isSpectator) cor = playerIndex === 1 ? '#FF4444' : corLaserPersonalizada; 
    if (!acertou) cor = '#FF4444'; 

    const midX = originX + dx / 2;
    const midY = originY + dy / 2;
    
    const laserInfo = { x: midX, y: midY, h: distance, angle: `${angle}rad`, cor };
    setLasersAtivos([laserInfo]);
    
    laserAnim.setValue(1);
    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 0, duration: 300, useNativeDriver: true }), 
      ...(alvo ? [ 
        Animated.timing(alvo.scale, { toValue: alvo.baseScale * 1.4, duration: 150, useNativeDriver: true }), 
        Animated.timing(alvo.opacity, { toValue: 0, duration: 150, useNativeDriver: true }) 
      ] : [])
    ]).start(() => setLasersAtivos([]));
    
    if (!alvo) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }), 
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }), 
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    }
  };

  if (tela === 'resultado') {
    let titulo = ganhador === socket.id ? 'Você Venceu!' : (ganhador === 'Empate' ? 'Empate Técnico!' : 'Você Perdeu!');
    if (modoRef.current === 'espectador') titulo = 'Partida Encerrada';

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{titulo}</Text>
          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{pontos}</Text>
            <Text style={styles.resultadoLabel}>Seus Pontos Totais</Text>
          </View>
          <TouchableOpacity style={styles.jogarNovamenteButton} onPress={() => { 
              setActiveMatchData(null); 
              socket.emit('update_status', { status: 'MENU' });
              router.back(); 
          }}>
            <Ionicons name="home" size={22} color="#000" />
            <Text style={styles.jogarNovamenteText}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {modoRef.current === 'espectador' && (
        <View style={styles.badgeEspectador}>
          <Text style={styles.textoBadgeEspectador}>👁 ASSISTINDO AO VIVO</Text>
        </View>
      )}

      {/* Header do Jogo */}
      <View style={styles.headerContainer}>
        <View>
          <Text style={[styles.nomeJogador, { color: modoRef.current === 'espectador' ? '#32CD32' : '#32CD32' }]}>
            {modoRef.current === 'espectador' ? player1Name : 'Você'}
          </Text>
          <Text style={styles.textoPlacar}>Pontos: {pontos}</Text>
          <Text style={styles.textoVidas}>Vidas: {'❤️'.repeat(Math.max(0, vidas))}</Text>
        </View>

        <TouchableOpacity onPress={abandonarPartida} style={styles.btnSair}>
          <Ionicons name="exit-outline" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.nomeJogador, { color: '#FF4444' }]}>{oponenteNome}</Text>
          <Text style={styles.textoPlacar}>Pontos: {pontosOponente}</Text>
          <Text style={styles.textoVidas}>Vidas: {'❤️'.repeat(Math.max(0, vidasOponente))}</Text>
        </View>
      </View>

      {/* Área Principal de Jogo */}
      <View style={styles.gameArea}>
        {operacoes.map((op) => (
          <Animated.View
            key={op.id}
            style={[
              styles.cardOperacao,
              {
                left: op.posX,
                transform: [{ translateY: op.y }, { scale: op.scale }],
                opacity: op.opacity,
              },
            ]}
          >
            <Text style={styles.textoOperacao}>{op.textoTela}</Text>
          </Animated.View>
        ))}

        {explosoes.map((exp) => (
          <View key={exp.id} style={[styles.containerExplosao, { left: exp.x, top: exp.y - 20 }]}>
            <Particula char="💥" />
          </View>
        ))}

        {lasersAtivos.map((laser, index) => (
          <Animated.View
            key={`laser-${index}`}
            style={{
              position: 'absolute',
              left: laser.x,
              top: laser.y,
              width: 4,
              height: laser.h,
              backgroundColor: laser.cor,
              transform: [
                { translateY: -laser.h / 2 },
                { rotate: laser.angle },
              ],
              opacity: laserAnim,
              shadowColor: laser.cor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 10,
              elevation: 5,
            }}
          />
        ))}

        <View style={[styles.linhaBase, { top: DROP_LIMIT }]} />
      </View>

      {/* Teclado */}
      {modoRef.current !== 'espectador' && meuStatus === 'vivo' && (
        <View style={styles.containerTecladoTotal}>
          <Animated.View style={[styles.visor, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={styles.textoVisor}>{resposta || '?'}</Text>
          </Animated.View>
          
          <View style={styles.linhaTeclado}>
            {[1, 2, 3].map((num) => (
              <BotaoTeclado key={num} valor={num} onPress={(v: number) => setResposta((p) => p.length < 5 ? p + v : p)}>
                <Text style={styles.textoTecla}>{num}</Text>
              </BotaoTeclado>
            ))}
          </View>
          <View style={styles.linhaTeclado}>
            {[4, 5, 6].map((num) => (
              <BotaoTeclado key={num} valor={num} onPress={(v: number) => setResposta((p) => p.length < 5 ? p + v : p)}>
                <Text style={styles.textoTecla}>{num}</Text>
              </BotaoTeclado>
            ))}
          </View>
          <View style={styles.linhaTeclado}>
            {[7, 8, 9].map((num) => (
              <BotaoTeclado key={num} valor={num} onPress={(v: number) => setResposta((p) => p.length < 5 ? p + v : p)}>
                <Text style={styles.textoTecla}>{num}</Text>
              </BotaoTeclado>
            ))}
          </View>
          <View style={styles.linhaTeclado}>
            <BotaoTeclado valor="del" onPress={() => setResposta((p) => p.slice(0, -1))} styleExtra={styles.teclaApagar}>
              <Ionicons name="backspace" size={28} color="#FFF" />
            </BotaoTeclado>
            <BotaoTeclado valor={0} onPress={(v: number) => setResposta((p) => p.length < 5 ? p + v : p)}>
              <Text style={styles.textoTecla}>0</Text>
            </BotaoTeclado>
            <BotaoTeclado valor="enter" onPress={verificarResposta} styleExtra={styles.teclaEnviar}>
              <Ionicons name="send" size={28} color="#FFF" />
            </BotaoTeclado>
          </View>
        </View>
      )}

      {meuStatus === 'morto' && modoRef.current !== 'espectador' && (
        <View style={styles.containerMorto}>
          <Text style={styles.textoMorto}>Você foi destruído!</Text>
          <Text style={styles.subTextoMorto}>Aguarde o fim da partida...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  particulaTexto: { fontSize: 30, position: 'absolute' },
  tecla: { flex: 1, backgroundColor: '#333', margin: 4, borderRadius: 10, justifyContent: 'center', alignItems: 'center', height: 60, elevation: 3, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
  
  resultadoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultadoTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginBottom: 30 },
  resultadoCard: { backgroundColor: '#2A2A4A', padding: 30, borderRadius: 20, alignItems: 'center', marginBottom: 40, width: '80%', elevation: 5 },
  resultadoPontos: { fontSize: 60, fontWeight: 'bold', color: '#32CD32', marginBottom: 10 },
  resultadoLabel: { fontSize: 18, color: '#A0A0B0' },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 25, alignItems: 'center' },
  jogarNovamenteText: { fontSize: 18, fontWeight: 'bold', color: '#000', marginLeft: 10 },
  
  badgeEspectador: { backgroundColor: '#E74C3C', padding: 5, alignItems: 'center', borderRadius: 8, marginBottom: 5, marginHorizontal: 15 },
  textoBadgeEspectador: { color: '#FFF', fontWeight: 'bold' },
  
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10, alignItems: 'center' },
  nomeJogador: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  textoPlacar: { color: '#FFF', fontSize: 14, marginBottom: 2 },
  textoVidas: { color: '#FFF', fontSize: 12 },
  btnSair: { padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  
  gameArea: { height: GAME_AREA_HEIGHT, backgroundColor: '#0F0F1A', overflow: 'hidden', position: 'relative' },
  cardOperacao: { position: 'absolute', width: CARD_WIDTH, backgroundColor: '#2A2A4A', padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#4A4A6A' },
  textoOperacao: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  containerExplosao: { position: 'absolute', width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  linhaBase: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255, 68, 68, 0.3)' },
  
  containerTecladoTotal: { flex: 1, padding: 10, justifyContent: 'flex-end', paddingBottom: 20 },
  visor: { backgroundColor: '#2A2A4A', marginHorizontal: 4, marginBottom: 10, borderRadius: 10, height: 60, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#4A4A6A' },
  textoVisor: { color: '#FFF', fontSize: 32, fontWeight: 'bold', letterSpacing: 2 },
  linhaTeclado: { flexDirection: 'row', justifyContent: 'space-between' },
  textoTecla: { color: '#FFF', fontSize: 28, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#FF4444' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  containerMorto: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' },
  textoMorto: { color: '#FF4444', fontSize: 30, fontWeight: 'bold', marginBottom: 10 },
  subTextoMorto: { color: '#FFF', fontSize: 16 }
});
