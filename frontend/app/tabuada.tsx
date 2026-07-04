import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../src/services/api';
import {
  TabuadaCardEstado,
  aplicarResposta,
  calcularProximaRevisao,
  calcularEvolucaoLeitnerPct,
  selecionarCardsDaSessao,
  NOMES_NIVEIS,
  NIVEL_MAX,
} from '../src/services/leitner';

// =============================================================================
// TRILHA DA TABUADA — jogo de repetição espaçada (método Leitner)
// O aluno digita a resposta (sem múltipla escolha). Cada operação é um card com
// nível 1..5; a lógica de níveis/revisão vive em src/services/leitner.ts
// (módulo puro e testado). As respostas são enviadas ao servidor no fim da
// sessão; se estiver sem internet, ficam guardadas e são reenviadas depois.
// =============================================================================

type Fase = 'carregando' | 'menu' | 'jogando' | 'resumo';

interface ItemFila { operacao: string; fator1: number; fator2: number; }

interface RespostaRegistro {
  operacao: string; fator1: number; fator2: number;
  respostaCorreta: number; respostaDada: number; acertou: boolean;
  tempoResposta: number; nivelAntes: number; nivelDepois: number;
  proximaRevisao: string; classificacao: string; respondidoEm: string;
}

interface FeedbackInfo {
  acertou: boolean; respostaCorreta: number; fator1: number; fator2: number;
  nivelAntes: number; nivelDepois: number; classificacao: string;
}

const CHAVE_PENDENTES = 'tabuada_sessoes_pendentes';
const TECLAS: string[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['apagar', '0', 'ok']];

export default function TrilhaDaTabuada() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('carregando');
  const [cards, setCards] = useState<TabuadaCardEstado[]>([]);
  const [tamanhoSessao, setTamanhoSessao] = useState(10);
  const [fila, setFila] = useState<ItemFila[]>([]);
  const [indice, setIndice] = useState(0);
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [falhaEnvio, setFalhaEnvio] = useState(false);

  const respostasSessao = useRef<RespostaRegistro[]>([]);
  const perguntaIniciadaEm = useRef(0);
  const reapresentados = useRef<Record<string, number>>({});
  const evolucaoAntes = useRef(0);
  const cronometroRef = useRef<any>(null);

  // Refs pro teclado físico (web) enxergar sempre o estado atual
  const stateRef = useRef({ fase, feedback, resposta });
  stateRef.current = { fase, feedback, resposta };

  // ----- Carregamento inicial: reenvia sessões pendentes e busca os cards -----
  const carregar = useCallback(async () => {
    setFase('carregando');
    try {
      const pendentesRaw = await AsyncStorage.getItem(CHAVE_PENDENTES);
      if (pendentesRaw) {
        const pendentes: any[] = JSON.parse(pendentesRaw);
        const restantes: any[] = [];
        for (const p of pendentes) {
          try { await api.enviarTabuadaSessao(p); } catch { restantes.push(p); }
        }
        if (restantes.length > 0) await AsyncStorage.setItem(CHAVE_PENDENTES, JSON.stringify(restantes));
        else await AsyncStorage.removeItem(CHAVE_PENDENTES);
      }
    } catch {}
    const dados = await api.getTabuadaCards();
    setCards(Array.isArray(dados) ? dados : []);
    setFase('menu');
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ----- Cronômetro visível da pergunta atual -----
  useEffect(() => {
    if (fase === 'jogando' && !feedback) {
      cronometroRef.current = setInterval(() => {
        setSegundos(Math.floor((Date.now() - perguntaIniciadaEm.current) / 1000));
      }, 500);
      return () => clearInterval(cronometroRef.current);
    }
  }, [fase, feedback, indice]);

  const quantosVencidos = () => {
    const agora = new Date().toISOString();
    return cards.filter(c => c.vezesVista > 0 && c.proximaRevisao <= agora).length;
  };

  // ----- Início da sessão -----
  const iniciarSessao = (usarCards?: TabuadaCardEstado[]) => {
    const base = usarCards ?? cards;
    const selecao = selecionarCardsDaSessao(base, new Date().toISOString(), tamanhoSessao);
    respostasSessao.current = [];
    reapresentados.current = {};
    evolucaoAntes.current = calcularEvolucaoLeitnerPct(base);
    setFila(selecao);
    setIndice(0);
    setResposta('');
    setFeedback(null);
    setFalhaEnvio(false);
    perguntaIniciadaEm.current = Date.now();
    setSegundos(0);
    setFase('jogando');
  };

  // ----- Atualiza a cópia local do card após uma resposta -----
  const atualizarCardLocal = (lista: TabuadaCardEstado[], r: RespostaRegistro): TabuadaCardEstado[] => {
    const nova = [...lista];
    const idx = nova.findIndex(c => c.operacao === r.operacao);
    const existente = idx >= 0 ? nova[idx] : null;
    const atualizado: TabuadaCardEstado = {
      operacao: r.operacao,
      fator1: r.fator1,
      fator2: r.fator2,
      nivel: r.nivelDepois,
      proximaRevisao: r.proximaRevisao,
      vezesVista: (existente?.vezesVista ?? 0) + 1,
      vezesErrada: (existente?.vezesErrada ?? 0) + (r.acertou ? 0 : 1),
      ultimoErroEm: r.acertou ? (existente?.ultimoErroEm ?? null) : r.respondidoEm,
    };
    if (idx >= 0) nova[idx] = atualizado; else nova.push(atualizado);
    return nova;
  };

  // ----- Resposta enviada (OK / Enter) -----
  const confirmarResposta = () => {
    const s = stateRef.current;
    if (s.fase !== 'jogando' || s.feedback || s.resposta === '') return;

    const item = fila[indice];
    if (!item) return;
    const tempo = (Date.now() - perguntaIniciadaEm.current) / 1000;
    const correta = item.fator1 * item.fator2;
    const dada = parseInt(s.resposta, 10);
    const acertou = dada === correta;

    const cardAtual = cards.find(c => c.operacao === item.operacao);
    const nivelAntes = cardAtual && cardAtual.vezesVista > 0 ? cardAtual.nivel : 1;
    const { nivelDepois, classificacao } = aplicarResposta(nivelAntes, acertou, tempo);
    const agoraISO = new Date().toISOString();
    const proximaRevisao = calcularProximaRevisao(nivelDepois, agoraISO);

    const registro: RespostaRegistro = {
      operacao: item.operacao, fator1: item.fator1, fator2: item.fator2,
      respostaCorreta: correta, respostaDada: isNaN(dada) ? -1 : dada, acertou,
      tempoResposta: Math.round(tempo * 10) / 10,
      nivelAntes, nivelDepois, proximaRevisao, classificacao, respondidoEm: agoraISO,
    };
    respostasSessao.current.push(registro);
    setCards(prev => atualizarCardLocal(prev, registro));

    // Errou: o card volta pro nível 1 e reaparece no FIM da mesma sessão (1 vez)
    if (!acertou && (reapresentados.current[item.operacao] ?? 0) < 1) {
      reapresentados.current[item.operacao] = (reapresentados.current[item.operacao] ?? 0) + 1;
      setFila(prev => [...prev, item]);
    }

    setFeedback({ acertou, respostaCorreta: correta, fator1: item.fator1, fator2: item.fator2, nivelAntes, nivelDepois, classificacao });

    setTimeout(() => {
      setFeedback(null);
      setResposta('');
      const proximo = indice + 1;
      if (proximo >= filaRef.current.length) {
        finalizarSessao();
      } else {
        setIndice(proximo);
        perguntaIniciadaEm.current = Date.now();
        setSegundos(0);
      }
    }, acertou ? 1100 : 2000);
  };

  // fila pode crescer durante o feedback (re-fila de erro) — ref pra leitura fresca
  const filaRef = useRef(fila);
  filaRef.current = fila;

  // ----- Fim da sessão: envia o lote pro servidor (ou guarda pra reenviar) -----
  const finalizarSessao = async () => {
    setFase('resumo');
    setEnviando(true);
    const payload = { modulo: 'tabuada', respostas: respostasSessao.current };
    try {
      await api.enviarTabuadaSessao(payload);
      setFalhaEnvio(false);
    } catch {
      setFalhaEnvio(true);
      try {
        const raw = await AsyncStorage.getItem(CHAVE_PENDENTES);
        const pendentes = raw ? JSON.parse(raw) : [];
        pendentes.push(payload);
        await AsyncStorage.setItem(CHAVE_PENDENTES, JSON.stringify(pendentes));
      } catch {}
    }
    setEnviando(false);
  };

  // ----- Teclado na tela -----
  const apertarTecla = (valor: string) => {
    if (stateRef.current.feedback) return;
    if (valor === 'apagar') setResposta(r => r.slice(0, -1));
    else if (valor === 'ok') confirmarResposta();
    else setResposta(r => (r.length < 3 ? r + valor : r));
  };

  // ----- Teclado físico (web) -----
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: any) => {
      if (stateRef.current.fase !== 'jogando') return;
      if (e.key >= '0' && e.key <= '9') apertarTecla(e.key);
      else if (e.key === 'Backspace') apertarTecla('apagar');
      else if (e.key === 'Enter') apertarTecla('ok');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, fila, cards]);

  // ============================ TELAS ============================

  if (fase === 'carregando') {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFB300" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  // ----- MENU -----
  if (fase === 'menu') {
    const vencidos = quantosVencidos();
    const evolucao = calcularEvolucaoLeitnerPct(cards);
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.menuScroll}>
          <TouchableOpacity style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFB300" />
          </TouchableOpacity>

          <Ionicons name="trail-sign" size={64} color="#FFB300" style={{ marginTop: 10 }} />
          <Text style={styles.tituloMenu}>TRILHA DA</Text>
          <Text style={styles.subtituloMenu}>TABUADA</Text>
          <Text style={styles.explicacao}>
            Treinos curtos de multiplicação com revisão espaçada: as contas que você
            erra ou demora voltam mais vezes, e as que você domina aparecem só de vez em quando.
          </Text>

          <View style={styles.menuStatsRow}>
            <View style={styles.menuStatBox}>
              <Text style={styles.menuStatValor}>{evolucao.toFixed(0)}%</Text>
              <Text style={styles.menuStatLabel}>Evolução</Text>
            </View>
            <View style={styles.menuStatBox}>
              <Text style={[styles.menuStatValor, { color: vencidos > 0 ? '#FF7055' : '#32CD32' }]}>{vencidos}</Text>
              <Text style={styles.menuStatLabel}>Para revisar hoje</Text>
            </View>
          </View>

          <Text style={styles.rotuloTamanho}>Tamanho do treino</Text>
          <View style={styles.tamanhoRow}>
            {[10, 15, 20].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.tamanhoChip, tamanhoSessao === n && styles.tamanhoChipAtivo]}
                onPress={() => setTamanhoSessao(n)}
              >
                <Text style={[styles.tamanhoChipTexto, tamanhoSessao === n && styles.tamanhoChipTextoAtivo]}>{n} perguntas</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.btnIniciar} onPress={() => iniciarSessao()}>
            <Ionicons name="play" size={20} color="#1a1200" />
            <Text style={styles.btnIniciarTexto}>COMEÇAR TREINO</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnEvolucao} onPress={() => router.push('/tabuada_evolucao' as any)}>
            <Ionicons name="trending-up" size={18} color="#FFB300" />
            <Text style={styles.btnEvolucaoTexto}>MINHA EVOLUÇÃO</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- RESUMO -----
  if (fase === 'resumo') {
    const rs = respostasSessao.current;
    const acertos = rs.filter(r => r.acertou).length;
    const erros = rs.length - acertos;
    const tempoMedio = rs.length ? (rs.reduce((soma, r) => soma + r.tempoResposta, 0) / rs.length) : 0;
    const rapidas = rs.filter(r => r.classificacao === 'RAPIDA').length;

    const errosPorTabuada: Record<number, number> = {};
    rs.filter(r => !r.acertou).forEach(r => {
      errosPorTabuada[r.fator1] = (errosPorTabuada[r.fator1] ?? 0) + 1;
      errosPorTabuada[r.fator2] = (errosPorTabuada[r.fator2] ?? 0) + 1;
    });
    const tabuadasDificeis = Object.entries(errosPorTabuada).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => f);
    const paraRevisar = [...new Set(rs.filter(r => !r.acertou).map(r => r.operacao))];
    const evolucaoDepois = calcularEvolucaoLeitnerPct(cards);
    const delta = evolucaoDepois - evolucaoAntes.current;

    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.menuScroll}>
          <Ionicons name={acertos >= erros ? 'trophy' : 'fitness'} size={56} color="#FFB300" style={{ marginTop: 16 }} />
          <Text style={styles.resumoTitulo}>Treino concluído!</Text>

          {enviando && <ActivityIndicator size="small" color="#FFB300" style={{ marginTop: 4 }} />}
          {falhaEnvio && (
            <Text style={styles.avisoOffline}>Sem conexão agora — seu treino ficou salvo no aparelho e será enviado automaticamente.</Text>
          )}

          <View style={styles.resumoGrid}>
            <View style={styles.resumoBox}><Text style={[styles.resumoValor, { color: '#32CD32' }]}>{acertos}</Text><Text style={styles.resumoLabel}>Acertos</Text></View>
            <View style={styles.resumoBox}><Text style={[styles.resumoValor, { color: '#FF7055' }]}>{erros}</Text><Text style={styles.resumoLabel}>Erros</Text></View>
            <View style={styles.resumoBox}><Text style={styles.resumoValor}>{tempoMedio.toFixed(1)}s</Text><Text style={styles.resumoLabel}>Tempo médio</Text></View>
            <View style={styles.resumoBox}><Text style={[styles.resumoValor, { color: '#FFD700' }]}>{rapidas}⚡</Text><Text style={styles.resumoLabel}>Rápidas</Text></View>
          </View>

          <View style={styles.resumoCard}>
            <Text style={styles.resumoCardTitulo}>Sua evolução</Text>
            <Text style={styles.resumoEvolucao}>
              {evolucaoAntes.current.toFixed(1)}% → {evolucaoDepois.toFixed(1)}%
              <Text style={{ color: delta >= 0 ? '#32CD32' : '#FF7055' }}>  ({delta >= 0 ? '+' : ''}{delta.toFixed(1)}%)</Text>
            </Text>
          </View>

          {tabuadasDificeis.length > 0 && (
            <View style={styles.resumoCard}>
              <Text style={styles.resumoCardTitulo}>Tabuadas com mais dificuldade</Text>
              <Text style={styles.resumoCardTexto}>Tabuada {tabuadasDificeis.map(t => `do ${t}`).join(' e ')}</Text>
            </View>
          )}

          {paraRevisar.length > 0 && (
            <View style={styles.resumoCard}>
              <Text style={styles.resumoCardTitulo}>Vão voltar pra você revisar</Text>
              <Text style={styles.resumoCardTexto}>{paraRevisar.map(op => op.replace('x', ' × ')).join('   ')}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.btnIniciar} onPress={() => iniciarSessao()}>
            <Ionicons name="refresh" size={20} color="#1a1200" />
            <Text style={styles.btnIniciarTexto}>TREINAR DE NOVO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnEvolucao} onPress={() => router.push('/tabuada_evolucao' as any)}>
            <Ionicons name="trending-up" size={18} color="#FFB300" />
            <Text style={styles.btnEvolucaoTexto}>MINHA EVOLUÇÃO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnVoltar} onPress={() => setFase('menu')}>
            <Text style={styles.btnVoltarTexto}>VOLTAR AO INÍCIO</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- JOGANDO -----
  const item = fila[indice];
  if (!item) return null;
  const cardAtual = cards.find(c => c.operacao === item.operacao);
  const nivelExibido = feedback ? feedback.nivelDepois : (cardAtual && cardAtual.vezesVista > 0 ? cardAtual.nivel : 1);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.jogoTopo}>
        <TouchableOpacity onPress={() => setFase('menu')}>
          <Ionicons name="close" size={26} color="#888" />
        </TouchableOpacity>
        <Text style={styles.progresso}>{Math.min(indice + 1, fila.length)} / {fila.length}</Text>
        <View style={styles.cronometro}>
          <Ionicons name="time-outline" size={14} color={segundos > 10 ? '#FF7055' : segundos > 5 ? '#FFD700' : '#32CD32'} />
          <Text style={[styles.cronometroTexto, { color: segundos > 10 ? '#FF7055' : segundos > 5 ? '#FFD700' : '#32CD32' }]}>{segundos}s</Text>
        </View>
      </View>

      <View style={styles.nivelRow}>
        {Array.from({ length: NIVEL_MAX }).map((_, i) => (
          <Ionicons key={i} name={i < nivelExibido ? 'star' : 'star-outline'} size={16} color={i < nivelExibido ? '#FFB300' : '#444'} />
        ))}
        <Text style={styles.nivelNome}>{NOMES_NIVEIS[nivelExibido]}</Text>
      </View>

      <View style={styles.areaConta}>
        <Text style={styles.conta}>{item.fator1} × {item.fator2}</Text>
        <View style={[styles.caixaResposta, feedback && (feedback.acertou ? styles.caixaAcerto : styles.caixaErro)]}>
          <Text style={styles.respostaTexto}>{resposta || ' '}</Text>
        </View>

        {feedback && (
          <View style={styles.feedbackBox}>
            {feedback.acertou ? (
              <>
                <Text style={styles.feedbackAcerto}>
                  {feedback.classificacao === 'RAPIDA' ? '⚡ Resposta rápida!' : feedback.classificacao === 'LENTA' ? '✓ Certo! (tente mais rápido)' : '✓ Muito bem!'}
                </Text>
                <Text style={styles.feedbackNivel}>
                  {feedback.nivelDepois > feedback.nivelAntes
                    ? `Subiu para o nível ${feedback.nivelDepois} — ${NOMES_NIVEIS[feedback.nivelDepois]}`
                    : `Continua no nível ${feedback.nivelDepois} — ${NOMES_NIVEIS[feedback.nivelDepois]}`}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.feedbackErro}>✗ {feedback.fator1} × {feedback.fator2} = {feedback.respostaCorreta}</Text>
                <Text style={styles.feedbackNivel}>Voltou para o nível 1 — vai reaparecer neste treino</Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={styles.teclado}>
        {TECLAS.map((linha, i) => (
          <View key={i} style={styles.tecladoLinha}>
            {linha.map(tecla => (
              <TouchableOpacity
                key={tecla}
                style={[styles.tecla, tecla === 'ok' && styles.teclaOk, tecla === 'apagar' && styles.teclaApagar]}
                onPress={() => apertarTecla(tecla)}
                disabled={!!feedback}
              >
                {tecla === 'apagar' ? <Ionicons name="backspace" size={22} color="#FFF" />
                  : tecla === 'ok' ? <Ionicons name="checkmark" size={24} color="#1a1200" />
                  : <Text style={styles.teclaTexto}>{tecla}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b04' },
  menuScroll: { padding: 20, alignItems: 'center', paddingBottom: 50 },
  tituloMenu: { fontSize: 30, fontWeight: '900', color: '#FFF', letterSpacing: 3, marginTop: 8 },
  subtituloMenu: { fontSize: 38, fontWeight: '900', color: '#FFB300', letterSpacing: 5, marginTop: -6 },
  explicacao: { color: '#998', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19, maxWidth: 340 },
  menuStatsRow: { flexDirection: 'row', gap: 14, marginTop: 24 },
  menuStatBox: { backgroundColor: '#1a1608', borderRadius: 14, borderWidth: 1, borderColor: '#332a10', paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', minWidth: 130 },
  menuStatValor: { color: '#FFB300', fontSize: 26, fontWeight: '900' },
  menuStatLabel: { color: '#887', fontSize: 11, marginTop: 2 },
  rotuloTamanho: { color: '#887', fontSize: 12, marginTop: 28, marginBottom: 8 },
  tamanhoRow: { flexDirection: 'row', gap: 10 },
  tamanhoChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#1a1608', borderWidth: 1, borderColor: '#332a10' },
  tamanhoChipAtivo: { backgroundColor: '#FFB300', borderColor: '#FFB300' },
  tamanhoChipTexto: { color: '#887', fontWeight: '700', fontSize: 12 },
  tamanhoChipTextoAtivo: { color: '#1a1200' },
  btnIniciar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFB300', borderRadius: 14, paddingVertical: 15, width: '100%', maxWidth: 360, marginTop: 28 },
  btnIniciarTexto: { color: '#1a1200', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  btnEvolucao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: '#FFB300', borderRadius: 14, paddingVertical: 13, width: '100%', maxWidth: 360, marginTop: 12 },
  btnEvolucaoTexto: { color: '#FFB300', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  btnVoltar: { marginTop: 16, padding: 10 },
  btnVoltarTexto: { color: '#776', fontWeight: '700', fontSize: 12 },

  jogoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10 },
  progresso: { color: '#CCB', fontSize: 15, fontWeight: '800' },
  cronometro: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 52, justifyContent: 'flex-end' },
  cronometroTexto: { fontSize: 14, fontWeight: '800' },
  nivelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 14 },
  nivelNome: { color: '#887', fontSize: 12, marginLeft: 8 },
  areaConta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conta: { color: '#FFF', fontSize: 56, fontWeight: '900', letterSpacing: 2 },
  caixaResposta: { marginTop: 22, minWidth: 140, borderBottomWidth: 3, borderBottomColor: '#FFB300', paddingHorizontal: 18, paddingVertical: 6, alignItems: 'center' },
  caixaAcerto: { borderBottomColor: '#32CD32' },
  caixaErro: { borderBottomColor: '#FF7055' },
  respostaTexto: { color: '#FFB300', fontSize: 42, fontWeight: '900', minHeight: 52 },
  feedbackBox: { marginTop: 18, alignItems: 'center', paddingHorizontal: 24 },
  feedbackAcerto: { color: '#32CD32', fontSize: 20, fontWeight: '900' },
  feedbackErro: { color: '#FF7055', fontSize: 22, fontWeight: '900' },
  feedbackNivel: { color: '#AA9', fontSize: 13, marginTop: 6, textAlign: 'center' },

  teclado: { paddingHorizontal: 24, paddingBottom: 18, gap: 10, alignSelf: 'center', width: '100%', maxWidth: 380 },
  tecladoLinha: { flexDirection: 'row', gap: 10 },
  tecla: { flex: 1, height: 58, borderRadius: 12, backgroundColor: '#1a1608', borderWidth: 1, borderColor: '#332a10', alignItems: 'center', justifyContent: 'center' },
  teclaOk: { backgroundColor: '#FFB300', borderColor: '#FFB300' },
  teclaApagar: { backgroundColor: '#2a1410', borderColor: '#442018' },
  teclaTexto: { color: '#FFF', fontSize: 24, fontWeight: '800' },

  resumoTitulo: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 10 },
  avisoOffline: { color: '#FFD700', fontSize: 11, textAlign: 'center', marginTop: 8, paddingHorizontal: 30 },
  resumoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, justifyContent: 'center' },
  resumoBox: { backgroundColor: '#1a1608', borderRadius: 12, borderWidth: 1, borderColor: '#332a10', paddingVertical: 12, alignItems: 'center', width: '46%', maxWidth: 170 },
  resumoValor: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  resumoLabel: { color: '#887', fontSize: 11, marginTop: 2 },
  resumoCard: { backgroundColor: '#1a1608', borderRadius: 12, borderWidth: 1, borderColor: '#332a10', padding: 14, marginTop: 12, width: '100%', maxWidth: 360 },
  resumoCardTitulo: { color: '#FFB300', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  resumoCardTexto: { color: '#DDC', fontSize: 14, fontWeight: '600' },
  resumoEvolucao: { color: '#FFF', fontSize: 18, fontWeight: '900' },
});
