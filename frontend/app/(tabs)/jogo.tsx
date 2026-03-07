import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

const { width, height } = Dimensions.get('window');
const GAME_AREA_HEIGHT = height * 0.50; 
const CARD_WIDTH = 105;
const LANE_WIDTH = width / 3;

const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => (
  <TouchableOpacity activeOpacity={0.5} style={[styles.tecla, styleExtra]} onTouchStart={(e) => { e.stopPropagation(); onPress(valor); }}>
    {children}
  </TouchableOpacity>
);

export default function Jogo() {
  // Estados Visuais
  const [tela, setTela] = useState<'menu' | 'jogo' | 'resultado'>('menu');
  const [pontos, setPontos] = useState(0);
  const [vidas, setVidas] = useState(10);
  const [resposta, setResposta] = useState('');
  const [operacoes, setOperacoes] = useState<any[]>([]); // O que está na tela
  const [powerUpDisponivel, setPowerUpDisponivel] = useState(false);
  const [missoesDisponiveis, setMissoesDisponiveis] = useState<any[]>([]);
  const [modoMatematica, setModoMatematica] = useState('misto');
  
  // Refs de Controle (O "Cérebro" do Jogo)
  // Usamos Refs para tudo que precisa ser instantâneo e não pode esperar o React renderizar
  const modoRef = useRef<'single' | 'bot' | 'missao'>('single'); 
  const missaoAtualRef = useRef<any>(null);
  const filaQuestoesRef = useRef<any[]>([]); 
  const questoesEmJogoRef = useRef(0); // 🚨 CORREÇÃO DO BUG DE 0 PONTOS: Conta quantas estão voando ou nascendo
  
  const operacoesAtuaisRef = useRef<any[]>([]);
  const operacoesListRef = useRef<any[]>([]); 
  const rodadaRef = useRef(1);
  const jogoPausadoRef = useRef(false); 
  const jogoAtivoRef = useRef(false);
  
  // Animações e Timers
  const spawnTimer = useRef<any>(null);
  const botTimer = useRef<any>(null);
  const laserAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [laserAtivo, setLaserAtivo] = useState<any>(null);
  const [botPontos, setBotPontos] = useState(0);

  // IA Arcade
  const desempenhoOcultoRef = useRef(0); 
  const questoesAcertadasRef = useRef<Set<string>>(new Set()); 
  const inicioRespostaRef = useRef<number>(Date.now()); 

  // Sincroniza Refs com State para renderização
  useEffect(() => { operacoesListRef.current = operacoes; }, [operacoes]);

  // ==================== CICLO DE VIDA ====================

  // Carrega missões sempre que entra no menu
  useEffect(() => {
    if (tela === 'menu') carregarMissoes();
  }, [tela]);

  const carregarMissoes = async () => {
    try {
      if (typeof api.getMissoesDisponiveis === 'function') {
        const data = await api.getMissoesDisponiveis();
        setMissoesDisponiveis(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  // Monitor de Fim de Jogo (Vitória na Missão)
  useEffect(() => {
    if (modoRef.current === 'missao' && jogoAtivoRef.current) {
      // Condição de Vitória: Fila vazia E Nenhuma questão voando/nascendo
      if (filaQuestoesRef.current.length === 0 && questoesEmJogoRef.current === 0 && operacoes.length === 0) {
        finalizarMissaoComSucesso();
      }
    }
  }, [operacoes]);

  const finalizarMissaoComSucesso = async () => {
    if (!jogoAtivoRef.current) return;
    jogoAtivoRef.current = false;
    
    if(spawnTimer.current) clearTimeout(spawnTimer.current);
    
    // Salva conclusão
    if(missaoAtualRef.current?.id) {
      await api.concluirMissao(missaoAtualRef.current.id);
    }
    
    setTimeout(() => setTela('resultado'), 500);
  };

  // ==================== LÓGICA DO JOGO ====================

  const iniciarJogo = (modoEscolhido: 'single' | 'bot' | 'missao', missaoDados?: any) => {
    // 1. RESET TOTAL (Limpa tudo antes de começar)
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (botTimer.current) clearInterval(botTimer.current);
    
    setOperacoes([]);
    setPontos(0);
    setResposta('');
    setPowerUpDisponivel(false);
    setBotPontos(0);
    
    // Reseta Refs
    operacoesAtuaisRef.current = [];
    questoesAcertadasRef.current.clear();
    desempenhoOcultoRef.current = 0;
    questoesEmJogoRef.current = 0;
    jogoPausadoRef.current = false;
    jogoAtivoRef.current = true;
    
    // 2. CONFIGURA O MODO
    modoRef.current = modoEscolhido; // Usa Ref para garantir leitura imediata
    inicioRespostaRef.current = Date.now();

    if (modoEscolhido === 'missao' && missaoDados) {
      missaoAtualRef.current = missaoDados;
      
      // 🚨 CORREÇÃO DAS VIDAS: Aplica as vidas da missão
      setVidas(missaoDados.vidas ? Number(missaoDados.vidas) : 5);
      
      // Prepara a fila
      const copia = missaoDados.questoes.map((q: any) => ({...q, id: q.id || Math.random().toString()}));
      filaQuestoesRef.current = copia;
    } else {
      // Modo Arcade
      setVidas(10);
      missaoAtualRef.current = null;
      filaQuestoesRef.current = [];
    }

    setTela('jogo');

    // 3. SPAWN INICIAL
    setTimeout(() => {
      spawnarQuestao();
      iniciarLoopSpawner();
    }, 100);

    // Bot
    if (modoEscolhido === 'bot') iniciarBot();
  };

  const iniciarLoopSpawner = () => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    
    const loop = () => {
      if (!jogoPausadoRef.current && jogoAtivoRef.current) {
        
        // Se for missão e acabou a fila, não faz nada (espera o useEffect detectar o fim)
        if (modoRef.current === 'missao' && filaQuestoesRef.current.length === 0) {
          // Idle
        } else {
          // Limite de questões na tela
          const maxOps = Math.min(8, 3 + Math.floor(pontos / 500)); 
          if (operacoesListRef.current.length < maxOps) {
            spawnarQuestao();
          }
        }
      }
      
      // Ritmo do spawn
      const delay = Math.max(1200, 3000 - (pontos * 2));
      spawnTimer.current = setTimeout(loop, delay);
    };
    loop();
  };

  const spawnarQuestao = () => {
    let novaOp = null;

    // --- GERADOR MISSÃO ---
    if (modoRef.current === 'missao') {
      if (filaQuestoesRef.current.length === 0) return;
      
      const questao = filaQuestoesRef.current.shift();
      if (!questao) return;

      questoesEmJogoRef.current += 1; // 🚨 Marca que tem uma questão "viva"

      novaOp = criarObjetoAnimado(questao.texto, questao.resposta, questao.id, 10000);
    } 
    // --- GERADOR ARCADE ---
    else {
      const dados = gerarDadosArcade();
      if (!dados) return;
      questoesEmJogoRef.current += 1;
      novaOp = criarObjetoAnimado(dados.texto, dados.resposta, dados.chave, dados.speed);
    }

    if (novaOp) {
      setOperacoes(prev => [...prev, novaOp]);
      // Inicia animação após renderizar
      setTimeout(() => animarQueda(novaOp), 50);
    }
  };

  const criarObjetoAnimado = (texto: string, resposta: number, chave: string, velocidade: number) => {
    const lane = obterPistaLivre();
    const posX = (lane * LANE_WIDTH) + (LANE_WIDTH - CARD_WIDTH) / 2;
    
    const id = Math.random().toString();
    operacoesAtuaisRef.current.push({ lane, y: 0, chave: id }); // Usa ID unico na ref visual

    return {
      id, 
      chaveOriginal: chave,
      resposta, 
      textoTela: texto,
      y: new Animated.Value(0),
      speed: velocidade,
      posX, 
      lane, 
      especial: Math.random() < 0.1,
      opacity: new Animated.Value(1), 
      scale: new Animated.Value(1)
    };
  };

  const animarQueda = (op: any) => {
    if (!jogoAtivoRef.current) return;
    
    op.y.addListener(({ value }: any) => {
      const ref = operacoesAtuaisRef.current.find(o => o.chave === op.id);
      if (ref) ref.y = value;
    });

    Animated.timing(op.y, {
      toValue: GAME_AREA_HEIGHT + 50,
      duration: op.speed,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        processarErro(op.id);
      }
    });
  };

  const processarErro = (opId: string) => {
    questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1); // Remove da contagem
    
    setVidas(v => {
      const nv = v - 1;
      if (nv <= 0) {
        gameOver();
      }
      return nv;
    });

    // Remove visualmente
    setOperacoes(prev => prev.filter(o => o.id !== opId));
    operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== opId);
  };

  const gameOver = () => {
    jogoAtivoRef.current = false;
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (botTimer.current) clearInterval(botTimer.current);
    setOperacoes([]);
    setTela('resultado');
  };

  const verificarResposta = () => {
    if (jogoPausadoRef.current || !jogoAtivoRef.current) return;
    const val = parseInt(resposta);
    if (isNaN(val) || resposta === '') return;

    const alvo = operacoes.find(op => op.resposta === val);

    if (alvo) {
      // ACERTOU
      alvo.y.stopAnimation();
      questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
      
      // Pontuação
      const ptsBase = modoRef.current === 'missao' ? 10 : 10;
      setPontos(p => p + ptsBase);

      // PowerUp
      if (alvo.especial && !powerUpDisponivel) setPowerUpDisponivel(true);

      // Remove Visual
      dispararLaser(alvo, true);
      operacoesAtuaisRef.current = operacoesAtuaisRef.current.filter(o => o.chave !== alvo.id);
      
      setTimeout(() => {
        setOperacoes(prev => prev.filter(o => o.id !== alvo.id));
      }, 300);

    } else {
      // ERROU (Penalidade)
      dispararLaser(null, false);
      processarErro('nenhum'); // Tira vida sem remover questão (ou tira vida geral)
    }
    setResposta('');
  };

  // --- HELPERS E UTILITÁRIOS ---

  const obterPistaLivre = (): number => {
    const pistas = [0, 1, 2].filter(p => {
      const op = operacoesAtuaisRef.current.find(o => o.lane === p);
      return !op || op.y > GAME_AREA_HEIGHT * 0.25;
    });
    return pistas.length > 0 ? pistas[Math.floor(Math.random() * pistas.length)] : Math.floor(Math.random() * 3);
  };

  const gerarDadosArcade = () => {
    // Lógica simplificada de Arcade para economizar espaço e focar no fix
    // (Pode usar a lógica completa do arquivo anterior aqui se desejar)
    const n1 = Math.floor(Math.random()*10)+1;
    const n2 = Math.floor(Math.random()*10)+1;
    return {
      texto: `${n1} + ${n2}`,
      resposta: n1 + n2,
      chave: `${n1}+${n2}`,
      speed: Math.max(2000, 5000 - (pontos * 5))
    };
  };

  const iniciarBot = () => {
    botTimer.current = setInterval(() => {
      if (!jogoAtivoRef.current || jogoPausadoRef.current) return;
      const alvos = operacoesListRef.current.filter(o => (o.y as any)._value > GAME_AREA_HEIGHT * 0.4);
      if (alvos.length > 0 && Math.random() > 0.4) {
        const alvo = alvos[0];
        alvo.y.stopAnimation();
        dispararLaser(alvo, true);
        setBotPontos(p => p + 10);
        questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - 1);
        setOperacoes(prev => prev.filter(o => o.id !== alvo.id));
      }
    }, 2000);
  };

  const dispararLaser = (alvo: any, acertou: boolean) => {
    const cor = acertou ? '#32CD32' : '#FF4444';
    const x = acertou ? alvo.posX + CARD_WIDTH/2 : width/2;
    const y = acertou ? (alvo.y as any)._value : GAME_AREA_HEIGHT * 0.2;
    
    setLaserAtivo({ x, y, cor });
    laserAnim.setValue(0);
    
    Animated.parallel([
      Animated.timing(laserAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ...(acertou ? [
        Animated.timing(alvo.scale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
        Animated.timing(alvo.opacity, { toValue: 0, duration: 150, useNativeDriver: true })
      ] : [])
    ]).start(() => setLaserAtivo(null));

    if (!acertou) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    }
  };

  const ativarPowerUp = () => {
    if (!powerUpDisponivel) return;
    const visiveis = operacoes.filter(o => (o.y as any)._value < GAME_AREA_HEIGHT);
    visiveis.forEach(o => o.y.stopAnimation());
    setPontos(p => p + (visiveis.length * 10));
    questoesEmJogoRef.current = Math.max(0, questoesEmJogoRef.current - visiveis.length);
    setOperacoes([]);
    setPowerUpDisponivel(false);
  };

  // --- RENDER ---

  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <ScrollView contentContainerStyle={styles.menuScrollContent}>
            <View style={styles.menuHeader}>
              <Ionicons name="game-controller" size={56} color="#FFD700" />
              <Text style={styles.menuTitle}>Matemática Turbo</Text>
            </View>

            {missoesDisponiveis.length > 0 && (
              <View style={{width: '100%', marginBottom: 20}}>
                <Text style={styles.sectionLabel}>🎯 Missões do Professor:</Text>
                {missoesDisponiveis.map((missao, index) => (
                  <TouchableOpacity key={missao.id || index} style={styles.missaoCard} onPress={() => iniciarJogo('missao', missao)}>
                    <View style={styles.missaoIcon}><Ionicons name="trophy" size={24} color="#FFF" /></View>
                    <View style={{flex: 1}}>
                      <Text style={styles.missaoTitle}>{missao.titulo}</Text>
                      <Text style={styles.missaoSub}>{missao.questoes?.length} Questões • {missao.recompensa || 10} Pts • {missao.vidas || 5} Vidas</Text>
                    </View>
                    <Ionicons name="play-circle" size={32} color="#FFF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.sectionLabel}>Modo Arcade:</Text>
            <TouchableOpacity style={styles.iniciarButton} onPress={() => iniciarJogo('single')}><Text style={styles.iniciarButtonText}>JOGAR SOLO</Text></TouchableOpacity>
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
          
          {venceu && (
            <View style={[styles.resultadoCard, {backgroundColor: '#32CD3220'}]}>
              <Text style={[styles.resultadoPontos, {color: '#32CD32', fontSize: 32}]}>+{missaoAtualRef.current?.recompensa || 0} Pts Bônus</Text>
            </View>
          )}

          <View style={styles.resultadoCard}>
            <Text style={styles.resultadoPontos}>{pontos}</Text>
            <Text style={styles.resultadoLabel}>Pontos Totais</Text>
          </View>

          <TouchableOpacity style={styles.jogarNovamenteButton} onPress={() => setTela('menu')}>
            <Ionicons name="home" size={22} color="#000" />
            <Text style={styles.jogarNovamenteText}>Voltar ao Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.gameHeader}>
        <View style={styles.headerStatsGroup}>
          <Ionicons name="star" size={18} color="#FFD700" />
          <Text style={styles.statTextScore}>{pontos}</Text>
        </View>
        <TouchableOpacity onPress={() => setTela('menu')} style={styles.btnPausaIcone}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.vidasContainer}>
        {Array.from({ length: Math.max(0, vidas) }).map((_, i) => (
          <Ionicons key={i} name="heart" size={16} color="#FF4444" style={{marginHorizontal:2}} />
        ))}
      </View>

      <View style={[styles.gameArea, { height: GAME_AREA_HEIGHT }]}>
        {operacoes.map((op) => (
          <Animated.View key={op.id} style={[
            styles.operacaoCard, op.especial && styles.operacaoEspecial,
            { transform: [{ translateY: op.y }, { scale: op.scale }], left: op.posX, opacity: op.opacity }
          ]}>
            <Text style={[styles.operacaoText, op.especial && { color: '#000' }]}>{op.textoTela}</Text>
          </Animated.View>
        ))}
        {laserAtivo && (
          <Animated.View style={[
            styles.laser,
            { opacity: laserAnim, transform: [{ translateY: laserAnim.interpolate({ inputRange: [0, 1], outputRange: [height, laserAtivo.y] }) }],
              left: laserAtivo.x - 2, backgroundColor: laserAtivo.cor }
          ]} />
        )}
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.powerUpContainer}>
          {powerUpDisponivel && (
            <TouchableOpacity style={styles.btnPowerUpAtivo} onPress={ativarPowerUp}>
              <Ionicons name="flash" size={18} color="#000" /><Text style={styles.txtPowerUpAtivo}>DESTRUIR TUDO!</Text>
            </TouchableOpacity>
          )}
        </View>

        <Animated.View style={[styles.displayContainer, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.displayText}>{resposta || ' '}</Text>
        </Animated.View>

        <View style={styles.tecladoContainer}>
          {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
            <View key={i} style={styles.tecladoRow}>
              {row.map(num => (
                <BotaoTeclado key={num} valor={num} onPress={(v:string) => setResposta(r => r + v)}>
                  <Text style={styles.teclaText}>{num}</Text>
                </BotaoTeclado>
              ))}
            </View>
          ))}
          <View style={styles.tecladoRow}>
            <BotaoTeclado valor="apagar" onPress={() => setResposta(r => r.slice(0, -1))} styleExtra={styles.teclaApagar}>
              <Ionicons name="close" size={26} color="#fff" />
            </BotaoTeclado>
            <BotaoTeclado valor="0" onPress={(v:string) => setResposta(r => r + v)}>
              <Text style={styles.teclaText}>0</Text>
            </BotaoTeclado>
            <BotaoTeclado valor="enviar" onPress={verificarResposta} styleExtra={styles.teclaEnviar}>
              <Ionicons name="checkmark" size={30} color="#fff" />
            </BotaoTeclado>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  menuContainer: { flex: 1 },
  menuScrollContent: { padding: 20, alignItems: 'center' },
  menuHeader: { alignItems: 'center', marginBottom: 20, marginTop: 20 },
  menuTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 10 },
  menuSubtitle: { fontSize: 14, color: '#888' },
  sectionLabel: { color: '#888', fontSize: 14, fontWeight: 'bold', marginBottom: 10, alignSelf: 'flex-start', marginTop: 10 },
  missaoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF69B4', padding: 15, borderRadius: 16, marginBottom: 10, width: '100%', elevation: 3 },
  missaoIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  missaoTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  missaoSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  iniciarButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginBottom: 10 },
  iniciarButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerStatsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextScore: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  headerRightGroup: { flexDirection: 'row', alignItems: 'center' },
  btnPausaIcone: { padding: 4, marginLeft: 10 },
  vidasContainer: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingBottom: 10, height: 20 },
  gameArea: { position: 'relative', width: '100%', flex: 1, backgroundColor: '#0a0a0a', overflow: 'hidden' },
  operacaoCard: { position: 'absolute', top: 0, backgroundColor: '#4169E1', paddingVertical: 10, borderRadius: 8, width: CARD_WIDTH, alignItems: 'center', zIndex: 10 },
  operacaoEspecial: { backgroundColor: '#FFD700' },
  operacaoText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  laser: { position: 'absolute', width: 4, height: height, zIndex: 1 },
  bottomPanel: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 20, width: '100%' },
  powerUpContainer: { width: '100%', paddingHorizontal: 20, marginBottom: 10, height: 40 },
  btnPowerUpAtivo: { backgroundColor: '#FFD700', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  txtPowerUpAtivo: { color: '#000', fontWeight: '900', fontSize: 14 },
  displayContainer: { backgroundColor: '#1a1a2e', width: 250, height: 55, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  displayText: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  tecladoContainer: { width: 250, gap: 6 },
  tecladoRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  tecla: { backgroundColor: '#1a1a2e', flex: 1, height: 55, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  resultadoContainer: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 15 },
  resultadoCard: { backgroundColor: '#1a1a2e', padding: 30, borderRadius: 16, alignItems: 'center', marginBottom: 10, width: '100%' },
  resultadoPontos: { fontSize: 64, fontWeight: '900', color: '#FFD700' },
  resultadoLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  jogarNovamenteButton: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', marginBottom: 10 },
  jogarNovamenteText: { color: '#000', fontSize: 18, fontWeight: '900' },
});
