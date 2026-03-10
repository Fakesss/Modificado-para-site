import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.62; 
const CARD_WIDTH = 105;
const LANE_WIDTH = width / 3;

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

const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => (
  <TouchableOpacity activeOpacity={0.5} style={[styles.tecla, styleExtra]} onTouchStart={(e) => { e.stopPropagation(); onPress(valor); }}>
    {children}
  </TouchableOpacity>
);

export default function Jogo() {
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [pontos, setPontos] = useState(0);
  const [vidas, setVidas] = useState(5); 
  const [resposta, setResposta] = useState('');
  const [operacoes, setOperacoes] = useState<any[]>([]); 
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [missoesDisponiveis, setMissoesDisponiveis] = useState<any[]>([]);
  const [modoMatematica, setModoMatematica] = useState('misto');
  
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
  const [laserAtivo, setLaserAtivo] = useState<any>(null);

  const desempenhoOcultoRef = useRef(0); 
  
  // RESTAURADO: Mantém o histórico das últimas RESPOSTAS (a regra original e correta)
  const ultimasRespostasRef = useRef<number[]>([]);

  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);
  useEffect(() => { modoMatematicaRef.current = modoMatematica; }, [modoMatematica]);
  useEffect(() => { if (tela === 'menu') carregarMissoes(); }, [tela]);

  const carregarMissoes = async () => {
    try {
      const data = await api.getMissoesDisponiveis();
      setMissoesDisponiveis(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  useEffect(() => {
    if (modoRef.current === 'missao' && jogoAtivoRef.current) {
      if (filaQuestoesRef.current.length === 0 && questoesEmJogoRef.current === 0 && operacoes.length === 0) {
        finalizarMissaoComSucesso();
      }
    }
  }, [operacoes]);

  const finalizarMissaoComSucesso = async () => {
    if (!jogoAtivoRef.current) return;
    jogoAtivoRef.current = false;
    if(spawnTimer.current) clearTimeout(spawnTimer.current);
    
    if(missaoAtualRef.current?.id) await api.concluirMissao(missaoAtualRef.current.id);
    setTimeout(() => setTela('resultado'), 500);
  };

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
    
    setOperacoes([]); setPontos(0); setResposta(''); setPowerUpDisponivel(false);
    operacoesAtuaisRef.current = []; 
    ultimasRespostasRef.current = []; // Limpa histórico ao iniciar
    desempenhoOcultoRef.current = 0; questoesEmJogoRef.current = 0;
    jogoPausadoRef.current = false; jogoAtivoRef.current = true; rodadaRef.current = 1;
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
      if (!jogoPausadoRef.current && jogoAtivoRef.current) {
        if (modoRef.current === 'missao' && filaQuestoesRef.current.length === 0) {} 
        else {
          const maxOps = Math.min(8, 3 + Math.floor(pontos / 500)); 
          if (operacoesListRef.current.length < maxOps) spawnarQuestao();
        }
      }
      spawnTimer.current = setTimeout(loop, Math.max(1200, 3000 - (pontos * 2)));
    };
    loop();
  };

  const spawnarQuestao = () => {
    let novaOp = null;
    if (modoRef.current === 'missao') {
      if (filaQuestoesRef.current.length === 0) return;
      const questao = filaQuestoesRef.current.shift();
      if (!questao) return;
      questoesEmJogoRef.current += 1;
      novaOp = criarObjetoAnimado(questao.texto, questao.resposta, questao.id, 10000);
    } else {
      const dados = gerarDadosArcade();
      if (!dados) return;
      questoesEmJogoRef.current += 1;
      novaOp = criarObjetoAnimado(dados.texto, dados.resposta, dados.chave, dados.speed);
    }
    if (novaOp) { setOperacoes(prev => [...prev, novaOp]); setTimeout(() => animarQueda(novaOp), 50); }
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

    let numMax = 15 + (rodadaRef.current * 4) + Math.floor(desempenhoOcultoRef.current/2);
    let multMax = 5 + rodadaRef.current; 

    for (let t = 0; t < 50; t++) {
      const op = opsPermitidas[r(opsPermitidas.length)];
      let n1=0, n2:any=0, res=0, txt='';
      switch(op) {
        case '+': n1=r(numMax)+1; n2=r(numMax)+1; res=n1+n2; txt=`${n1} + ${n2}`; break;
        case '-': n1=r(numMax*1.5)+5; n2=r(n1)+1; res=n1-n2; txt=`${n1} - ${n2}`; break;
        case '×': n1=r(multMax)+2; n2=r(multMax)+2; res=n1*n2; txt=`${n1} × ${n2}`; break;
        case '÷': n2=r(multMax)+2; res=r(multMax)+1; n1=n2*res; txt=`${n1} ÷ ${n2}`; break;
        case '^': let bases=[2,3,4,5]; n1=bases[r(bases.length)]; n2=r((n1===2?5:n1===3?3:2)-1)+2; res=Math.pow(n1,n2); const s:any={2:'²',3:'³',4:'⁴',5:'⁵'}; txt=`${n1}${s[n2]||'^'+n2}`; break;
        case '√': res=r(multMax+3)+2; n1=res*res; n2=''; txt=`√${n1}`; break;
      }
      
      const chave = `${n1}${op}${n2}`;
      
      // RESTAURADO: Bloqueia se a RESPOSTA for igual a uma das últimas 4, ou se a conta exata já está caindo na tela
      if (ultimasRespostasRef.current.includes(res) || operacoesAtuaisRef.current.some(o => o.chave === chave)) continue;
      
      ultimasRespostasRef.current.push(res);
      if(ultimasRespostasRef.current.length > 4) ultimasRespostasRef.current.shift();
      
      return { texto: txt, resposta: res, chave, speed: Math.max(3000, 8000 - (rodadaRef.current * 300)) };
    }
    
    // SISTEMA DE AUTO-AVANÇO (O NOVO CORAÇÃO DO JOGO)
    // Se esgotou 50 tentativas e não encontrou uma resposta "inédita", as combinações dessa rodada acabaram.
    // Avançamos de rodada para abrir novos números e chamamos o gerador novamente!
    rodadaRef.current += 1;
    desempenhoOcultoRef.current += 1;
    
    // Trava de segurança extra caso o limite exploda
    if (rodadaRef.current > 100) ultimasRespostasRef.current = [];
    
    return gerarDadosArcade(); // Tenta de novo agora com números maiores
  };

  const criarObjetoAnimado = (texto: string, resposta: number, chave: string, velocidade: number) => {
    const pistas = [0, 1, 2].filter(p => !operacoesAtuaisRef.current.find(o => o.lane === p) || operacoesAtuaisRef.current.find(o => o.lane === p)?.y > GAME_AREA_HEIGHT * 0.25);
    const lane = pistas.length > 0 ? pistas[Math.floor(Math.random() * pistas.length)] : Math.floor(Math.random() * 3);
    const id = Math.random().toString();
    operacoesAtuaisRef.current.push({ lane, y: 0, chave: id });
    return { id, chaveOriginal: chave, resposta, textoTela: texto, y: new Animated.Value(0), speed: velocidade, posX: (lane * LANE_WIDTH) + (LANE_WIDTH - CARD_WIDTH) / 2, lane, especial: Math.random() < 0.1, opacity: new Animated.Value(1), scale: new Animated.Value(1) };
  };

  const animarQueda = (op: any) => {
    if (!jogoAtivoRef.current) return;
    op.y.addListener(({ value }: any) => { const ref = operacoesAtuaisRef.current.find((o:any) => o.chave === op.id); if (ref) ref.y = value; });
    Animated.timing(op.y, { toValue: GAME_AREA_HEIGHT + 50, duration: op.speed, useNativeDriver: true }).start(({ finished }) => { if (finished) processarErro(op.id); });
  };

  const processarErro = (opId: string) => {
    questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
    setVidas(v => { const nv = v - 1; if (nv <= 0) gameOver(); return nv; });
    setOperacoes(prev => prev.filter(o => o.id !== opId));
    operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opId);
  };

  const gameOver = () => { jogoAtivoRef.current = false; if (spawnTimer.current) clearTimeout(spawnTimer.current); setOperacoes([]); setTela('resultado'); };

  const verificarResposta = () => {
    if (jogoPausadoRef.current || !jogoAtivoRef.current || isNaN(parseInt(resposta))) return;
    const alvo = operacoes.find(op => op.resposta === parseInt(resposta));

    if (alvo) {
      alvo.y.stopAnimation();
      questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
      setPontos(p => { const novo = p + 10; if (modoRef.current !== 'missao' && Math.floor(novo/50) > Math.floor(p/50)) { rodadaRef.current += 1; desempenhoOcultoRef.current += 1; } return novo; });
      if (alvo.especial && !powerUpDisponivel) setPowerUpDisponivel(true);
      dispararLaser(alvo, true);
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== alvo.id);
      setTimeout(() => { setOperacoes(prev => prev.filter(o => o.id !== alvo.id)); }, 300);
    } else { dispararLaser(null, false); processarErro('nenhum'); }
    setResposta('');
  };

  const dispararLaser = (alvo: any, acertou: boolean) => {
    const cor = acertou ? '#32CD32' : '#FF4444';
    setLaserAtivo({ x: acertou ? alvo.posX + CARD_WIDTH/2 : width/2, y: acertou ? (alvo.y as any)._value : GAME_AREA_HEIGHT * 0.2, cor });
    laserAnim.setValue(0);
    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ...(acertou ? [ Animated.timing(alvo.scale, { toValue: 1.4, duration: 150, useNativeDriver: true }), Animated.timing(alvo.opacity, { toValue: 0, duration: 150, useNativeDriver: true }) ] : [])
    ]).start(() => setLaserAtivo(null));
    if (!acertou) Animated.sequence([Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }), Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }), Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })]).start();
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel) return;
    const visiveis = operacoes.filter(o => (o.y as any)._value < GAME_AREA_HEIGHT);
    visiveis.forEach(o => o.y.stopAnimation());
    setPontos(p => p + (visiveis.length * 10)); questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - visiveis.length);
    setOperacoes([]); setPowerUpDisponivel(false);
  };

  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <ScrollView contentContainerStyle={styles.menuScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.menuHeader}>
              <Ionicons name="game-controller" size={64} color="#FFD700" />
              <Text style={styles.menuTitle}>Matemática Turbo</Text>
              <Text style={styles.menuSubtitle}>Treinamento Adaptativo</Text>
            </View>

            {missoesDisponiveis.length > 0 && (
              <View style={{width: '100%', marginBottom: 20}}>
                <Text style={styles.sectionLabel}>🎯 Missões do Professor:</Text>
                {missoesDisponiveis.map((missao, index) => {
                  const limite = missao.limiteTentativas !== undefined ? missao.limiteTentativas : 1;
                  const feitas = missao.tentativasFeitas || 0;
                  const ilimitado = limite === 0;
                  const esgotado = !ilimitado && feitas >= limite;
                  
                  return (
                    <TouchableOpacity 
                      key={missao.id || index} 
                      style={[styles.missaoCard, esgotado && { backgroundColor: '#333' }]} 
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
                  );
                })}
              </View>
            )}

            <Text style={styles.sectionLabel}>Escolha seu Modo Livre (Arcade):</Text>
            <View style={styles.modosGrid}>
              {[ { id: 'misto', name: 'Jornada', color: '#FFD700', icon: 'infinite' }, { id: 'soma', name: 'Soma', color: '#32CD32', icon: 'add' }, { id: 'subtracao', name: 'Subtração', color: '#FF4444', icon: 'remove' }, { id: 'multiplicacao', name: 'Multiplicação', color: '#4169E1', icon: 'close' }, { id: 'divisao', name: 'Divisão', color: '#9B59B6', icon: 'code-slash' }, { id: 'potenciacao', name: 'Potências', color: '#FF8C00', icon: 'chevron-up' }, { id: 'radiciacao', name: 'Raízes', color: '#00CED1', icon: 'flash' } ].map(m => {
                const isSelected = modoMatematica === m.id;
                return ( <TouchableOpacity key={m.id} style={[ styles.modoCardItem, isSelected && { borderColor: m.color, backgroundColor: m.color + '15' } ]} onPress={() => setModoMatematica(m.id)}> <Ionicons name={m.icon as any} size={28} color={isSelected ? m.color : '#555'} /> <Text style={[styles.modoTextItem, isSelected && { color: m.color }]}>{m.name}</Text> </TouchableOpacity> );
              })}
            </View>
            <TouchableOpacity style={styles.iniciarButton} onPress={() => iniciarJogo('single')}><Ionicons name="play" size={24} color="#000" /><Text style={styles.iniciarButtonText}>INICIAR MODO LIVRE</Text></TouchableOpacity>
          </ScrollView>
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
      <View style={styles.gameHeader}>
        <View style={styles.headerStatsGroup}><Ionicons name="star" size={18} color="#FFD700" /><Text style={styles.statTextScore}>{pontos}</Text></View>
        <TouchableOpacity onPress={() => { gameOver(); }} style={styles.btnPausaIcone}><Ionicons name="close" size={26} color="#fff" /></TouchableOpacity>
      </View>
      <View style={styles.vidasContainer}>{Array.from({ length: Math.max(0, vidas) }).map((_, i) => <Ionicons key={i} name="heart" size={16} color="#FF4444" style={{marginHorizontal:2}} />)}</View>
      
      <View style={[styles.gameArea, { height: GAME_AREA_HEIGHT }]}>
        {operacoes.map((op) => ( <Animated.View key={op.id} style={[styles.operacaoCard, op.especial && styles.operacaoEspecial, { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity }]}> <Text style={[styles.operacaoText, op.especial && { color: '#000' }]}>{op.textoTela}</Text> </Animated.View> ))}
        {laserAtivo && <Animated.View style={[styles.laser, { opacity: laserAnim, transform: [{ translateY: laserAnim.interpolate({ inputRange: [0, 1], outputRange: [height, laserAtivo.y] }) }], left: laserAtivo.x - 2, backgroundColor: laserAtivo.cor }]} />}
      </View>
      
      <View style={styles.bottomPanel}>
        <View style={styles.powerUpContainer}>{powerUpDisponivel && <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}><Ionicons name="flash" size={18} color="#000" /><Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text></TouchableOpacity>}</View>
        
        {/* TECLADO REDIMENSIONADO */}
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
  menuScrollContent: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  menuHeader: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  menuTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 12 },
  menuSubtitle: { fontSize: 15, color: '#888', marginTop: 4 },
  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 12, alignSelf: 'flex-start', marginTop: 10 },
  missaoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF69B4', padding: 15, borderRadius: 16, marginBottom: 10, width: '100%', elevation: 3 },
  missaoIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  missaoTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  missaoSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  modosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 30 },
  modoCardItem: { backgroundColor: '#1a1a2e', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', width: '30%', gap: 8, elevation: 2 },
  modoTextItem: { color: '#888', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', marginTop: 10, elevation: 4 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerStatsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextScore: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnPausaIcone: { padding: 4, marginLeft: 10 },
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingBottom: 10, height: 20 },
  
  // ÁREA DE JOGO FLEXÍVEL
  gameArea: { position: 'relative', width: '100%', flex: 1, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  operacaoCard: { position: 'absolute', top: 0, backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, width: CARD_WIDTH, alignItems: 'center', zIndex: 10 },
  operacaoEspecial: { backgroundColor: '#FFD700' },
  operacaoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  laser: { position: 'absolute', width: 4, height: height, zIndex: 1 },
  
  // TECLADO MAIS COMPACTO
  bottomPanel: { paddingBottom: 15, width: '100%', alignItems: 'center' },
  powerUpContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 8, height: 40 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  
  displayContainer: { backgroundColor: '#1a1a2e', width: 280, height: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  displayText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  
  tecladoContainer: { width: 280, gap: 5 },
  tecladoRow: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  tecla: { backgroundColor: '#1a1a2e', flex: 1, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 15 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 10, width: '100%' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
});
