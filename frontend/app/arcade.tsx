import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView, Alert, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext'; 
import * as api from '../src/services/api'; 
import { useFocusEffect, useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.62; 
const CARD_WIDTH = 105;
const DROP_LIMIT = GAME_AREA_HEIGHT - 30; 

// =========================================================================
// MOTOR DO CONTADOR DINÂMICO
// =========================================================================
const ContadorExpiracao = ({ expiraEm, esgotado }: { expiraEm: string, esgotado: boolean }) => {
  const [tempoRestanteStr, setTempoRestanteStr] = useState('');

  useEffect(() => {
    if (!expiraEm || esgotado) return;
    const targetTime = new Date(expiraEm).getTime();
    let timeoutId: NodeJS.Timeout;

    const atualizar = () => {
      const now = Date.now();
      const r = targetTime - now;

      if (r <= 0) {
        setTempoRestanteStr('Expirado');
        return;
      }

      const totalSecs = Math.round(r / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;

      if (r > 60 * 1000) {
         setTempoRestanteStr(h > 0 ? `⏱ ${h}h ${m}m restantes` : `⏱ ${m}m restantes`);
      } else {
         setTempoRestanteStr(`⏱ ${s}s restantes`); 
      }

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
  
  return (
    <Text style={{ color: tempoRestanteStr === 'Expirado' ? '#FF4444' : '#FFD700', fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
      {tempoRestanteStr}
    </Text>
  );
};

// =========================================================================
// O MOTOR DE PARTÍCULAS
// =========================================================================
const Particula = ({ char }: { char: string }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const [randomX] = useState((Math.random() - 0.5) * 200); 
  const [randomY] = useState((Math.random() - 0.5) * 250 - 80); 
  const [randomRot] = useState((Math.random() - 0.5) * 720); 

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true
    }).start();
  }, []);

  return (
    <Animated.Text style={[
      styles.particulaTexto,
      {
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomX] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, randomY] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${randomRot}deg`] }) },
          { scale: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [1, 1.8, 0] }) } 
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] })
      }
    ]}>
      {char}
    </Animated.Text>
  );
};

// =========================================================================
// O TECLADO PIANO BLINDADO
// =========================================================================
const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => {
  const lastPress = useRef(0);
  return (
    <Pressable 
      style={({ pressed }) => [
        styles.tecla, 
        styleExtra, 
        pressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }
      ]}
      onPressIn={() => {
        const now = Date.now();
        if (now - lastPress.current > 150) {
          lastPress.current = now;
          onPress(valor);
        }
      }}
    >
      {children}
    </Pressable>
  );
};

export default function Arcade() {
  const router = useRouter();
  const { user } = useAuth(); 
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [pontos, setPontos] = useState(0);
  const [vidas, setVidas] = useState(5); 
  const [resposta, setResposta] = useState('');
  const [operacoes, setOperacoes] = useState<any[]>([]); 
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [missoesDisponiveis, setMissoesDisponiveis] = useState<any[]>([]);
  const [modoMatematica, setModoMatematica] = useState('misto');
  
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

  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);
  useEffect(() => { modoMatematicaRef.current = modoMatematica; }, [modoMatematica]);
  useEffect(() => { if (tela === 'menu') carregarMissoes(); }, [tela]);

  const processarErroRef = useRef<any>(null);

  const processarErro = useCallback((opId: string) => {
    if (opId === 'nenhum') {
      setVidas(v => { const nv = v - 1; if (nv <= 0) gameOver(); return nv; });
      return;
    }

    const opInfo = operacoesListRef.current.find(o => o.id === opId);
    if (!opInfo) return;

    opInfo.y.stopAnimation();

    const expId = Math.random().toString();
    setExplosoes(prev => [...prev, {
        id: expId,
        x: opInfo.posX,
        y: DROP_LIMIT,
        texto: opInfo.textoTela,
        corEspecial: opInfo.tipoEspecial !== 'nenhum'
    }]);

    setTimeout(() => {
        setExplosoes(prev => prev.filter(e => e.id !== expId));
    }, 800);

    setVidas(v => { const nv = v - 1; if (nv <= 0) gameOver(); return nv; });

    questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
    setOperacoes(prev => prev.filter(o => o.id !== opId));
    operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opId);
  }, []);

  useEffect(() => {
    processarErroRef.current = processarErro;
  }, [processarErro]);

  const carregarMissoes = async () => {
    try {
      const data = await api.getMissoesDisponiveis();
      setMissoesDisponiveis(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const confirmarDelecaoMissao = (id: string) => {
    const mensagem = "Tem certeza que deseja APAGAR este jogo personalizado do sistema?";
    
    if (Platform.OS === 'web') {
      const confirmou = window.confirm(mensagem);
      if (confirmou) executarDelecaoMissao(id);
    } else {
      Alert.alert(
        "Apagar Jogo Personalizado",
        mensagem,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Apagar", style: "destructive", onPress: () => executarDelecaoMissao(id) }
        ]
      );
    }
  };

  const executarDelecaoMissao = async (id: string) => {
    try {
      await api.deletarJogo(id); 
      Alert.alert("Sucesso", "O jogo foi removido da tela de todos os alunos.");
      carregarMissoes(); 
    } catch (error) {
      Alert.alert("Erro", "Falha ao apagar o jogo. Verifique sua conexão com o servidor.");
    }
  };

  useEffect(() => {
    if (modoRef.current === 'missao' && jogoAtivoRef.current) {
      if (filaQuestoesRef.current.length === 0 && questoesEmJogoRef.current === 0 && operacoes.length === 0) {
        finalizarMissaoComSucesso();
      }
    }

    if (jogoAtivoRef.current && fasePendenteRef.current && operacoes.length === 0) {
      fasePendenteRef.current = false;
      rodadaRef.current = proximaFaseNumRef.current; 
      avancarFase(proximaFaseNumRef.current);
    }
  }, [operacoes]);

  const finalizarMissaoComSucesso = async () => {
    if (!jogoAtivoRef.current) return;
    jogoAtivoRef.current = false;
    if(spawnTimer.current) clearTimeout(spawnTimer.current);
    
    try {
        if(missaoAtualRef.current?.id) await api.concluirMissao(missaoAtualRef.current.id);
    } catch(e) {}
    setTimeout(() => setTela('resultado'), 500);
  };

  const avancarFase = (novaFase: number) => {
    if (transicaoAtivaRef.current || !jogoAtivoRef.current) return;
    transicaoAtivaRef.current = true;
    
    setFaseAtualVisor(novaFase);
    setMostrarFase(true);
    
    if (spawnTimer.current) clearTimeout(spawnTimer.current);

    fadeFaseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(fadeFaseAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500), 
      Animated.timing(fadeFaseAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setMostrarFase(false);
      transicaoAtivaRef.current = false;
      if (jogoAtivoRef.current && !jogoPausadoRef.current) {
        iniciarLoopSpawner();
      }
    });
  };

  const pausarJogo = useCallback(() => {
    if (!jogoAtivoRef.current || jogoPausadoRef.current) return;
    
    jogoPausadoRef.current = true;
    setPausado(true);
    
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    
    operacoesListRef.current.forEach(op => op.y.stopAnimation());
  }, []);

  const retomarJogo = () => {
    jogoPausadoRef.current = false;
    setPausado(false);
    
    if (!transicaoAtivaRef.current && !fasePendenteRef.current) {
      iniciarLoopSpawner();
    }
    
    operacoesListRef.current.forEach(op => {
      const currentY = (op.y as any)._value || 0;
      const distTotal = height + 50; 
      const distRestante = distTotal - currentY;
      const duracaoRestante = Math.max(100, (distRestante / distTotal) * op.speed);
      
      Animated.timing(op.y, { 
        toValue: distTotal, 
        duration: duracaoRestante, 
        useNativeDriver: true 
      }).start();
    });
  };

  const sairDoJogo = () => {
    jogoAtivoRef.current = false;
    jogoPausadoRef.current = false;
    transicaoAtivaRef.current = false;
    fasePendenteRef.current = false;
    setPausado(false);
    setMostrarFase(false);
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    setOperacoes([]);
    setExplosoes([]);
    setTela('menu');
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (jogoAtivoRef.current && !jogoPausadoRef.current) pausarJogo();
      };
    }, [pausarJogo])
  );

  const iniciarJogo = async (modoEscolhido: 'single' | 'bot' | 'missao', missaoDados?: any) => {
    if (modoEscolhido === 'missao' && missaoDados) {
      try {
        await api.registrarTentativaMissao(missaoDados.id);
      } catch (e) {
        Alert.alert("Aviso", "Você já atingiu o limite de vezes que pode jogar essa missão!");
        return;
      }
    }

    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (botTimer.current) clearInterval(botTimer.current);
    
    setOperacoes([]); setExplosoes([]); setPontos(0); setResposta(''); setPowerUpDisponivel(false); 
    setPausado(false); setMostrarFase(false); setFaseAtualVisor(1);
    
    operacoesAtuaisRef.current = []; 
    ultimasRespostasRef.current = []; 
    desempenhoOcultoRef.current = 0; questoesEmJogoRef.current = 0;
    jogoPausadoRef.current = false; jogoAtivoRef.current = true; 
    rodadaRef.current = 1; transicaoAtivaRef.current = false; fasePendenteRef.current = false;
    proximaFaseNumRef.current = 1;
    
    modoRef.current = modoEscolhido;

    if (modoEscolhido === 'missao' && missaoDados) {
      missaoAtualRef.current = missaoDados;
      setVidas(missaoDados.vidas ? Number(missaoDados.vidas) : 5);
      filaQuestoesRef.current = missaoDados.questoes.map((q: any) => ({...q, id: q.id || Math.random().toString()}));
    } else {
      missaoAtualRef.current = null; filaQuestoesRef.current = []; setVidas(5);
    }

    setTela('jogo');
    setTimeout(() => { spawnarQuestao(); iniciarLoopSpawner(); }, 100);
  };

  const iniciarLoopSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    const loop = () => {
      if (!jogoAtivoRef.current || jogoPausadoRef.current || transicaoAtivaRef.current) return;
      
      if (!fasePendenteRef.current) {
        if (modoRef.current === 'missao' && filaQuestoesRef.current.length === 0) {} 
        else {
          const maxOps = Math.min(15, 3 + Math.floor(pontos / 200)); 
          if (operacoesListRef.current.length < maxOps) spawnarQuestao();
        }
      }
      
      if (!transicaoAtivaRef.current) {
        spawnTimer.current = setTimeout(loop, Math.max(800, 2500 - (pontos * 1.5)));
      }
    };
    if (!transicaoAtivaRef.current) loop();
  };

  const getDynamicSettings = () => {
    const r = rodadaRef.current;
    let numLanes = 3;
    
    if (r >= 4) numLanes = 4;
    if (r >= 7) numLanes = 5;
    if (r >= 10) numLanes = 6;
    
    const laneWidth = width / numLanes;
    const baseScale = 3 / numLanes; 
    
    const minDropDistance = 0.20; 
    
    return { numLanes, laneWidth, baseScale, minDropDistance };
  };

  const spawnarQuestao = () => {
    let dados = null;
    let isMissao = modoRef.current === 'missao';
    
    if (isMissao) {
      if (filaQuestoesRef.current.length === 0) return;
      dados = filaQuestoesRef.current[0]; 
    } else {
      dados = gerarDadosArcade();
      if (!dados) return; 
    }

    const novaOp = criarObjetoAnimado(dados.texto, dados.resposta, dados.chave || dados.id, dados.speed || 10000);
    
    if (novaOp) { 
      if (isMissao) filaQuestoesRef.current.shift(); 
      questoesEmJogoRef.current += 1;
      setOperacoes(prev => [...prev, novaOp]); 
      setTimeout(() => animarQueda(novaOp), 50); 
    }
  };

  const gerarDadosArcade = (): any => {
    const r = (max: number) => Math.floor(Math.random() * max);
    let opsPermitidas = ['+'];
    if (modoMatematicaRef.current === 'misto') {
      if (rodadaRef.current >= 2) opsPermitidas.push('-');
      if (rodadaRef.current >= 4) opsPermitidas.push('×');
      if (rodadaRef.current >= 6) opsPermitidas.push('÷');
      if (rodadaRef.current >= 8) opsPermitidas.push('^');
      if (rodadaRef.current >= 10) opsPermitidas.push('√');
    } else {
      const m = modoMatematicaRef.current;
      opsPermitidas = [m==='soma'?'+': m==='subtracao'?'-': m==='multiplicacao'?'×': m==='divisao'?'÷': m==='potenciacao'?'^':'√'];
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
          let maxBase = Math.min(5 + Math.floor(rodadaRef.current / 2), 20);
          n1 = r(maxBase - 1) + 2; 
          let maxExp = 2;
          if (n1 === 2) maxExp = Math.min(3 + Math.floor(rodadaRef.current / 3), 7);
          else if (n1 === 3) maxExp = Math.min(2 + Math.floor(rodadaRef.current / 4), 4);
          else if (n1 <= 5) maxExp = Math.min(2 + Math.floor(rodadaRef.current / 10), 3);
          n2 = r(maxExp - 1) + 2;
          res = Math.pow(n1, n2);
          const s:any = {2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷'};
          txt = `${n1}${s[n2] || '^'+n2}`; 
          break;
        case '√': res=r(multMax+4)+2; n1=res*res; n2=''; txt=`√${n1}`; break;
      }
      
      const chave = `${n1}${op}${n2}`;
      
      if (ultimasRespostasRef.current.includes(res) || operacoesAtuaisRef.current.some(o => o.chave === chave)) continue;
      
      ultimasRespostasRef.current.push(res);
      if(ultimasRespostasRef.current.length > 4) ultimasRespostasRef.current.shift();
      
      const speed = Math.max(3500, 10000 - (rodadaRef.current * 150));
      
      return { texto: txt, resposta: res, chave, speed };
    }
    
    if (!fasePendenteRef.current) {
        fasePendenteRef.current = true;
        proximaFaseNumRef.current = rodadaRef.current + 1;
        desempenhoOcultoRef.current += 1;
        if (proximaFaseNumRef.current > 100) ultimasRespostasRef.current = [];
    }
    
    return null; 
  };

  const criarObjetoAnimado = (texto: string, resposta: number, chave: string, velocidade: number) => {
    const { numLanes, laneWidth, baseScale, minDropDistance } = getDynamicSettings();
    
    const pistasDisponiveis = Array.from({length: numLanes}, (_, i) => i).filter(p => {
      const opsNaPista = operacoesAtuaisRef.current.filter(o => o.lane === p);
      if (opsNaPista.length === 0) return true;
      const menorY = Math.min(...opsNaPista.map(o => o.y));
      return menorY > (DROP_LIMIT * minDropDistance);
    });
    
    if (pistasDisponiveis.length === 0) return null;
    
    const lane = pistasDisponiveis[Math.floor(Math.random() * pistasDisponiveis.length)];
    const id = Math.random().toString();
    operacoesAtuaisRef.current.push({ lane, y: 0, chave: id, missed: false });
    
    let tipoEspecial = 'nenhum';
    const rand = Math.random();
    if (rand < 0.01) {
       tipoEspecial = 'vida';
    } else if (rand < 0.04) {
       tipoEspecial = 'destruir';
    }

    const posX = (lane * laneWidth) + (laneWidth / 2) - (CARD_WIDTH / 2);
    
    const yValue = new Animated.Value(0);
    yValue.addListener(({ value }: any) => {
      const ref = operacoesAtuaisRef.current.find((o:any) => o.chave === id);
      if (ref) {
         ref.y = value;
         if (value >= DROP_LIMIT && !ref.missed) {
            ref.missed = true;
            if (processarErroRef.current) processarErroRef.current(id);
         }
      }
    });

    return { 
      id, chaveOriginal: chave, resposta, textoTela: texto, 
      y: yValue, speed: velocidade, 
      posX, lane, 
      tipoEspecial, baseScale,
      opacity: new Animated.Value(1), scale: new Animated.Value(baseScale) 
    };
  };

  const animarQueda = (op: any) => {
    if (!jogoAtivoRef.current || jogoPausadoRef.current) return;
    Animated.timing(op.y, { toValue: height + 100, duration: op.speed, useNativeDriver: true }).start();
  };

  const gameOver = () => { 
    jogoAtivoRef.current = false; 
    jogoPausadoRef.current = false;
    transicaoAtivaRef.current = false;
    fasePendenteRef.current = false;
    setPausado(false);
    if (spawnTimer.current) clearTimeout(spawnTimer.current); 
    setOperacoes([]); 
    setExplosoes([]);
    setTela('resultado'); 
  };

  const verificarResposta = () => {
    if (jogoPausadoRef.current || !jogoAtivoRef.current || isNaN(parseInt(resposta))) return;
    const alvo = operacoes.find(op => op.resposta === parseInt(resposta));

    if (alvo) {
      alvo.y.stopAnimation();
      questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
      
      setPontos(p => { 
        const novo = p + 10; 
        if (modoRef.current !== 'missao' && Math.floor(novo/50) > Math.floor(p/50)) { 
           if (!fasePendenteRef.current) {
               fasePendenteRef.current = true;
               proximaFaseNumRef.current = rodadaRef.current + 1;
               desempenhoOcultoRef.current += 1; 
           }
        } 
        return novo; 
      });

      if (alvo.tipoEspecial === 'destruir' && !powerUpDisponivel) {
        setPowerUpDisponivel(true);
      } else if (alvo.tipoEspecial === 'vida') {
        setVidas(v => Math.min(v + 1, 7)); 
      }

      dispararLaserUnico(alvo, true);
      
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== alvo.id);
      setTimeout(() => { setOperacoes(prev => prev.filter(o => o.id !== alvo.id)); }, 300);
    } else { 
      dispararLaserUnico(null, false); 
      processarErro('nenhum'); 
    }
    setResposta('');
  };

  const calcularDadosLaser = (alvo: any, acertou: boolean) => {
    const originX = width / 2;
    const originY = DROP_LIMIT + 30; 
    
    const targetX = acertou && alvo ? alvo.posX + CARD_WIDTH / 2 : width / 2;
    const targetY = acertou && alvo ? (alvo.y as any)._value + 20 : DROP_LIMIT * 0.2;
    
    const dx = targetX - originX;
    const dy = targetY - originY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) + Math.PI / 2; 

    const midX = originX + dx / 2;
    const midY = originY + dy / 2;

    const cor = acertou ? corLaserPersonalizada : '#FF4444';
    
    return { x: midX, y: midY, h: distance, angle: `${angle}rad`, cor };
  };

  const dispararLaserUnico = (alvo: any, acertou: boolean) => {
    const laserInfo = calcularDadosLaser(alvo, acertou);
    setLasersAtivos([laserInfo]);
    
    laserAnim.setValue(1);
    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 0, duration: 300, useNativeDriver: true }), 
      ...(acertou && alvo ? [ 
        Animated.timing(alvo.scale, { toValue: alvo.baseScale * 1.4, duration: 150, useNativeDriver: true }), 
        Animated.timing(alvo.opacity, { toValue: 0, duration: 150, useNativeDriver: true }) 
      ] : [])
    ]).start(() => setLasersAtivos([]));
    
    if (!acertou) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }), 
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }), 
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    }
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel || jogoPausadoRef.current || transicaoAtivaRef.current) return;
    const visiveis = operacoes.filter(o => (o.y as any)._value < DROP_LIMIT);
    
    if (visiveis.length === 0) {
      setPowerUpDisponivel(false);
      return;
    }
    
    visiveis.forEach(o => o.y.stopAnimation());
    
    const novosLasers = visiveis.map(alvo => calcularDadosLaser(alvo, true));
    setLasersAtivos(novosLasers);

    laserAnim.setValue(1);
    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ...visiveis.flatMap(alvo => [
          Animated.timing(alvo.scale, { toValue: alvo.baseScale * 1.5, duration: 200, useNativeDriver: true }),
          Animated.timing(alvo.opacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ])
    ]).start(() => {
       setLasersAtivos([]);
       setPontos(p => p + (visiveis.length * 10));
       questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - visiveis.length);
       
       setOperacoes(prev => prev.filter(o => !visiveis.includes(o)));
       operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => !visiveis.some(v => v.chave === o.chave));
    });
    
    setPowerUpDisponivel(false);
  };

  if (tela === 'menu') {
    const modosArcade = [
      { id: 'misto', name: 'Jornada', color: '#FFD700', icon: 'infinite' },
      { id: 'soma', name: 'Soma', color: '#32CD32', icon: 'add' },
      { id: 'subtracao', name: 'Subtração', color: '#FF4444', icon: 'remove' },
      { id: 'multiplicacao', name: 'Multiplicação', color: '#4169E1', icon: 'close' },
      { id: 'divisao', name: 'Divisão', color: '#9B59B6', icon: 'code-slash' },
      { id: 'potenciacao', name: 'Potências', color: '#FF8C00', icon: 'chevron-up' },
      { id: 'radiciacao', name: 'Raízes', color: '#00CED1', icon: 'flash' }
    ];

    // ==========================================
    // DADOS FALSOS PARA O NOVO RANKING ARCADE
    // ==========================================
    const meuNome = user?.nome?.split(' ')[0] || 'Você';
    const rankingFalso = [
      { posicao: 1, nome: 'Ana C.', pontosMaximos: 15420, isMe: false },
      { posicao: 2, nome: 'Pedro', pontosMaximos: 12300, isMe: false },
      { posicao: 3, nome: 'Lucas', pontosMaximos: 9800, isMe: false },
      { posicao: 4, nome: 'Sofia', pontosMaximos: 8500, isMe: false },
      { posicao: 5, nome: meuNome, pontosMaximos: 7200, isMe: true }, // Simulando o usuário atual
      { posicao: 6, nome: 'Maria', pontosMaximos: 6400, isMe: false },
      { posicao: 7, nome: 'João', pontosMaximos: 5100, isMe: false },
      { posicao: 8, nome: 'Clara', pontosMaximos: 4200, isMe: false },
      { posicao: 9, nome: 'Miguel', pontosMaximos: 3100, isMe: false },
      { posicao: 10, nome: 'Julia', pontosMaximos: 2500, isMe: false },
    ];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
            
            <TouchableOpacity style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.menuHeader}>
              <Ionicons name="game-controller" size={64} color="#FFD700" />
              <Text style={styles.menuTitle}>Matemática Turbo</Text>
              <Text style={styles.menuSubtitle}>Treinamento Adaptativo</Text>
            </View>

            {/* ========================================== */}
            {/* 🏆 HALL DA FAMA - LISTA ROLÁVEL COM RADAR  */}
            {/* ========================================== */}
            <View style={styles.rankingContainer}>
              <View style={styles.rankingHeaderRow}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={styles.rankingTitle}>HALL DA FAMA - ARCADE</Text>
              </View>

              {/* Área Rolável do Ranking */}
              <View style={styles.rankingScrollWrapper}>
                <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {rankingFalso.map((jogador) => {
                    let corPosicao = '#888';
                    if (jogador.posicao === 1) corPosicao = '#FFD700'; // Ouro
                    else if (jogador.posicao === 2) corPosicao = '#C0C0C0'; // Prata
                    else if (jogador.posicao === 3) corPosicao = '#CD7F32'; // Bronze

                    return (
                      <View key={jogador.posicao} style={[styles.rankingRow, jogador.isMe && styles.rankingRowMe]}>
                        <View style={styles.rankingLeft}>
                          <Text style={[styles.rankingPosText, { color: corPosicao }]}>#{jogador.posicao}</Text>
                          <Text style={[styles.rankingNameText, jogador.isMe && { color: '#00FFFF' }]}>{jogador.nome}</Text>
                        </View>
                        <Text style={[styles.rankingScoreText, jogador.isMe && { color: '#00FFFF' }]}>{jogador.pontosMaximos} pts</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Posição do Usuário Fixa no Rodapé do Card */}
              {rankingFalso.find(j => j.isMe) && (
                <View style={styles.myRankingFixed}>
                  <Text style={styles.myRankingLabel}>Sua Posição Atual:</Text>
                  <View style={styles.rankingLeft}>
                    <Text style={[styles.rankingPosText, { color: '#00FFFF' }]}>#{rankingFalso.find(j => j.isMe)?.posicao}</Text>
                    <Text style={[styles.rankingScoreText, { color: '#00FFFF' }]}>{rankingFalso.find(j => j.isMe)?.pontosMaximos} pts</Text>
                  </View>
                </View>
              )}
            </View>
            {/* ========================================== */}

            {missoesDisponiveis.length > 0 && (
              <View style={{width: '100%', marginBottom: 20}}>
                <Text style={styles.sectionLabel}>🎯 Missões do Professor:</Text>
                {missoesDisponiveis.map((missao, index) => {
                  const limite = missao.limiteTentativas !== undefined ? missao.limiteTentativas : 1;
                  const feitas = missao.tentativasFeitas || 0;
                  const ilimitado = limite === 0;
                  const esgotado = !ilimitado && feitas >= limite;
                  
                  return (
                    <View key={missao.id || index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <TouchableOpacity 
                          style={[styles.missaoCard, esgotado && { backgroundColor: '#333' }, { flex: 1, marginBottom: 0 }]} 
                          onPress={() => !esgotado && iniciarJogo('missao', missao)}
                          activeOpacity={esgotado ? 1 : 0.7}
                        >
                          <View style={styles.missaoIcon}><Ionicons name={esgotado ? "lock-closed" : "trophy"} size={24} color="#FFF" /></View>
                          <View style={{flex: 1}}>
                            <Text style={[styles.missaoTitle, esgotado && {color: '#888'}]}>{missao.titulo}</Text>
                            <Text style={[styles.missaoSub, esgotado && {color: '#666'}]}>
                              {missao.recompensa} Pts • {ilimitado ? 'Tents. Ilimitadas' : `Tentativas: ${feitas}/${limite}`}
                            </Text>
                            {missao.expiraEm && (
                              <ContadorExpiracao expiraEm={missao.expiraEm} esgotado={esgotado} />
                            )}
                          </View>
                          <Ionicons name="play-circle" size={32} color={esgotado ? "#555" : "#FFF"} />
                        </TouchableOpacity>

                        {user?.perfil === 'ADMIN' && (
                          <TouchableOpacity
                            style={{ backgroundColor: '#E74C3C', padding: 15, borderRadius: 12, marginLeft: 8, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => confirmarDelecaoMissao(missao.id)}
                          >
                            <Text style={{color: '#FFF', fontWeight: '900', fontSize: 18}}>X</Text>
                          </TouchableOpacity>
                        )}
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
                  <TouchableOpacity 
                    key={m.id} 
                    style={[styles.modoCardItem, isSelected && { borderColor: m.color, backgroundColor: m.color + '15' }]} 
                    onPress={() => setModoMatematica(m.id)}
                  >
                    <Ionicons name={m.icon as any} size={28} color={isSelected ? m.color : '#555'} />
                    <Text style={[styles.modoTextItem, isSelected && { color: m.color }]}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.btnIniciarWrapper}>
            <TouchableOpacity style={styles.iniciarButton} onPress={() => iniciarJogo('single')}>
              <Ionicons name="play" size={24} color="#000" />
              <Text style={styles.iniciarButtonText}>INICIAR MODO LIVRE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (tela === 'resultado') {
    const isMissao = modoRef.current === 'missao';
    const venceu = isMissao && vidas > 0;
    return (
      <SafeAreaView style={styles.container}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {mostrarFase && (
        <Animated.View style={[styles.transicaoOverlay, { opacity: fadeFaseAnim }]}>
          <View style={styles.transicaoBox}>
            <Text style={styles.transicaoText}>FASE {faseAtualVisor}</Text>
          </View>
        </Animated.View>
      )}

      {pausado && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseTitle}>JOGO PAUSADO</Text>
          <TouchableOpacity style={styles.btnContinuar} onPress={retomarJogo}>
            <Ionicons name="play" size={24} color="#000" />
            <Text style={styles.btnContinuarText}>CONTINUAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSair} onPress={sairDoJogo}>
            <Ionicons name="exit" size={24} color="#fff" />
            <Text style={styles.btnSairText}>SAIR PARA O MENU</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.gameHeader}>
        <View style={styles.headerStatsGroup}>
          <Ionicons name="star" size={18} color="#FFD700" />
          <Text style={styles.statTextScore}>{pontos}</Text>
          
          {modoRef.current !== 'missao' && (
            <View style={styles.faseBadge}>
              <Text style={styles.faseBadgeText}>Fase {faseAtualVisor}</Text>
            </View>
          )}
        </View>
        
        <TouchableOpacity onPress={pausarJogo} style={styles.btnPausaIcone}>
          <Ionicons name="pause" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.vidasContainer}>{Array.from({ length: Math.max(0, vidas) }).map((_, i) => <Ionicons key={i} name="heart" size={16} color="#FF4444" style={{marginHorizontal:2}} />)}</View>
      
      <View style={styles.gameArea}>
        
        <View style={styles.linhaEletricaContainer}>
           <View style={styles.linhaEletricaCore} />
           <View style={styles.linhaEletricaGlow} />
        </View>

        {operacoes.map((op) => ( 
          <Animated.View 
            key={op.id} 
            style={[
              styles.operacaoCard, 
              op.tipoEspecial === 'destruir' && styles.operacaoEspecial,
              op.tipoEspecial === 'vida' && styles.operacaoVida,
              { 
                transform: [{ translateY: op.y }, { scale: op.scale }], 
                left: op.posX, 
                opacity: op.opacity,
                width: CARD_WIDTH
              }
            ]}
          > 
            <Text style={[styles.operacaoText, op.tipoEspecial !== 'nenhum' && { color: '#000' }]}>
              {op.textoTela} {op.tipoEspecial === 'vida' ? '❤' : ''}
            </Text> 
          </Animated.View> 
        ))}
        
        {explosoes.map(exp => (
          <View key={exp.id} style={[styles.explosaoContainer, { left: exp.x, top: exp.y }]}>
             {exp.texto.split('').map((char: string, i: number) => (
               <Particula key={i} char={char} />
             ))}
          </View>
        ))}

        {lasersAtivos.map((laserInfo, index) => (
          <Animated.View key={`laser-${index}`} style={[styles.laser, { 
            left: laserInfo.x - 2, 
            top: laserInfo.y - laserInfo.h / 2, 
            height: laserInfo.h,
            transform: [{ rotate: laserInfo.angle }],
            backgroundColor: laserInfo.cor,
            opacity: laserAnim 
          }]} />
        ))}
      </View>
      
      <View style={styles.bottomPanel}>
        <View style={styles.powerUpContainer}>{powerUpDisponivel && <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}><Ionicons name="flash" size={18} color="#000" /><Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text></TouchableOpacity>}</View>
        
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
  
  // === NOVOS ESTILOS DO RANKING ===
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
  // ================================

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
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerStatsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextScore: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  faseBadge: { backgroundColor: '#4169E1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
  faseBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  btnPausaIcone: { padding: 4, marginLeft: 10 },
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
  
  bottomPanel: { position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', paddingBottom: 15, zIndex: 10 },
  powerUpContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 8, height: 40 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  
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
