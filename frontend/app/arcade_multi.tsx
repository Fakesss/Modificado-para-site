import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { socket, activeMatchData, setActiveMatchData } from '../src/services/socket';
import { Audio } from 'expo-av'; 
import Slider from '@react-native-community/slider';

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
    <Animated.Text style={[styles.particulaTexto, { transform: [ { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomX] }) }, { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomY] }) }, { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${randomRot}deg`] }) }, { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1.8, 0] }) } ], opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }) }]}>{char}</Animated.Text>
  );
};

// Componente Visual da Tecla
const BotaoVisual = ({ valor, isPressed, children, styleExtra, onPressWeb }: any) => {
  return (
    <View
      style={[styles.tecla, styleExtra, isPressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]}
      {...(Platform.OS === 'web' ? {
        onPointerDown: (e: any) => {
            e.preventDefault();
            onPressWeb(valor);
        }
      } : {})}
    >
      {children}
    </View>
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

  const [volumeBGM, setVolumeBGM] = useState<number>(0.8); 
  const [volumeSFX, setVolumeSFX] = useState<number>(0.5); 
  const [mostrarVolume, setMostrarVolume] = useState(false);
  const volumeBGMRef = useRef<number>(0.8);
  const volumeSFXRef = useRef<number>(0.5);
  const sonsRef = useRef<any>({});
  const bgmRef = useRef<Audio.Sound | null>(null);

  // Estados exclusivos para o controle de Multi-Touch
  const [teclasPressionadas, setTeclasPressionadas] = useState<string[]>([]);
  const triggeredTouchesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const carregarSons = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false });
        sonsRef.current.shoot = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Zenoguy/Space_Shooters/main/bgm/laser.mp3' })).sound;
        sonsRef.current.hit = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Gtajisan/bongoboltu_2.0/main/hit.mp3' })).sound;
        sonsRef.current.miss = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Gtajisan/bongoboltu_2.0/main/miss.mp3' })).sound;
        sonsRef.current.damage = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Zenoguy/Space_Shooters/main/bgm/explosion.mp3' })).sound;

        const bgmUrlsFallback = ['https://raw.githubusercontent.com/phaserjs/examples/master/public/assets/audio/tech/bgm.mp3'];
        let bgmCarregado = null;
        for (let url of bgmUrlsFallback) {
            try {
                const { sound } = await Audio.Sound.createAsync({ uri: url }, { isLooping: true, volume: Math.pow(volumeBGMRef.current, 2) * 0.5 });
                bgmCarregado = sound; break;
            } catch (error) {}
        }
        if (bgmCarregado) { bgmRef.current = bgmCarregado; if (jogoAtivoRef.current) await bgmCarregado.playAsync(); }
      } catch (error) {}
    };
    carregarSons();
    return () => {
      Object.values(sonsRef.current).forEach((s: any) => s?.unloadAsync());
      if (bgmRef.current) bgmRef.current.unloadAsync();
    };
  }, []);

  const tocarSom = async (tipo: string) => {
    try {
      if (sonsRef.current[tipo] && volumeSFXRef.current > 0) {
        const volumeCalculado = Math.pow(volumeSFXRef.current, 2) * 0.4;
        await sonsRef.current[tipo].setVolumeAsync(volumeCalculado);
        await sonsRef.current[tipo].replayAsync();
      }
    } catch (e) {}
  };

  const pararBGM = async () => {
    try { if (bgmRef.current) await bgmRef.current.pauseAsync(); } catch(e) {}
  };

  const gameOver = () => { 
    jogoAtivoRef.current = false;
    if (spawnTimer.current) clearTimeout(spawnTimer.current); 
    setOperacoes([]); setExplosoes([]); setTela('resultado');
    pararBGM();
  };

  const processarErro = useCallback((opId: string) => {
    if (opId === 'nenhum') return; 
    const opInfo = operacoesListRef.current.find(o => o.id === opId);
    if (!opInfo) return;
    opInfo.y.stopAnimation();

    const expId = Math.random().toString();
    setExplosoes(prev => [...prev, { id: expId, x: opInfo.posX, y: DROP_LIMIT, texto: opInfo.textoTela, corEspecial: false }]);
    setTimeout(() => { setExplosoes(prev => prev.filter(e => e.id !== expId)); }, 800);

    tocarSom('damage');
    if (meuStatusRef.current === 'vivo' && modoRef.current !== 'espectador') socket.emit('arcade_miss', { room_id: roomIdRef.current, op_id: opInfo.chaveOriginal });
    setOperacoes(prev => prev.filter(o => o.id !== opId));
    operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opId);
  }, []);

  const dispararLaserUnico = (alvo: any, acertou: boolean, isMe: boolean, isSpectator: boolean, playerIndex: number) => {
    let originX = width / 2; let originY = DROP_LIMIT + 30; 
    let targetX = width / 2; let targetY = 0; 
    if (acertou && alvo) {
        targetX = alvo.posX + CARD_WIDTH / 2;
        const alvoAtual = operacoesAtuaisRef.current.find(o => o.chave === alvo.id);
        targetY = (alvoAtual ? (alvoAtual.currentY || 0) : 0) + 20;
    } else { targetX = Math.random() > 0.5 ? width * 1.5 : -width * 0.5; targetY = -50; }

    const dx = targetX - originX; const dy = targetY - originY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + Math.PI / 2; 

    let cor = isMe ? '#00FFFF' : '#FFA500'; 
    if (isSpectator) cor = playerIndex === 0 ? '#00FFFF' : '#FFA500'; 

    const midX = originX + dx / 2; const midY = originY + dy / 2;
    setLasersAtivos([{ x: midX, y: midY, h: distance, angle: `${angle}rad`, cor }]);
    
    tocarSom('shoot'); laserAnim.setValue(1);
    const duracaoLaser = acertou ? 300 : 150;

    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 0, duration: duracaoLaser, useNativeDriver: true }), 
      ...(alvo && acertou ? [ Animated.timing(alvo.scale, { toValue: alvo.baseScale * 1.4, duration: 150, useNativeDriver: true }), Animated.timing(alvo.opacity, { toValue: 0, duration: 150, useNativeDriver: true }) ] : [])
    ]).start(() => setLasersAtivos([]));
    
    setTimeout(() => { if (acertou) tocarSom('hit'); else tocarSom('miss'); }, duracaoLaser - 50);

    if (!acertou) Animated.sequence([ Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }), Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }), Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }) ]).start();
  };

  // =========================================================================
  // NOVA LÓGICA DE TECLADO (TOUCH E WEB)
  // =========================================================================

  const executarAcaoTecla = (valor: string) => {
    setResposta(currentResposta => {
        if (valor === 'apagar') return currentResposta.slice(0, -1);
        else if (valor === 'enviar') { 
            verificarRespostaComValor(currentResposta); 
            return ''; 
        }
        else return currentResposta.length < 5 ? currentResposta + valor : currentResposta;
    });
  };

  const getTeclaFromCoords = (x: number, y: number) => {
    const KEY_W = (width - 30 - 10) / 3; // Estimativa baseada no gap e padding
    const KEY_H = 48;
    const GAP = 5;

    let col = -1;
    if (x >= 0 && x <= KEY_W) col = 0; 
    else if (x > KEY_W && x <= KEY_W * 2 + GAP) col = 1; 
    else if (x > KEY_W * 2 + GAP) col = 2;

    let row = -1;
    if (y >= 0 && y <= KEY_H) row = 0; 
    else if (y > KEY_H && y <= KEY_H * 2 + GAP) row = 1; 
    else if (y > KEY_H * 2 + GAP && y <= KEY_H * 3 + GAP * 2) row = 2; 
    else if (y > KEY_H * 3 + GAP * 2) row = 3;

    if (col === -1 || row === -1) return null;
    const layout = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['apagar', '0', 'enviar']];
    return layout[row]?.[col] || null;
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

  const verificarRespostaComValor = (valorStr: string) => {
    if (!jogoAtivoRef.current || isNaN(parseInt(valorStr)) || meuStatusRef.current === 'morto') return;
    const alvo = operacoesListRef.current.find(op => op.resposta === parseInt(valorStr));
    if (alvo) { 
        alvo.y.stopAnimation(); 
        socket.emit('arcade_answer', { room_id: roomIdRef.current, op_id: alvo.chaveOriginal }); 
    } 
    else { dispararLaserUnico(null, false, true, false, 0); }
  };

  // =========================================================================

  const spawnarQuestaoRecuperada = (dados: any) => {
    let numLanes = 3;
    if (rodadaRef.current >= 4) numLanes = 4; if (rodadaRef.current >= 7) numLanes = 5; if (rodadaRef.current >= 10) numLanes = 6;
    const laneWidth = width / numLanes; const baseScale = 3 / numLanes;
    const lane = dados.lane_precalc || 0;
    const id = Math.random().toString();
    const startY = dados.startY || 0;
    operacoesAtuaisRef.current.push({ lane, y: startY, currentY: startY, chaveOriginal: dados.id, chave: id, missed: false });

    const posX = (lane * laneWidth) + (laneWidth / 2) - (CARD_WIDTH / 2);
    const yValue = new Animated.Value(startY);
    yValue.addListener(({ value }: any) => {
      const ref = operacoesAtuaisRef.current.find((o:any) => o.chave === id);
      if (ref) { ref.y = value; ref.currentY = value; if (value >= DROP_LIMIT && !ref.missed) { ref.missed = true; processarErro(id); } }
    });

    const novaOp = { id, chaveOriginal: dados.id, resposta: dados.resposta, textoTela: dados.texto, y: yValue, speed: dados.speed, posX, lane, tipoEspecial: 'nenhum', baseScale, opacity: new Animated.Value(1), scale: new Animated.Value(baseScale) };
    setOperacoes(prev => [...prev, novaOp]);

    setTimeout(() => {
        if (jogoAtivoRef.current) {
            const distanciaRestante = Math.max(10, (height + 100) - startY);
            const tempoRestante = dados.speed * ((height + 100) / DROP_LIMIT) * Math.min(1, Math.max(0.01, distanciaRestante / (height + 100)));
            Animated.timing(novaOp.y, { toValue: height + 100, duration: tempoRestante, useNativeDriver: true }).start();
        }
    }, 50);
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
      return Math.min(...opsNaPista.map(o => o.currentY || 0)) > (DROP_LIMIT * minDropDistance);
    });
    
    if (pistasDisponiveis.length === 0) { filaMultiplayerRef.current.unshift(dados); return; }

    const lane = dados.lane_precalc !== undefined ? dados.lane_precalc : pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
    const id = Math.random().toString();
    operacoesAtuaisRef.current.push({ lane, y: 0, currentY: 0, chaveOriginal: dados.chave || dados.id, chave: id, missed: false });

    const posX = (lane * laneWidth) + (laneWidth / 2) - (CARD_WIDTH / 2);
    const yValue = new Animated.Value(0);
    
    yValue.addListener(({ value }: any) => {
      const ref = operacoesAtuaisRef.current.find((o:any) => o.chave === id);
      if (ref) { ref.y = value; ref.currentY = value; if (value >= DROP_LIMIT && !ref.missed) { ref.missed = true; processarErro(id); } }
    });

    const novaOp = { id, chaveOriginal: dados.chave || dados.id, resposta: dados.resposta, textoTela: dados.texto, y: yValue, speed: dados.speed, posX, lane, tipoEspecial: 'nenhum', baseScale, opacity: new Animated.Value(1), scale: new Animated.Value(baseScale) };
    setOperacoes(prev => [...prev, novaOp]); 
    
    setTimeout(() => { if (jogoAtivoRef.current) Animated.timing(novaOp.y, { toValue: height + 100, duration: novaOp.speed * ((height + 100) / DROP_LIMIT), useNativeDriver: true }).start(); }, 50); 
  };

  const gerarEnviarBatchMultiplayer = (modoEscolhido: string) => {
      const novasOps = []; const r = (max: number) => Math.floor(Math.random() * max);
      let opsPermitidas = ['+'];
      if (modoEscolhido === 'misto') { if (rodadaRef.current >= 2) opsPermitidas.push('-'); if (rodadaRef.current >= 4) opsPermitidas.push('×'); if (rodadaRef.current >= 6) opsPermitidas.push('÷'); if (rodadaRef.current >= 8) opsPermitidas.push('^'); if (rodadaRef.current >= 10) opsPermitidas.push('√'); } 
      else { opsPermitidas = [modoEscolhido==='soma'?'+': modoEscolhido==='subtracao'?'-': modoEscolhido==='multiplicacao'?'×': modoEscolhido==='divisao'?'÷': modoEscolhido==='potenciacao'?'^':'√']; }

      let numMax = 8 + (rodadaRef.current * 2); let multMax = 5 + Math.floor(rodadaRef.current / 1.5); 
      let numLanes = 3; if (rodadaRef.current >= 4) numLanes = 4; if (rodadaRef.current >= 7) numLanes = 5; if (rodadaRef.current >= 10) numLanes = 6;

      for(let i=0; i<15; i++) {
          const op = opsPermitidas[r(opsPermitidas.length)]; let n1=0, n2:any=0, res=0, txt='';
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
          novasOps.push({ id: Math.random().toString(), texto: txt, resposta: res, speed: Math.max(3500, 10000 - (rodadaRef.current * 800)), lane_precalc: i % numLanes });
      }
      filaMultiplayerRef.current.push(...novasOps);
      socket.emit('arcade_sync_batch', { room_id: roomIdRef.current, ops: novasOps });
      rodadaRef.current += 1;
  };

  const iniciarLoopSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (modoRef.current === 'espectador') return; 

    const loop = () => {
      if (!jogoAtivoRef.current || meuStatusRef.current === 'morto') return;
      if (isHostRef.current) {
          if (filaMultiplayerRef.current.length > 0 && operacoesListRef.current.length < Math.min(15, 3 + Math.floor(pontos / 150))) socket.emit('arcade_host_spawn', { room_id: roomIdRef.current });
          if (filaMultiplayerRef.current.length < 5) gerarEnviarBatchMultiplayer(modoMatematicaRef.current);
          spawnTimer.current = setTimeout(loop, Math.max(800, 2500 - (rodadaRef.current * 150)));
      }
    };
    if (isHostRef.current) loop();
  };

  const setupMultiplayerMatch = async (data: any) => {
      setModo('multi'); modoRef.current = 'multi'; modoMatematicaRef.current = data.modo_operacao || 'misto';
      roomIdRef.current = data.room_id; setOponenteNome(data.opponentName); isHostRef.current = data.is_host; 
      setVidas(5); setVidasOponente(5); setPontos(0); setPontosOponente(0);
      setMeuStatus('vivo'); meuStatusRef.current = 'vivo';
      filaMultiplayerRef.current = []; setOperacoes([]); setExplosoes([]); setResposta(''); operacoesAtuaisRef.current = []; rodadaRef.current = 1;
      setTela('jogo'); jogoAtivoRef.current = true;
      if (data.is_host) { gerarEnviarBatchMultiplayer(data.modo_operacao || 'misto'); }
      
      try { if (bgmRef.current) await bgmRef.current.playAsync(); } catch(e){}
      setTimeout(() => { iniciarLoopSpawner(); }, 1000);
  };

  const setupSpectatorMode = async (roomId: string) => {
      setModo('espectador'); modoRef.current = 'espectador'; roomIdRef.current = roomId;
      setVidas(5); setVidasOponente(5); setPontos(0); setPontosOponente(0);
      filaMultiplayerRef.current = []; setOperacoes([]); setExplosoes([]);
      socket.emit('spectate_match', { room_id: roomId });
      setTela('jogo'); jogoAtivoRef.current = true;
      socket.emit('arcade_sync_batch', { room_id: roomId, ops: [{ type: 'REQUEST_SYNC' }] });
      
      try { if (bgmRef.current) await bgmRef.current.playAsync(); } catch(e){}
  };

  const abandonarPartida = () => {
      const msg = modoRef.current === 'espectador' ? "Deseja parar de assistir?" : "Deseja abandonar a partida? Você perderá o jogo.";
      const executarSaida = () => {
          pararBGM();
          if (modoRef.current === 'espectador') socket.emit('leave_spectator', { room_id: roomIdRef.current });
          else if (modoRef.current === 'multi') socket.emit('leave_match', { room_id: roomIdRef.current });
          setActiveMatchData(null); socket.emit('update_status', { status: 'MENU' }); router.back();
      };
      if (Platform.OS === 'web' && typeof window !== 'undefined') { if (window.confirm(msg)) executarSaida(); } 
      else { Alert.alert("Sair", msg, [ { text: "Não", style: "cancel" }, { text: "Sim", style: "destructive", onPress: executarSaida } ]); }
  };

  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handleKeyDownLocal = (e: any) => {
            if (!jogoAtivoRef.current || meuStatusRef.current === 'morto' || modoRef.current === 'espectador' || mostrarVolume) return;
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
  }, [mostrarVolume]);

  useEffect(() => {
    socket.emit('update_status', { status: 'JOGANDO_ONLINE' });

    const onArcadeNewBatch = (data: any) => {
        if (data.ops.length > 0) {
            if (data.ops[0].type === 'REQUEST_SYNC') {
                if (isHostRef.current) {
                    const onScreenOps = operacoesListRef.current.map(op => {
                        const opAtual = operacoesAtuaisRef.current.find(o => o.chave === op.id);
                        return { id: op.chaveOriginal, texto: op.textoTela, resposta: op.resposta, speed: op.speed, lane_precalc: op.lane, startY: opAtual ? (opAtual.currentY || 0) : 0 };
                    });
                    socket.emit('arcade_sync_batch', { room_id: roomIdRef.current, ops: [{ type: 'SPECTATOR_SYNC', onScreenOps, queue: filaMultiplayerRef.current }] });
                }
                return;
            }
            if (data.ops[0].type === 'SPECTATOR_SYNC') {
                if (modoRef.current === 'espectador') {
                    const syncData = data.ops[0];
                    operacoesAtuaisRef.current.forEach(o => { const ref = operacoesListRef.current.find(op => op.id === o.chave); if(ref && ref.y) ref.y.stopAnimation(); });
                    setOperacoes([]); operacoesAtuaisRef.current = [];
                    syncData.onScreenOps.forEach((op: any) => spawnarQuestaoRecuperada(op));
                    filaMultiplayerRef.current = syncData.queue;
                }
                return;
            }
        }
        filaMultiplayerRef.current.push(...data.ops);
    };

    const onArcadeDoSpawn = () => { if (jogoAtivoRef.current) spawnarQuestao(); };

    const onArcadeOpDestroyed = (data: any) => {
        const { op_id, winner_sid, pontos: novosPontos } = data;
        const opInfo = operacoesListRef.current.find(o => o.chaveOriginal === op_id);
        filaMultiplayerRef.current = filaMultiplayerRef.current.filter(op => (op.chave || op.id) !== op_id);

        let playerIndex = 0; let isMe = false;
        if (modoRef.current === 'espectador') {
            const sids = Object.keys(novosPontos); playerIndex = sids.indexOf(winner_sid);
            setPontos(novosPontos[sids[0]]); setPontosOponente(novosPontos[sids[1]]);
        } else {
            isMe = winner_sid === socket.id; setPontos(novosPontos[socket.id]);
            const oppSid = Object.keys(novosPontos).find(sid => sid !== socket.id);
            if(oppSid) setPontosOponente(novosPontos[oppSid]);
        }
        dispararLaserUnico(opInfo || null, true, isMe, modoRef.current === 'espectador', playerIndex);

        if (opInfo) {
            opInfo.y.stopAnimation();
            setTimeout(() => { setOperacoes(prev => prev.filter(o => o.chaveOriginal !== op_id)); operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chaveOriginal !== op_id); }, 300);
        }
    };

    const onArcadeStateUpdate = (data: any) => {
        if (modoRef.current === 'espectador') {
            const sids = Object.keys(data.vidas); setVidas(data.vidas[sids[0]]); setVidasOponente(data.vidas[sids[1]]);
        } else {
            const mySid = socket.id; const newMyLives = data.vidas[mySid]; setVidas(newMyLives);
            const oppSid = Object.keys(data.vidas).find(sid => sid !== mySid); if(oppSid) setVidasOponente(data.vidas[oppSid]);
            if (newMyLives <= 0 && meuStatusRef.current === 'vivo') { setMeuStatus('morto'); meuStatusRef.current = 'morto'; setResposta(''); }
        }
    };

    const onGameOver = (data: any) => { setGanhador(data.ganhador); gameOver(); };
    const onOpponentDisconnected = () => { Alert.alert("Fim de Jogo", "Um dos jogadores abandonou a partida."); setGanhador(modoRef.current === 'espectador' ? 'Empate' : socket.id); gameOver(); };

    const onSpectatorJoined = (data: any) => {
        const sids = Object.keys(data.names);
        setPlayer1Name(data.names[sids[0]]); setOponenteNome(data.names[sids[1]]);
        setVidas(data.vidas[sids[0]]); setVidasOponente(data.vidas[sids[1]]);
        setPontos(data.pontos[sids[0]]); setPontosOponente(data.pontos[sids[1]]);
        rodadaRef.current = 1 + Math.floor(Math.max(data.pontos[sids[0]], data.pontos[sids[1]]) / 150);
    };

    socket.on('arcade_new_batch', onArcadeNewBatch); socket.on('arcade_do_spawn', onArcadeDoSpawn);
    socket.on('arcade_op_destroyed', onArcadeOpDestroyed); socket.on('arcade_state_update', onArcadeStateUpdate);
    socket.on('game_over', onGameOver); socket.on('opponent_disconnected', onOpponentDisconnected);
    socket.on('match_ended', onOpponentDisconnected); socket.on('spectator_joined', onSpectatorJoined);

    return () => {
        socket.off('arcade_new_batch', onArcadeNewBatch); socket.off('arcade_do_spawn', onArcadeDoSpawn);
        socket.off('arcade_op_destroyed', onArcadeOpDestroyed); socket.off('arcade_state_update', onArcadeStateUpdate);
        socket.off('game_over', onGameOver); socket.off('opponent_disconnected', onOpponentDisconnected);
        socket.off('match_ended', onOpponentDisconnected); socket.off('spectator_joined', onSpectatorJoined);
        socket.emit('update_status', { status: 'MENU' });
    };
  }, []);

  useEffect(() => {
      if (activeMatchData && activeMatchData.game_type === 'arcade') setupMultiplayerMatch(activeMatchData);
      else if (params.spectate) setupSpectatorMode(params.spectate as string);
  }, [activeMatchData, params.spectate]);

  if (tela === 'resultado') {
    let titulo = ganhador === socket.id ? 'Você Venceu!' : (ganhador === 'Empate' ? 'Empate Técnico!' : 'Você Perdeu!');
    if (modoRef.current === 'espectador') titulo = 'Partida Encerrada';

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{titulo}</Text>
          <View style={styles.resultadoCard}><Text style={styles.resultadoPontos}>{pontos}</Text><Text style={styles.resultadoLabel}>Seus Pontos Totais</Text></View>
          <TouchableOpacity style={styles.jogarNovamenteButton} onPress={() => { setActiveMatchData(null); socket.emit('update_status', { status: 'MENU' }); router.back(); }}>
            <Ionicons name="home" size={22} color="#000" /><Text style={styles.jogarNovamenteText}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {modoRef.current === 'espectador' && (<View style={styles.badgeEspectador}><Text style={styles.textoBadgeEspectador}>👁 ASSISTINDO AO VIVO</Text></View>)}

      {mostrarVolume && (
        <View style={styles.volumeOverlay}>
          <View style={styles.volumeModal}>
            <Text style={styles.volumeTitle}><Ionicons name="settings" size={22} color="#FFD700" /> Áudio</Text>
            <Text style={styles.volumeLabel}>Música de Fundo</Text>
            <View style={styles.sliderRow}>
              <Ionicons name="musical-notes" size={20} color="#00FFFF" />
              <Slider
                style={{flex: 1, height: 40, marginHorizontal: 10}}
                minimumValue={0} maximumValue={1} value={volumeBGM}
                onValueChange={(val) => { setVolumeBGM(val); volumeBGMRef.current = val; if (bgmRef.current) bgmRef.current.setVolumeAsync(Math.pow(val, 2) * 0.5); }}
                minimumTrackTintColor="#00FFFF" maximumTrackTintColor="#555" thumbTintColor="#00FFFF"
              />
            </View>
            <Text style={styles.volumeLabel}>Efeitos Sonoros</Text>
            <View style={styles.sliderRow}>
              <Ionicons name="flash" size={20} color="#FFD700" />
              <Slider
                style={{flex: 1, height: 40, marginHorizontal: 10}}
                minimumValue={0} maximumValue={1} value={volumeSFX}
                onValueChange={(val) => { setVolumeSFX(val); volumeSFXRef.current = val; }}
                minimumTrackTintColor="#FFD700" maximumTrackTintColor="#555" thumbTintColor="#FFD700"
              />
            </View>
            <TouchableOpacity style={styles.btnCloseVolume} onPress={() => setMostrarVolume(false)}>
              <Text style={styles.btnCloseVolumeText}>FECHAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.gameHeader}>
        <View style={styles.playerInfoBox}>
          <View style={[styles.playerTag, { borderColor: '#00FFFF', backgroundColor: 'rgba(0, 255, 255, 0.1)' }]}><Text style={[styles.nomeJogador, { color: '#00FFFF' }]}>{modoRef.current === 'espectador' ? player1Name : 'Você'}</Text></View>
          <Text style={styles.textoPlacar}>Pts: {pontos}</Text>
          <View style={styles.vidasContainer}>{Array.from({ length: Math.max(0, vidas) }).map((_, i) => <Ionicons key={i} name="heart" size={14} color="#FF4444" style={{marginHorizontal:1}} />)}</View>
        </View>
        
        <View style={styles.botoesCentro}>
            <TouchableOpacity onPress={() => setMostrarVolume(true)} style={styles.btnAcao}><Ionicons name="settings" size={22} color="#FFF" /></TouchableOpacity>
            <TouchableOpacity onPress={abandonarPartida} style={styles.btnAcao}><Ionicons name="exit-outline" size={22} color="#FFF" /></TouchableOpacity>
        </View>
        
        <View style={[styles.playerInfoBox, { alignItems: 'flex-end' }]}>
          <View style={[styles.playerTag, { borderColor: '#FFA500', backgroundColor: 'rgba(255, 165, 0, 0.1)' }]}><Text style={[styles.nomeJogador, { color: '#FFA500' }]}>{oponenteNome}</Text></View>
          <Text style={styles.textoPlacar}>Pts: {pontosOponente}</Text>
          <View style={styles.vidasContainer}>{Array.from({ length: Math.max(0, vidasOponente) }).map((_, i) => <Ionicons key={i} name="heart" size={14} color="#FF4444" style={{marginHorizontal:1}} />)}</View>
        </View>
      </View>

      <View style={styles.gameArea}>
        <View style={styles.linhaEletricaContainer}><View style={styles.linhaEletricaCore} /><View style={styles.linhaEletricaGlow} /></View>
        {modoRef.current === 'espectador' && operacoes.length === 0 && (<View style={styles.syncContainer}><ActivityIndicator size="large" color="#00FFFF" /><Text style={styles.syncText}>Sincronizando radar com a partida...</Text></View>)}
        
        {operacoes.map((op) => (
          <Animated.View key={op.id} style={[styles.cardOperacao, { left: op.posX, transform: [{ translateY: op.y }, { scale: op.scale }], opacity: op.opacity, width: CARD_WIDTH }]}>
            <Text style={styles.textoOperacao}>{op.textoTela}</Text>
          </Animated.View>
        ))}

        {explosoes.map(exp => (
          <View key={exp.id} style={[styles.explosaoContainer, { left: exp.x, top: exp.y - 20 }]}>{exp.texto.split('').map((char: string, i: number) => <Particula key={i} char={char} />)}</View>
        ))}

        {lasersAtivos.map((laser, index) => (
          <Animated.View key={`laser-${index}`} style={[styles.laser, { left: laser.x - 2, top: laser.y - laser.h / 2, height: laser.h, backgroundColor: laser.cor, transform: [ { rotate: laser.angle } ], opacity: laserAnim, shadowColor: laser.cor }]} />
        ))}
      </View>

      {modoRef.current !== 'espectador' && meuStatus === 'vivo' && (
        <View style={styles.bottomPanel}>
          <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}><Text style={styles.displayText}>{resposta || ' '}</Text></Animated.View>
          <View style={styles.tecladoContainer}>
            <View style={styles.tecladoGrid}>
                {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
                <View key={i} style={styles.tecladoRow}>
                    {row.map(num => (
                    <BotaoVisual key={num} valor={num} isPressed={teclasPressionadas.includes(num)} onPressWeb={executarAcaoTecla}><Text style={styles.teclaText}>{num}</Text></BotaoVisual>
                    ))}
                </View>
                ))}
                <View style={styles.tecladoRow}>
                <BotaoVisual valor="apagar" isPressed={teclasPressionadas.includes('apagar')} onPressWeb={executarAcaoTecla} styleExtra={styles.teclaApagar}><Ionicons name="close" size={24} color="#fff" /></BotaoVisual>
                <BotaoVisual valor="0" isPressed={teclasPressionadas.includes('0')} onPressWeb={executarAcaoTecla}><Text style={styles.teclaText}>0</Text></BotaoVisual>
                <BotaoVisual valor="enviar" isPressed={teclasPressionadas.includes('enviar')} onPressWeb={executarAcaoTecla} styleExtra={styles.teclaEnviar}><Ionicons name="checkmark" size={28} color="#fff" /></BotaoVisual>
                </View>
            </View>
            {/* Camada Invisível de Interceptação de Multi-Touch para Mobile */}
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
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  particulaTexto: { position: 'absolute', color: '#00FFFF', fontSize: 22, fontWeight: '900', textShadowColor: '#00FFFF', textShadowRadius: 10 },
  resultadoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  resultadoTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFF', marginBottom: 30 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 20, alignItems: 'center', marginBottom: 40, width: '100%', maxWidth: 400, elevation: 5 },
  resultadoPontos: { fontSize: 60, fontWeight: '900', color: '#FFD700', marginBottom: 10 },
  resultadoLabel: { fontSize: 18, color: '#888' },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#FFD700', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12, alignItems: 'center', width: '100%', maxWidth: 400, justifyContent: 'center' },
  jogarNovamenteText: { fontSize: 18, fontWeight: '900', color: '#000', marginLeft: 10 },
  badgeEspectador: { backgroundColor: '#E74C3C', padding: 5, alignItems: 'center', borderRadius: 8, marginBottom: 5, marginHorizontal: 15 },
  textoBadgeEspectador: { color: '#FFF', fontWeight: 'bold' },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', backgroundColor: '#0c0c0c', zIndex: 10 },
  playerInfoBox: { flex: 1 },
  playerTag: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 4, alignSelf: 'flex-start' },
  nomeJogador: { fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
  textoPlacar: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  vidasContainer: { flexDirection: 'row', alignItems: 'center', height: 16 },
  botoesCentro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  btnAcao: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, marginHorizontal: 6 }, 
  volumeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  volumeModal: { backgroundColor: '#1a1a2e', borderWidth: 2, borderColor: '#FFD700', borderRadius: 16, padding: 25, width: '85%', maxWidth: 350 },
  volumeTitle: { color: '#FFD700', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  volumeLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  btnCloseVolume: { backgroundColor: '#E74C3C', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnCloseVolumeText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  gameArea: { flex: 1, backgroundColor: '#0a0a0a', overflow: 'hidden', position: 'relative', zIndex: 1 },
  syncContainer: { position: 'absolute', top: '40%', width: '100%', alignItems: 'center', zIndex: 50 },
  syncText: { color: '#00FFFF', marginTop: 15, fontSize: 14, fontWeight: 'bold', fontStyle: 'italic' },
  linhaEletricaContainer: { position: 'absolute', top: DROP_LIMIT, width: '100%', height: 10, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  linhaEletricaCore: { width: '100%', height: 2, backgroundColor: '#00FFFF', shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  linhaEletricaGlow: { position: 'absolute', width: '100%', height: 8, backgroundColor: 'rgba(0, 255, 255, 0.3)' },
  cardOperacao: { position: 'absolute', backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 10 },
  textoOperacao: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  explosaoContainer: { position: 'absolute', width: CARD_WIDTH, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 15 },
  laser: { position: 'absolute', width: 4, zIndex: 1, borderRadius: 2, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 },
  bottomPanel: { width: '100%', alignItems: 'center', paddingBottom: 15, paddingTop: 5, backgroundColor: '#0c0c0c', zIndex: 10 },
  displayContainer: { backgroundColor: 'rgba(26, 26, 46, 0.7)', width: '100%', maxWidth: 370, height: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  displayText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  tecladoContainer: { width: '100%', maxWidth: 400, position: 'relative', gap: 5, paddingHorizontal: 15 },
  tecladoGrid: { width: '100%', gap: 5 },
  tecladoRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  tecla: { backgroundColor: 'rgba(26, 26, 46, 0.75)', flex: 1, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  teclaText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: 'rgba(231, 76, 60, 0.85)' },
  teclaEnviar: { backgroundColor: 'rgba(50, 205, 50, 0.85)' },
  containerMorto: { width: '100%', paddingVertical: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0c0c0c', zIndex: 20 },
  textoMorto: { color: '#FF4444', fontSize: 24, fontWeight: '900', marginBottom: 5 },
  subTextoMorto: { color: '#FFF', fontSize: 14 }
});
