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
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.Text style={[styles.particulaTexto, {
        transform: [ { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomX] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomY] }) }, { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${randomRot}deg`] }) }, { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1.8, 0] }) } ],
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })
      }]}>{char}</Animated.Text>
  );
};

const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => {
  const lastPress = useRef(0);
  return (
    <Pressable style={({ pressed }) => [styles.tecla, styleExtra, pressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]}
      onPressIn={() => { const now = Date.now(); if (now - lastPress.current > 150) { lastPress.current = now; onPress(valor); } }}>{children}</Pressable>
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
  
  // A COR VOLTOU! Fim do Erro da Tela Branca.
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
            setOperacoes(prev => prev.filter(o => o.chaveOriginal !== op_id));
            operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chaveOriginal !== op_id);
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
        if (jogoAtivoRef.current) Animated.timing(novaOp.y, { toValue: height + 100, duration: novaOp.speed, useNativeDriver: true }).start();
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
          <View style={styles.resultadoCard}><Text style={styles.resultadoPontos}>{pontos}</Text><Text style={styles.resultadoLabel}>Seus Pontos Totais</Text></View>
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
      {modoRef.current === 'espectador' && (<View style={{backgroundColor: '#E74C3C', padding: 5, alignItems: 'center', borderRadius: 8, marginBottom: 5}}><Text style={{color: '#FFF', fontWeight: 'bold'}}>👁 ASSISTINDO AO VIVO</Text></View>)}

      <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 10}}>
          <View>
              <Text style={{color: modoRef.current==='espectador'?'#32CD32':'#32CD32', fontWeight: 'bold'}}>{modoRef.current === 'espectador' ? player1Name.toUpperCase() : 'VOCÊ'}</Text>
              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '900'}}>{pontos} pts</Text>
              <View style={{flexDirection: 'row', marginTop: 2}}>{Array.from({length: Math.max(0, vidas)}).map((_,i) => <Ionicons key={`v1_${i}`} name="heart" size={12} color="#FF4444" style={{marginRight:2}}/>)}</View>
          </View>
          
          <TouchableOpacity onPress={abandonarPartida} style={{justifyContent: 'center'}}><Ionicons name="exit" size={24} color="#E74C3C" /></TouchableOpacity>

          <View style={{alignItems: 'flex-end'}}>
              <Text style={{color: '#FF4444', fontWeight: 'bold'}}>{oponenteNome.toUpperCase()}</Text>
              <Text style={{color: '#FFF', fontSize: 18, fontWeight: '900'}}>{pontosOponente} pts</Text>
              <View style={{flexDirection: 'row', marginTop: 2}}>{Array.from({length: Math.max(0, vidasOponente)}).map((_,i) => <Ionicons key={`v2_${i}`} name="heart" size={12} color="#FF4444" style={{marginLeft:2}}/>)}</View>
          </View>
      </View>

      <View style={styles.gameArea}>
        <View style={styles.linhaEletricaContainer}><View style={styles.linhaEletricaCore} /><View style={styles.linhaEletricaGlow} /></View>
        {operacoes.map((op) => ( 
          <Animated.View key={op.id} style={[styles.operacaoCard, { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity, width: CARD_WIDTH }]}> 
            <Text style={styles.operacaoText}>{op.textoTela}</Text> 
          </Animated.View> 
        ))}
        {explosoes.map(exp => (<View key={exp.id} style={[styles.explosaoContainer, { left: exp.x, top: exp.y }]}>{exp.texto.split('').map((char: string, i: number) => (<Particula key={i} char={char} />))}</View>))}
        {lasersAtivos.map((laserInfo, index) => (<Animated.View key={`laser-${index}`} style={[styles.laser, { left: laserInfo.x - 2, top: laserInfo.y - laserInfo.h / 2, height: laserInfo.h, transform: [{ rotate: laserInfo.angle }], backgroundColor: laserInfo.cor, opacity: laserAnim }]} />))}
      </View>
      
      {modoRef.current !== 'espectador' && meuStatus === 'vivo' ? (
          <View style={styles.bottomPanel}>
            <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}><Text style={styles.displayText}>{resposta || ' '}</Text></Animated.View>
            <View style={styles.tecladoContainer}>
              {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => <View key={i} style={styles.tecladoRow}>{row.map(num => <BotaoTeclado key={num} valor={num} onPress={(v:string) => setResposta(r => r + v)}><Text style={styles.teclaText}>{num}</Text></BotaoTeclado>)}</View>)}
              <View style={styles.tecladoRow}>
                <BotaoTeclado valor="apagar" onPress={() => setResposta(r => r.slice(0, -1))} styleExtra={styles.teclaApagar}><Ionicons name="close" size={24} color="#fff" /></BotaoTeclado>
                <BotaoTeclado valor="0" onPress={(v:string) => setResposta(r => r + v)}><Text style={styles.teclaText}>0</Text></BotaoTeclado>
                <BotaoTeclado valor="enviar" onPress={verificarResposta} styleExtra={styles.teclaEnviar}><Ionicons name="checkmark" size={28} color="#fff" /></BotaoTeclado>
              </View>
            </View>
          </View>
      ) : (modoRef.current === 'multi' && meuStatus === 'morto') ? (
          <View style={[styles.bottomPanel, {justifyContent: 'center', height: 250, backgroundColor: 'rgba(26, 26, 46, 0.85)', borderRadius: 20}]}><Ionicons name="skull" size={48} color="#FF4444" /><Text style={{color: '#FFF', fontSize: 20, fontWeight: 'bold', marginTop: 10}}>VOCÊ MORREU</Text><Text style={{color: '#888', marginTop: 5}}>Assistindo partida...</Text></View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  gameArea: { flex: 1, width: '100%', backgroundColor: '#0a0a0a', zIndex: 1 },
  linhaEletricaContainer: { position: 'absolute', top: DROP_LIMIT, width: '100%', height: 10, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  linhaEletricaCore: { width: '100%', height: 2, backgroundColor: '#00FFFF', shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  linhaEletricaGlow: { position: 'absolute', width: '100%', height: 8, backgroundColor: 'rgba(0, 255, 255, 0.3)' },
  operacaoCard: { position: 'absolute', top: 0, backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 10 },
  operacaoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  explosaoContainer: { position: 'absolute', width: CARD_WIDTH, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 15 },
  particulaTexto: { position: 'absolute', color: '#00FFFF', fontSize: 22, fontWeight: '900', textShadowColor: '#00FFFF', textShadowRadius: 10 },
  laser: { position: 'absolute', width: 4, zIndex: 1, borderRadius: 2 },
  
  bottomPanel: { position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 15, zIndex: 10 },
  displayContainer: { backgroundColor: 'rgba(26, 26, 46, 0.7)', width: 280, height: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  displayText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  tecladoContainer: { width: 280, gap: 5 },
  tecladoRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  tecla: { backgroundColor: 'rgba(26, 26, 46, 0.75)', flex: 1, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  teclaText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: 'rgba(231, 76, 60, 0.85)' },
  teclaEnviar: { backgroundColor: 'rgba(50, 205, 50, 0.85)' },
  
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 15 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 10, width: '100%' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' }
});
