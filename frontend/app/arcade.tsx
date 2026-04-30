import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext'; 
import * as api from '../src/services/api'; 
import { useFocusEffect, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.62; 
const CARD_WIDTH = 105;
const DROP_LIMIT = GAME_AREA_HEIGHT - 30; 

const ContadorExpiracao = ({ expiraEm, esgotado }: { expiraEm: string, esgotado: boolean }) => {
  const [tempoRestanteStr, setTempoRestanteStr] = useState('');

  useEffect(() => {
    if (!expiraEm || esgotado) return;
    const targetTime = new Date(expiraEm).getTime();
    let timeoutId: NodeJS.Timeout;

    const atualizar = () => {
      const now = Date.now();
      const r = targetTime - now;
      if (r <= 0) { setTempoRestanteStr('Expirado'); return; }
      const totalSecs = Math.round(r / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      if (r > 60 * 1000) setTempoRestanteStr(h > 0 ? `⏱ ${h}h ${m}m restantes` : `⏱ ${m}m restantes`);
      else setTempoRestanteStr(`⏱ ${s}s restantes`); 

      const MIN = 60 * 1000;
      let delay = 1000;
      if (r <= 1 * MIN) delay = 1000;
      else if (r <= 5 * MIN) delay = Math.min(r % (1 * MIN) || (1 * MIN), r - 1 * MIN); 
      else if (r <= 15 * MIN) delay = Math.min(r % (5 * MIN) || (5 * MIN), r - 5 * MIN); 
      else if (r <= 30 * MIN) delay = Math.min(r % (10 * MIN) || (10 * MIN), r - 15 * MIN); 
      else delay = Math.min(r % (30 * MIN) || (30 * MIN), r - 30 * MIN);

      timeoutId = setTimeout(atualizar, Math.max(delay, 100));
    };
    atualizar();
    return () => clearTimeout(timeoutId);
  }, [expiraEm, esgotado]);

  if (esgotado || !tempoRestanteStr) return null;
  return <Text style={{ color: tempoRestanteStr === 'Expirado' ? '#FF4444' : '#FFD700', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>{tempoRestanteStr}</Text>;
};

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

export default function Arcade() {
  const router = useRouter();
  const { user } = useAuth(); 
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [pontos, setPontos] = useState(0);
  const pontosRef = useRef(0);
  const [vidas, setVidas] = useState(5); 
  const [resposta, setResposta] = useState('');
  const [operacoes, setOperacoes] = useState<any[]>([]); 
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [missoesDisponiveis, setMissoesDisponiveis] = useState<any[]>([]);
  const [modoMatematica, setModoMatematica] = useState('misto');
  const [rankingArcade, setRankingArcade] = useState<any[]>([]);
  const [corLaserPersonalizada, setCorLaserPersonalizada] = useState('#32CD32');
  const [pausado, setPausado] = useState(false);
  const [faseAtualVisor, setFaseAtualVisor] = useState(1);
  const [mostrarFase, setMostrarFase] = useState(false);
  const fadeFaseAnim = useRef(new Animated.Value(0)).current;
  const transicaoAtivaRef = useRef(false);
  const fasePendenteRef = useRef(false);
  const proximaFaseNumRef = useRef(1);

  const modoRef = useRef<'single' | 'bot' | 'missao'>('single'); 
  const modoMatematicaRef = useRef('misto'); 
  const missaoAtualRef = useRef<any>(null);
  const filaQuestoesRef = useRef<any[]>([]); 
  const questoesEmJogoRef = useRef(0);
  
  const operacoesAtuaisRef = useRef<any[]>([]);
  const operacoesListRef = useRef<any[]>([]); 
  const rodadaRef = useRef(1);
  const jogoPausadoRef = useRef(false); 
  const jogoAtivoRef = useRef(false);
  
  const spawnTimer = useRef<any>(null);
  const botTimer = useRef<any>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [lasersAtivos, setLasersAtivos] = useState<any[]>([]);
  const [explosoes, setExplosoes] = useState<any[]>([]); 
  const desempenhoOcultoRef = useRef(0); 
  const ultimasRespostasRef = useRef<number[]>([]);

  const [teclasPressionadas, setTeclasPressionadas] = useState<string[]>([]);
  const triggeredTouchesRef = useRef<Set<string>>(new Set());
  const respostaRef = useRef('');

  // =========================================================================
  // SISTEMA DUPLO DE ÁUDIO E CONTROLE DE VOLUME (BGM vs SFX)
  // =========================================================================
  const [volumeBGM, setVolumeBGM] = useState<number>(0.8); // Fundo começa alto
  const [volumeSFX, setVolumeSFX] = useState<number>(0.15); // Efeitos começam baixinhos
  const [mostrarVolume, setMostrarVolume] = useState(false);
  
  const volumeBGMRef = useRef<number>(0.8);
  const volumeSFXRef = useRef<number>(0.15);
  
  const sonsRef = useRef<any>({});
  const bgmRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const carregarSons = async () => {
      try {
        sonsRef.current.shoot = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Zenoguy/Space_Shooters/main/bgm/laser.mp3' })).sound;
        sonsRef.current.hit = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Gtajisan/bongoboltu_2.0/main/hit.mp3' })).sound;
        sonsRef.current.miss = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Gtajisan/bongoboltu_2.0/main/miss.mp3' })).sound;
        sonsRef.current.damage = (await Audio.Sound.createAsync({ uri: 'https://raw.githubusercontent.com/Zenoguy/Space_Shooters/main/bgm/explosion.mp3' })).sound;

        const { sound: bgmSound } = await Audio.Sound.createAsync(
            { uri: 'https://raw.githubusercontent.com/photonstorm/macapaka/master/assets/audio/music.mp3' }, 
            { isLooping: true, volume: volumeBGMRef.current }
        );
        bgmRef.current = bgmSound;
      } catch (error) {
        console.log("Erro ao carregar sons", error);
      }
    };
    carregarSons();

    return () => {
      Object.values(sonsRef.current).forEach((s: any) => s?.unloadAsync());
      if (bgmRef.current) bgmRef.current.unloadAsync();
    };
  }, []);

  const iniciarBGM = async () => {
    try {
        if (bgmRef.current) {
            await bgmRef.current.setVolumeAsync(volumeBGMRef.current);
            await bgmRef.current.playAsync();
        }
    } catch(e) {}
  };

  const pararBGM = async () => {
    try {
        if (bgmRef.current) await bgmRef.current.pauseAsync();
    } catch(e) {}
  };

  const tocarSom = async (tipo: string) => {
    try {
      if (sonsRef.current[tipo] && volumeSFXRef.current > 0) {
        await sonsRef.current[tipo].setVolumeAsync(volumeSFXRef.current);
        await sonsRef.current[tipo].replayAsync();
      }
    } catch (e) {}
  };

  const abrirMenuVolume = () => {
      if (jogoAtivoRef.current && !jogoPausadoRef.current) {
          pausarJogo();
      }
      setMostrarVolume(true);
  };
  // =========================================================================

  useEffect(() => { respostaRef.current = resposta; }, [resposta]);
  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);
  useEffect(() => { modoMatematicaRef.current = modoMatematica; }, [modoMatematica]);
  useEffect(() => { pontosRef.current = pontos; }, [pontos]);

  const carregarDadosMenu = async () => {
    carregarMissoes();
    try { const data = await api.getRankingArcade(); setRankingArcade(Array.isArray(data) ? data : []); } catch (e) {}
  };

  useEffect(() => { if (tela === 'menu') carregarDadosMenu(); }, [tela]);

  const executarAcaoTecla = (valor: string) => {
    setResposta(currentResposta => {
        if (valor === 'apagar') return currentResposta.slice(0, -1);
        else if (valor === 'enviar') { setTimeout(() => verificarRespostaComValor(currentResposta), 0); return currentResposta; }
        else return currentResposta.length < 5 ? currentResposta + valor : currentResposta;
    });
  };

  const getTeclaFromCoords = (x: number, y: number) => {
    let col = -1;
    if (x >= 0 && x <= 92) col = 0; else if (x > 92 && x <= 187) col = 1; else if (x > 187 && x <= 280) col = 2;
    let row = -1;
    if (y >= 0 && y <= 50) row = 0; else if (y > 50 && y <= 103) row = 1; else if (y > 103 && y <= 156) row = 2; else if (y > 156 && y <= 210) row = 3;
    if (col === -1 || row === -1) return null;
    const layout = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3'], ['apagar', '0', 'enviar']];
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
        if (!triggeredTouchesRef.current.has(key)) { triggeredTouchesRef.current.add(key); executarAcaoTecla(key); }
    });
    triggeredTouchesRef.current.forEach(key => {
        if (!currentActive.has(key)) triggeredTouchesRef.current.delete(key);
    });
  };

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const handleKeyDownLocal = (e: any) => {
            if (tela !== 'jogo' || !jogoAtivoRef.current || jogoPausadoRef.current || mostrarVolume) return;
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
  }, [tela, mostrarVolume]);

  const processarErroRef = useRef<any>(null);
  const processarErro = useCallback((opId: string) => {
    if (opId === 'nenhum') { setVidas(v => { const nv = v - 1; if (nv <= 0) gameOver(); return nv; }); return; }
    const opInfo = operacoesListRef.current.find(o => o.id === opId);
    if (!opInfo) return;
    opInfo.y.stopAnimation();
    
    const expId = Math.random().toString();
    setExplosoes(prev => [...prev, { id: expId, x: opInfo.posX, y: DROP_LIMIT, texto: opInfo.textoTela, corEspecial: opInfo.tipoEspecial !== 'nenhum' }]);
    setTimeout(() => { setExplosoes(prev => prev.filter(e => e.id !== expId)); }, 800);
    
    tocarSom('damage');

    setVidas(v => { const nv = v - 1; if (nv <= 0) gameOver(); return nv; });
    questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
    setOperacoes(prev => prev.filter(o => o.id !== opId));
    operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opId);
  }, []);

  useEffect(() => { processarErroRef.current = processarErro; }, [processarErro]);

  const carregarMissoes = async () => {
    try { const data = await api.getMissoesDisponiveis(); setMissoesDisponiveis(Array.isArray(data) ? data : []); } catch (e) {}
  };

  const confirmarDelecaoMissao = (id: string) => {
    const mensagem = "Tem certeza que deseja APAGAR este jogo personalizado do sistema?";
    if (Platform.OS === 'web') {
      if (window.confirm(mensagem)) executarDelecaoMissao(id);
    } else {
      Alert.alert("Apagar", mensagem, [{ text: "Cancelar", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: () => executarDelecaoMissao(id) }]);
    }
  };

  const executarDelecaoMissao = async (id: string) => {
    try { await api.deletarJogo(id); Alert.alert("Sucesso", "O jogo foi removido."); carregarMissoes(); } catch (error) {}
  };

  useEffect(() => {
    if (modoRef.current === 'missao' && jogoAtivoRef.current) {
      if (filaQuestoesRef.current.length === 0 && questoesEmJogoRef.current === 0 && operacoes.length === 0) finalizarMissaoComSucesso();
    }
    if (jogoAtivoRef.current && fasePendenteRef.current && operacoes.length === 0) {
      fasePendenteRef.current = false; rodadaRef.current = proximaFaseNumRef.current; avancarFase(proximaFaseNumRef.current);
    }
  }, [operacoes]);

  const finalizarMissaoComSucesso = async () => {
    if (!jogoAtivoRef.current) return;
    jogoAtivoRef.current = false;
    if(spawnTimer.current) clearTimeout(spawnTimer.current);
    pararBGM();
    try { if(missaoAtualRef.current?.id) await api.concluirMissao(missaoAtualRef.current.id); } catch(e) {}
    setTimeout(() => setTela('resultado'), 500);
  };

  const avancarFase = (novaFase: number) => {
    if (transicaoAtivaRef.current || !jogoAtivoRef.current) return;
    transicaoAtivaRef.current = true; setFaseAtualVisor(novaFase); setMostrarFase(true);
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    fadeFaseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(fadeFaseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500), 
      Animated.timing(fadeFaseAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setMostrarFase(false); transicaoAtivaRef.current = false;
      if (jogoAtivoRef.current && !jogoPausadoRef.current) iniciarLoopSpawner();
    });
  };

  const pausarJogo = useCallback(() => {
    if (!jogoAtivoRef.current || jogoPausadoRef.current) return;
    jogoPausadoRef.current = true; setPausado(true);
    pararBGM();
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    operacoesListRef.current.forEach(op => op.y.stopAnimation());
  }, []);

  const retomarJogo = () => {
    jogoPausadoRef.current = false; setPausado(false);
    iniciarBGM();
    if (!transicaoAtivaRef.current && !fasePendenteRef.current) iniciarLoopSpawner();
    operacoesListRef.current.forEach(op => {
      const currentY = (op.y as any)._value || 0; const distRestante = (height + 50) - currentY;
      Animated.timing(op.y, { toValue: height + 50, duration: Math.max(100, (distRestante / (height + 50)) * op.speed), useNativeDriver: true }).start();
    });
  };

  const sairDoJogo = () => {
    if (modoRef.current === 'single' && pontosRef.current > 0) api.submitArcadeScore(pontosRef.current).catch(()=>{});
    jogoAtivoRef.current = false; jogoPausadoRef.current = false; transicaoAtivaRef.current = false; fasePendenteRef.current = false;
    setPausado(false); setMostrarFase(false); setMostrarVolume(false); if (spawnTimer.current) clearTimeout(spawnTimer.current);
    pararBGM();
    setOperacoes([]); setExplosoes([]); setTela('menu');
  };

  useFocusEffect(useCallback(() => { 
      return () => { 
          if (jogoAtivoRef.current && !jogoPausadoRef.current) pausarJogo(); 
          pararBGM(); 
      }; 
  }, [pausarJogo]));

  const iniciarJogo = async (modoEscolhido: 'single' | 'bot' | 'missao', missaoDados?: any) => {
    if (modoEscolhido === 'missao' && missaoDados) {
      try { await api.registrarTentativaMissao(missaoDados.id); } catch (e) { Alert.alert("Aviso", "Você já atingiu o limite de vezes que pode jogar essa missão!"); return; }
    }
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (botTimer.current) clearInterval(botTimer.current);
    
    setOperacoes([]); setExplosoes([]); setPontos(0); pontosRef.current = 0; 
    setResposta(''); setPowerUpDisponivel(false); setPausado(false); setMostrarFase(false); setFaseAtualVisor(1); setMostrarVolume(false);
    
    operacoesAtuaisRef.current = []; ultimasRespostasRef.current = []; desempenhoOcultoRef.current = 0; questoesEmJogoRef.current = 0;
    jogoPausadoRef.current = false; jogoAtivoRef.current = true; rodadaRef.current = 1; transicaoAtivaRef.current = false; fasePendenteRef.current = false; proximaFaseNumRef.current = 1;
    modoRef.current = modoEscolhido;

    if (modoEscolhido === 'missao' && missaoDados) {
      missaoAtualRef.current = missaoDados; setVidas(missaoDados.vidas ? Number(missaoDados.vidas) : 5);
      filaQuestoesRef.current = missaoDados.questoes.map((q: any) => ({...q, id: q.id || Math.random().toString()}));
    } else { missaoAtualRef.current = null; filaQuestoesRef.current = []; setVidas(5); }
    
    setTela('jogo'); 
    iniciarBGM();
    setTimeout(() => { spawnarQuestao(); iniciarLoopSpawner(); }, 100);
  };

  const iniciarLoopSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const loop = () => {
      if (!jogoAtivoRef.current || jogoPausadoRef.current || transicaoAtivaRef.current) return;
      if (!fasePendenteRef.current) {
        if (modoRef.current === 'missao' && filaQuestoesRef.current.length === 0) {} 
        else {
          const maxOps = Math.min(15, 3 + Math.floor(pontosRef.current / 200)); 
          if (operacoesListRef.current.length < maxOps) spawnarQuestao();
        }
      }
      if (!transicaoAtivaRef.current) spawnTimer.current = setTimeout(loop, Math.max(800, 2500 - (pontosRef.current * 1.5)));
    };
    if (!transicaoAtivaRef.current) loop();
  };

  const getDynamicSettings = () => {
    const r = rodadaRef.current; let numLanes = 3;
    if (r >= 4) numLanes = 4; if (r >= 7) numLanes = 5; if (r >= 10) numLanes = 6;
    return { numLanes, laneWidth: width / numLanes, baseScale: 3 / numLanes, minDropDistance: 0.20 };
  };

  const spawnarQuestao = () => {
    let dados = null; let isMissao = modoRef.current === 'missao';
    if (isMissao) { if (filaQuestoesRef.current.length === 0) return; dados = filaQuestoesRef.current[0]; } 
    else { dados = gerarDadosArcade(); if (!dados) return; }
    const novaOp = criarObjetoAnimado(dados.texto, dados.resposta, dados.chave || dados.id, dados.speed || 10000);
    if (novaOp) { 
      if (isMissao) filaQuestoesRef.current.shift(); 
      questoesEmJogoRef.current += 1; setOperacoes(prev => [...prev, novaOp]); setTimeout(() => animarQueda(novaOp), 50); 
    }
  };

  const gerarDadosArcade = (): any => {
    const r = (max: number) => Math.floor(Math.random() * max);
    let opsPermitidas = ['+'];
    if (modoMatematicaRef.current === 'misto') {
      if (rodadaRef.current >= 2) opsPermitidas.push('-'); if (rodadaRef.current >= 4) opsPermitidas.push('×'); if (rodadaRef.current >= 6) opsPermitidas.push('÷'); if (rodadaRef.current >= 8) opsPermitidas.push('^'); if (rodadaRef.current >= 10) opsPermitidas.push('√');
    } else {
      const m = modoMatematicaRef.current; opsPermitidas = [m==='soma'?'+': m==='subtracao'?'-': m==='multiplicacao'?'×': m==='divisao'?'÷': m==='potenciacao'?'^':'√'];
    }
    let numMax = 8 + (rodadaRef.current * 2) + Math.floor(desempenhoOcultoRef.current / 4);
    let multMax = 5 + Math.floor(rodadaRef.current / 1.5); 

    for (let t = 0; t < 50; t++) {
      const op = opsPermitidas[r(opsPermitidas.length)];
      let n1=0, n2:any=0, res=0, txt='';
      switch(op) {
        case '+': n1=r(numMax)+1; n2=r(numMax)+1; res=n1+n2; txt=`${n1} + ${n2}`; break;
        case '-': n1=r(numMax*1.5)+5; n2=r(n1)+1; res=n1-n2; txt=`${n1} - ${n2}`; break;
        case '×': n1=r(multMax)+2; n2=r(multMax)+2; res=n1*n2; txt=`${n1} × ${n2}`; break;
        case '÷': n2=r(multMax)+2; res=r(multMax + 4)+1; n1=n2*res; txt=`${n1} ÷ ${n2}`; break;
        case '^': 
          let maxBase = Math.min(5 + Math.floor(rodadaRef.current / 2), 20); n1 = r(maxBase - 1) + 2; 
          let maxExp = 2;
          if (n1 === 2) maxExp = Math.min(3 + Math.floor(rodadaRef.current / 3), 7); else if (n1 === 3) maxExp = Math.min(2 + Math.floor(rodadaRef.current / 4), 4); else if (n1 <= 5) maxExp = Math.min(2 + Math.floor(rodadaRef.current / 10), 3);
          n2 = r(maxExp - 1) + 2; res = Math.pow(n1, n2);
          const s:any = {2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷'}; txt = `${n1}${s[n2] || '^'+n2}`; break;
        case '√': res=r(multMax+4)+2; n1=res*res; n2=''; txt=`√${n1}`; break;
      }
      const chave = `${n1}${op}${n2}`;
      if (ultimasRespostasRef.current.includes(res) || operacoesAtuaisRef.current.some(o => o.chave === chave)) continue;
      ultimasRespostasRef.current.push(res); if(ultimasRespostasRef.current.length > 4) ultimasRespostasRef.current.shift();
      return { texto: txt, resposta: res, chave, speed: Math.max(3500, 10000 - (rodadaRef.current * 150)) };
    }
    if (!fasePendenteRef.current) { fasePendenteRef.current = true; proximaFaseNumRef.current = rodadaRef.current + 1; desempenhoOcultoRef.current += 1; if (proximaFaseNumRef.current > 100) ultimasRespostasRef.current = []; }
    return null; 
  };

  const criarObjetoAnimado = (texto: string, resposta: number, chave: string, velocidade: number) => {
    const { numLanes, laneWidth, baseScale, minDropDistance } = getDynamicSettings();
    const pistasDisponiveis = Array.from({length: numLanes}, (_, i) => i).filter(p => {
      const opsNaPista = operacoesAtuaisRef.current.filter(o => o.lane === p);
      if (opsNaPista.length === 0) return true;
      return Math.min(...opsNaPista.map(o => o.y)) > (DROP_LIMIT * minDropDistance);
    });
    if (pistasDisponiveis.length === 0) return null;
    
    const lane = pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
    const id = Math.random().toString();
    operacoesAtuaisRef.current.push({ lane, y: 0, chave: id, missed: false });
    
    let tipoEspecial = 'nenhum'; const rand = Math.random();
    if (rand < 0.01) tipoEspecial = 'vida'; else if (rand < 0.04) tipoEspecial = 'destruir';

    const yValue = new Animated.Value(0);
    yValue.addListener(({ value }: any) => {
      const ref = operacoesAtuaisRef.current.find((o:any) => o.chave === id);
      if (ref) { ref.y = value; if (value >= DROP_LIMIT && !ref.missed) { ref.missed = true; if (processarErroRef.current) processarErroRef.current(id); } }
    });

    return { 
      id, chaveOriginal: chave, resposta, textoTela: texto, y: yValue, speed: velocidade, 
      posX: (lane * laneWidth) + (laneWidth / 2) - (CARD_WIDTH / 2), lane, tipoEspecial, baseScale, opacity: new Animated.Value(1), scale: new Animated.Value(baseScale) 
    };
  };

  const animarQueda = (op: any) => { if (!jogoAtivoRef.current || jogoPausadoRef.current) return; Animated.timing(op.y, { toValue: height + 100, duration: op.speed, useNativeDriver: true }).start(); };

  const gameOver = () => { 
    jogoAtivoRef.current = false; jogoPausadoRef.current = false; transicaoAtivaRef.current = false; fasePendenteRef.current = false; setPausado(false); setMostrarVolume(false);
    if (spawnTimer.current) clearTimeout(spawnTimer.current); setOperacoes([]); setExplosoes([]);
    if (modoRef.current === 'single' && pontosRef.current > 0) api.submitArcadeScore(pontosRef.current).catch(()=>{});
    pararBGM();
    setTela('resultado'); 
  };

  const verificarRespostaComValor = (valorStr: string) => {
    if (jogoPausadoRef.current || !jogoAtivoRef.current || isNaN(parseInt(valorStr))) return;
    const alvo = operacoesListRef.current.find(op => op.resposta === parseInt(valorStr));

    if (alvo) {
      alvo.y.stopAnimation(); questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
      setPontos(p => { 
        const novo = p + 10; 
        if (modoRef.current !== 'missao' && Math.floor(novo/50) > Math.floor(p/50)) { 
           if (!fasePendenteRef.current) { fasePendenteRef.current = true; proximaFaseNumRef.current = rodadaRef.current + 1; desempenhoOcultoRef.current += 1; }
        } return novo; 
      });

      if (alvo.tipoEspecial === 'destruir' && !powerUpDisponivel) setPowerUpDisponivel(true);
      else if (alvo.tipoEspecial === 'vida') setVidas(v => Math.min(v + 1, 7)); 

      dispararLaserUnico(alvo, true);
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== alvo.id);
      setTimeout(() => { setOperacoes(prev => prev.filter(o => o.id !== alvo.id)); setResposta(''); }, 300);
    } else { dispararLaserUnico(null, false); processarErro('nenhum'); setResposta(''); }
  };

  const calcularDadosLaser = (alvo: any, acertou: boolean) => {
    const originX = width / 2; const originY = DROP_LIMIT + 30; 
    const targetX = acertou && alvo ? alvo.posX + CARD_WIDTH / 2 : width / 2; const targetY = acertou && alvo ? (alvo.y as any)._value + 20 : DROP_LIMIT * 0.2;
    const dx = targetX - originX; const dy = targetY - originY;
    return { x: originX + dx / 2, y: originY + dy / 2, h: Math.sqrt(dx * dx + dy * dy), angle: `${Math.atan2(dy, dx) + Math.PI / 2}rad`, cor: acertou ? corLaserPersonalizada : '#FF4444' };
  };

  const dispararLaserUnico = (alvo: any, acertou: boolean) => {
    setLasersAtivos([calcularDadosLaser(alvo, acertou)]); laserAnim.setValue(1);
    
    tocarSom('shoot');

    const duracaoLaser = acertou ? 300 : 150;
    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 0, duration: duracaoLaser, useNativeDriver: true }), 
      ...(acertou && alvo ? [ Animated.timing(alvo.scale, { toValue: alvo.baseScale * 1.4, duration: 150, useNativeDriver: true }), Animated.timing(alvo.opacity, { toValue: 0, duration: 150, useNativeDriver: true }) ] : [])
    ]).start(() => setLasersAtivos([]));
    
    setTimeout(() => { if (acertou) tocarSom('hit'); else tocarSom('miss'); }, duracaoLaser - 50);

    if (!acertou) Animated.sequence([Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }), Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }), Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })]).start();
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel || jogoPausadoRef.current || transicaoAtivaRef.current) return;
    const visiveis = operacoes.filter(o => (o.y as any)._value < DROP_LIMIT);
    if (visiveis.length === 0) { setPowerUpDisponivel(false); return; }
    
    visiveis.forEach(o => o.y.stopAnimation());
    setLasersAtivos(visiveis.map(alvo => calcularDadosLaser(alvo, true)));
    laserAnim.setValue(1);
    
    tocarSom('shoot');

    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ...visiveis.flatMap(alvo => [Animated.timing(alvo.scale, { toValue: alvo.baseScale * 1.5, duration: 200, useNativeDriver: true }), Animated.timing(alvo.opacity, { toValue: 0, duration: 200, useNativeDriver: true })])
    ]).start(() => {
       tocarSom('hit');
       setLasersAtivos([]); setPontos(p => p + (visiveis.length * 10)); questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - visiveis.length);
       setOperacoes(prev => prev.filter(o => !visiveis.includes(o))); operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => !visiveis.some(v => v.chave === o.chave));
    });
    setPowerUpDisponivel(false);
  };

  if (tela === 'menu') {
    const modosArcade = [
      { id: 'misto', name: 'Jornada', color: '#FFD700', icon: 'infinite' }, { id: 'soma', name: 'Soma', color: '#32CD32', icon: 'add' }, { id: 'subtracao', name: 'Subtração', color: '#FF4444', icon: 'remove' },
      { id: 'multiplicacao', name: 'Multiplicação', color: '#4169E1', icon: 'close' }, { id: 'divisao', name: 'Divisão', color: '#9B59B6', icon: 'code-slash' }, { id: 'potenciacao', name: 'Potências', color: '#FF8C00', icon: 'chevron-up' },
      { id: 'radiciacao', name: 'Raízes', color: '#00CED1', icon: 'flash' }
    ];
    const meuRank = rankingArcade.find(j => j.id === user?.id);

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.menuContainer}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color="#FFF" /></TouchableOpacity>
            <View style={styles.menuHeader}><Ionicons name="game-controller" size={64} color="#FFD700" /><Text style={styles.menuTitle}>Matemática Turbo</Text><Text style={styles.menuSubtitle}>Treinamento Adaptativo</Text></View>
            <View style={styles.rankingContainer}>
              <View style={styles.rankingHeaderRow}><Ionicons name="trophy" size={24} color="#FFD700" /><Text style={styles.rankingTitle}>HALL DA FAMA - ARCADE</Text></View>
              <View style={styles.rankingScrollWrapper}>
                <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {rankingArcade.length > 0 ? (
                    rankingArcade.map((jogador) => {
                      let corPosicao = '#888'; if (jogador.posicao === 1) corPosicao = '#FFD700'; else if (jogador.posicao === 2) corPosicao = '#C0C0C0'; else if (jogador.posicao === 3) corPosicao = '#CD7F32';
                      const isMe = jogador.id === user?.id;
                      return (
                        <View key={jogador.posicao} style={[styles.rankingRow, isMe && styles.rankingRowMe]}>
                          <View style={styles.rankingLeft}>
                            <Text style={[styles.rankingPosText, { color: corPosicao }]}>#{jogador.posicao}</Text>
                            <View>
                              <Text style={[styles.rankingNameText, isMe && { color: '#00FFFF' }, jogador.isProf && { color: '#E74C3C' }]}>{jogador.nome} {jogador.isProf ? '👑' : ''}</Text>
                              {!jogador.isProf && jogador.equipe ? (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: jogador.cor }} /><Text style={{ color: '#AAA', fontSize: 11, fontWeight: 'bold' }}>{jogador.equipe}</Text>{jogador.turma ? <Text style={{ color: '#666', fontSize: 11 }}>• {jogador.turma}</Text> : null}</View>) : null}
                            </View>
                          </View>
                          <Text style={[styles.rankingScoreText, isMe && { color: '#00FFFF' }]}>{jogador.pontosMaximos} pts</Text>
                        </View>
                      );
                    })
                  ) : (<View style={{ padding: 15, alignItems: 'center' }}><Text style={{ color: '#888', fontStyle: 'italic' }}>Nenhum jogador pontuou ainda. Seja o primeiro!</Text></View>)}
                </ScrollView>
              </View>
              {meuRank && (
                <View style={styles.myRankingFixed}>
                  <Text style={styles.myRankingLabel}>Sua Posição Atual:</Text>
                  <View style={styles.rankingLeft}><Text style={[styles.rankingPosText, { color: '#00FFFF' }]}>#{meuRank.posicao}</Text><Text style={[styles.rankingScoreText, { color: '#00FFFF' }]}>{meuRank.pontosMaximos} pts</Text></View>
                </View>
              )}
            </View>

            {missoesDisponiveis.length > 0 && (
              <View style={{width: '100%', marginBottom: 20}}>
                <Text style={styles.sectionLabel}>🎯 Missões do Professor:</Text>
                {missoesDisponiveis.map((missao, index) => {
                  const limite = missao.limiteTentativas !== undefined ? missao.limiteTentativas : 1; const feitas = missao.tentativasFeitas || 0; const esgotado = limite !== 0 && feitas >= limite;
                  return (
                    <View key={missao.id || index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <TouchableOpacity style={[styles.missaoCard, esgotado && { backgroundColor: '#333' }, { flex: 1, marginBottom: 0 }]} onPress={() => !esgotado && iniciarJogo('missao', missao)} activeOpacity={esgotado ? 1 : 0.7}>
                          <View style={styles.missaoIcon}><Ionicons name={esgotado ? "lock-closed" : "trophy"} size={24} color="#FFF" /></View>
                          <View style={{flex: 1}}><Text style={[styles.missaoTitle, esgotado && {color: '#888'}]}>{missao.titulo}</Text><Text style={[styles.missaoSub, esgotado && {color: '#666'}]}>{missao.recompensa} Pts • {limite === 0 ? 'Tents. Ilimitadas' : `Tentativas: ${feitas}/${limite}`}</Text>{missao.expiraEm && <ContadorExpiracao expiraEm={missao.expiraEm} esgotado={esgotado} />}</View>
                          <Ionicons name="play-circle" size={32} color={esgotado ? "#555" : "#FFF"} />
                        </TouchableOpacity>
                        {user?.perfil === 'ADMIN' && (<TouchableOpacity style={{ backgroundColor: '#E74C3C', padding: 15, borderRadius: 12, marginLeft: 8, justifyContent: 'center', alignItems: 'center' }} onPress={() => confirmarDelecaoMissao(missao.id)}><Text style={{color: '#FFF', fontWeight: '900', fontSize: 18}}>X</Text></TouchableOpacity>)}
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionLabel}>Escolha seu Modo Livre (Arcade):</Text>
            <View style={styles.modosGrid}>
              {modosArcade.map(m => {
                const isSelected = modoMatematica === m.id;
                return (
                  <TouchableOpacity key={m.id} style={[styles.modoCardItem, isSelected && { borderColor: m.color, backgroundColor: m.color + '15' }]} onPress={() => setModoMatematica(m.id)}>
                    <Ionicons name={m.icon as any} size={28} color={isSelected ? m.color : '#555'} />
                    <Text style={[styles.modoTextItem, isSelected && { color: m.color }]}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.btnIniciarWrapper}>
            <TouchableOpacity style={styles.iniciarButton} onPress={() => iniciarJogo('single')}><Ionicons name="play" size={24} color="#000" /><Text style={styles.iniciarButtonText}>INICIAR MODO LIVRE</Text></TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (tela === 'resultado') {
    const venceu = modoRef.current === 'missao' && vidas > 0;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.resultadoContainer}>
          <Text style={styles.resultadoTitle}>{venceu ? '🎯 Missão Cumprida!' : 'Fim de Jogo!'}</Text>
          {venceu && <View style={[styles.resultadoCard, {backgroundColor: '#32CD3220'}]}><Text style={[styles.resultadoPontos, {color: '#32CD32', fontSize:32}]}>+{missaoAtualRef.current?.recompensa} Pts Bônus</Text></View>}
          <View style={styles.resultadoCard}><Text style={styles.resultadoPontos}>{pontos}</Text><Text style={styles.resultadoLabel}>Pontos Totais</Text></View>
          <TouchableOpacity style={styles.jogarNovamenteButton} onPress={() => setTela('menu')}><Ionicons name="home" size={22} color="#000" /><Text style={styles.jogarNovamenteText}>Voltar ao Menu</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {mostrarFase && (
        <Animated.View style={[styles.transicaoOverlay, { opacity: fadeFaseAnim }]}><View style={styles.transicaoBox}><Text style={styles.transicaoText}>FASE {faseAtualVisor}</Text></View></Animated.View>
      )}

      {/* NOVO MENU DE VOLUME MODAL (Estiloso e Pausa o Jogo) */}
      {mostrarVolume && (
        <View style={styles.volumeOverlay}>
          <View style={styles.volumeModal}>
            <Text style={styles.volumeTitle}>
                <Ionicons name="settings" size={22} color="#FFD700" /> Áudio
            </Text>

            <Text style={styles.volumeLabel}>Música de Fundo</Text>
            <View style={styles.sliderRow}>
              <Ionicons name="musical-notes" size={20} color="#00FFFF" />
              <Slider
                style={{flex: 1, height: 40, marginHorizontal: 10}}
                minimumValue={0}
                maximumValue={1}
                value={volumeBGM}
                onValueChange={(val) => {
                    setVolumeBGM(val);
                    volumeBGMRef.current = val;
                    if (bgmRef.current) bgmRef.current.setVolumeAsync(val);
                }}
                minimumTrackTintColor="#00FFFF"
                maximumTrackTintColor="#555"
                thumbTintColor="#00FFFF"
              />
            </View>

            <Text style={styles.volumeLabel}>Efeitos Sonoros</Text>
            <View style={styles.sliderRow}>
              <Ionicons name="flash" size={20} color="#FFD700" />
              <Slider
                style={{flex: 1, height: 40, marginHorizontal: 10}}
                minimumValue={0}
                maximumValue={1}
                value={volumeSFX}
                onValueChange={(val) => {
                    setVolumeSFX(val);
                    volumeSFXRef.current = val;
                }}
                minimumTrackTintColor="#FFD700"
                maximumTrackTintColor="#555"
                thumbTintColor="#FFD700"
              />
            </View>

            <TouchableOpacity style={styles.btnCloseVolume} onPress={() => setMostrarVolume(false)}>
              <Text style={styles.btnCloseVolumeText}>FECHAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {pausado && !mostrarVolume && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseTitle}>JOGO PAUSADO</Text>
          <TouchableOpacity style={styles.btnContinuar} onPress={retomarJogo}><Ionicons name="play" size={24} color="#000" /><Text style={styles.btnContinuarText}>CONTINUAR</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnSair} onPress={sairDoJogo}><Ionicons name="exit" size={24} color="#fff" /><Text style={styles.btnSairText}>SAIR PARA O MENU</Text></TouchableOpacity>
        </View>
      )}

      <View style={styles.gameHeader}>
        <View style={styles.headerStatsGroup}><Ionicons name="star" size={18} color="#FFD700" /><Text style={styles.statTextScore}>{pontos}</Text>{modoRef.current !== 'missao' && (<View style={styles.faseBadge}><Text style={styles.faseBadgeText}>Fase {faseAtualVisor}</Text></View>)}</View>
        
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
            <TouchableOpacity onPress={abrirMenuVolume} style={styles.btnPausaIcone}>
                <Ionicons name="settings" size={26} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={pausarJogo} style={styles.btnPausaIcone}><Ionicons name="pause" size={26} color="#fff" /></TouchableOpacity>
        </View>
      </View>

      <View style={styles.vidasContainer}>{Array.from({ length: Math.max(0, vidas) }).map((_, i) => <Ionicons key={i} name="heart" size={16} color="#FF4444" style={{marginHorizontal:2}} />)}</View>
      
      <View style={styles.gameArea}>
        <View style={styles.linhaEletricaContainer}><View style={styles.linhaEletricaCore} /><View style={styles.linhaEletricaGlow} /></View>

        {operacoes.map((op) => ( 
          <Animated.View key={op.id} style={[styles.operacaoCard, op.tipoEspecial === 'destruir' && styles.operacaoEspecial, op.tipoEspecial === 'vida' && styles.operacaoVida, { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity, width: CARD_WIDTH }]}> 
            <Text style={[styles.operacaoText, op.tipoEspecial !== 'nenhum' && { color: '#000' }]}>{op.textoTela} {op.tipoEspecial === 'vida' ? '❤' : ''}</Text> 
          </Animated.View> 
        ))}
        {explosoes.map(exp => (
          <View key={exp.id} style={[styles.explosaoContainer, { left: exp.x, top: exp.y }]}><Particula char={exp.texto.charAt(0)} /><Particula char={exp.texto.charAt(1) || '*'} /></View>
        ))}
        {lasersAtivos.map((laserInfo, index) => (
          <Animated.View key={`laser-${index}`} style={[styles.laser, { left: laserInfo.x - 2, top: laserInfo.y - laserInfo.h / 2, height: laserInfo.h, transform: [{ rotate: laserInfo.angle }], backgroundColor: laserInfo.cor, opacity: laserAnim }]} />
        ))}
      </View>
      
      <View style={styles.bottomPanel}>
        <View style={styles.powerUpContainer}>{powerUpDisponivel && <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}><Ionicons name="flash" size={18} color="#000" /><Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text></TouchableOpacity>}</View>
        
        <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}><Text style={styles.displayText}>{resposta || ' '}</Text></Animated.View>
        
        <View style={styles.tecladoContainer}>
          <View style={styles.tecladoGrid}>
            {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
              <View key={i} style={styles.tecladoRow}>
                {row.map(num => (
                  <BotaoVisual key={num} valor={num} isPressed={teclasPressionadas.includes(num)} onPressWeb={executarAcaoTecla}>
                    <Text style={styles.teclaText}>{num}</Text>
                  </BotaoVisual>
                ))}
              </View>
            ))}
            <View style={styles.tecladoRow}>
              <BotaoVisual valor="apagar" isPressed={teclasPressionadas.includes('apagar')} onPressWeb={executarAcaoTecla} styleExtra={styles.teclaApagar}><Ionicons name="close" size={24} color="#fff" /></BotaoVisual>
              <BotaoVisual valor="0" isPressed={teclasPressionadas.includes('0')} onPressWeb={executarAcaoTecla}><Text style={styles.teclaText}>0</Text></BotaoVisual>
              <BotaoVisual valor="enviar" isPressed={teclasPressionadas.includes('enviar')} onPressWeb={executarAcaoTecla} styleExtra={styles.teclaEnviar}><Ionicons name="checkmark" size={28} color="#fff" /></BotaoVisual>
            </View>
          </View>

          {Platform.OS !== 'web' && (
             <View style={StyleSheet.absoluteFillObject} onStartShouldSetResponder={() => true} onResponderGrant={handleMultiTouch} onResponderMove={handleMultiTouch} onResponderRelease={handleMultiTouch} onResponderTerminate={handleMultiTouch} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  menuContainer: { flex: 1 },
  menuScrollContent: { padding: 20, alignItems: 'center', paddingBottom: 20 },
  menuHeader: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  menuTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 12 },
  menuSubtitle: { fontSize: 15, color: '#888', marginTop: 4 },
  
  rankingContainer: { width: '100%', marginBottom: 25, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#FFD70040' },
  rankingHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  rankingTitle: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
  rankingScrollWrapper: { maxHeight: 180, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden' },
  rankingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rankingRowMe: { backgroundColor: 'rgba(0, 255, 255, 0.15)' },
  rankingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankingPosText: { fontWeight: '900', fontSize: 16, width: 30 },
  rankingNameText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  rankingScoreText: { color: '#00FFFF', fontWeight: 'bold', fontSize: 15 },
  myRankingFixed: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myRankingLabel: { color: '#AAA', fontSize: 13, fontWeight: '600' },

  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12, alignSelf: 'flex-start', marginTop: 10 },
  missaoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF69B4', padding: 15, borderRadius: 16, width: '100%', elevation: 3 },
  missaoIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  missaoTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  missaoSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  modosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 30 },
  modoCardItem: { backgroundColor: '#1a1a2e', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', width: '30%', gap: 8, elevation: 2 },
  modoTextItem: { color: '#888', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  btnIniciarWrapper: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 10, backgroundColor: '#0c0c0c', borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', elevation: 4 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, zIndex: 10 },
  headerStatsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextScore: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  faseBadge: { backgroundColor: '#4169E1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
  faseBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  btnPausaIcone: { padding: 4, marginLeft: 10 },
  
  // Menu de Volume Flutuante
  volumeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, justifyContent: 'center', alignItems: 'center' },
  volumeModal: { backgroundColor: '#1a1a2e', borderWidth: 2, borderColor: '#FFD700', borderRadius: 16, padding: 25, width: '85%', maxWidth: 350 },
  volumeTitle: { color: '#FFD700', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  volumeLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginTop: 10, marginBottom: 5 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  btnCloseVolume: { backgroundColor: '#E74C3C', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnCloseVolumeText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

  vidasContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, height: 30 },
  
  gameArea: { flex: 1, width: '100%', backgroundColor: '#0a0a0a', zIndex: 1 },
  linhaEletricaContainer: { position: 'absolute', top: DROP_LIMIT, width: '100%', height: 10, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  linhaEletricaCore: { width: '100%', height: 2, backgroundColor: '#00FFFF', shadowColor: '#00FFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  linhaEletricaGlow: { position: 'absolute', width: '100%', height: 8, backgroundColor: 'rgba(0, 255, 255, 0.3)' },

  operacaoCard: { position: 'absolute', top: 0, backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 10 },
  operacaoEspecial: { backgroundColor: '#FFD700' },
  operacaoVida: { backgroundColor: '#32CD32', borderWidth: 2, borderColor: '#fff' }, 
  operacaoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  
  explosaoContainer: { position: 'absolute', width: CARD_WIDTH, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 15 },
  particulaTexto: { position: 'absolute', color: '#00FFFF', fontSize: 22, fontWeight: '900', textShadowColor: '#00FFFF', textShadowRadius: 10 },

  laser: { position: 'absolute', width: 4, zIndex: 1, borderRadius: 2 },
  
  bottomPanel: { width: '100%', alignItems: 'center', paddingBottom: 15, paddingTop: 5, backgroundColor: '#0c0c0c', zIndex: 10 },
  powerUpContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 8, height: 40 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  
  displayContainer: { backgroundColor: 'rgba(26, 26, 46, 0.7)', width: 280, height: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  displayText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  
  tecladoContainer: { width: 280, position: 'relative' },
  tecladoGrid: { width: '100%', gap: 5 },
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
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
  pauseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 100, justifyContent: 'center', alignItems: 'center', padding: 20 },
  pauseTitle: { color: '#FFD700', fontSize: 32, fontWeight: '900', marginBottom: 30, letterSpacing: 2 },
  btnContinuar: { backgroundColor: '#32CD32', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, width: '80%', justifyContent: 'center', gap: 10, marginBottom: 15 },
  btnContinuarText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  btnSair: { backgroundColor: '#E74C3C', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, width: '80%', justifyContent: 'center', gap: 10 },
  btnSairText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  transicaoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 50, backgroundColor: 'rgba(0,0,0,0.4)' },
  transicaoBox: { backgroundColor: 'rgba(255, 215, 0, 0.95)', paddingVertical: 20, paddingHorizontal: 50, borderRadius: 20, elevation: 10 },
  transicaoText: { color: '#000', fontSize: 36, fontWeight: '900', letterSpacing: 3, textTransform: 'uppercase' }
});
