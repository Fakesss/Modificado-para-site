import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../src/services/api';
import { gerarQuestoesDesafio, rotuloDificuldade, corDificuldade, QuantidadeDesafio, QUANTIDADES_DESAFIO, QuestaoDesafio } from '../src/services/desafioTabuada';
import { TabuadaDesafioResultado } from '../src/types';

// =============================================================================
// DESAFIO FLASH CARDS — modo à parte da Trilha da Tabuada, com ranking.
// O aluno escolhe QUAIS tabuadas quer enfrentar e a quantidade de questões
// (15/20/30); o jogo sorteia as perguntas só dentro dessas tabuadas. A
// pontuação final é sempre calculada e devolvida pelo servidor (nunca
// confiamos num valor calculado localmente) — ver /tabuada/desafio/resultado.
// Não mexe no estado do Leitner (db.tabuada_cards): é um modo separado.
// =============================================================================

type Fase = 'config' | 'jogando' | 'resumo';

interface RespostaDesafio { operacao: string; acertou: boolean; }

const CHAVE_PENDENTES = 'tabuada_desafio_pendentes';
const TECLAS: string[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['apagar', '0', 'ok']];

function formatarTempo(segundosTotais: number): string {
  const s = Math.max(0, Math.round(segundosTotais));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${min}:${seg.toString().padStart(2, '0')}`;
}

export default function DesafioFlashCards() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>('config');

  const [tabuadasSelecionadas, setTabuadasSelecionadas] = useState<number[]>([]);
  const [quantidade, setQuantidade] = useState<QuantidadeDesafio>(15);

  const [fila, setFila] = useState<QuestaoDesafio[]>([]);
  const [indice, setIndice] = useState(0);
  const [resposta, setResposta] = useState('');
  const [feedback, setFeedback] = useState<{ acertou: boolean; respostaCorreta: number } | null>(null);
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(false);
  const [resultado, setResultado] = useState<TabuadaDesafioResultado | null>(null);

  const respostasRef = useRef<RespostaDesafio[]>([]);
  const tempoAcumuladoRef = useRef(0); // soma do tempo de pensar/digitar de cada questão (sem contar a pausa de feedback)
  const perguntaIniciadaEm = useRef(0);
  const inicioPartidaEm = useRef(0);
  const cronometroRef = useRef<any>(null);
  const respondendoRef = useRef(false);

  const stateRef = useRef({ fase, feedback, resposta, indice });
  stateRef.current = { fase, feedback, resposta, indice };
  const filaRef = useRef(fila);
  filaRef.current = fila;

  // ----- Reenvia resultados pendentes (offline) ao abrir a tela -----
  const reenviarPendentes = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CHAVE_PENDENTES);
      if (!raw) return;
      const pendentes: any[] = JSON.parse(raw);
      const restantes: any[] = [];
      for (const p of pendentes) {
        try { await api.enviarTabuadaDesafioResultado(p); } catch { restantes.push(p); }
      }
      if (restantes.length > 0) await AsyncStorage.setItem(CHAVE_PENDENTES, JSON.stringify(restantes));
      else await AsyncStorage.removeItem(CHAVE_PENDENTES);
    } catch {}
  }, []);

  useEffect(() => { reenviarPendentes(); }, [reenviarPendentes]);

  // ----- Cronômetro visível (só exibição — o tempo pontuado é medido à parte) -----
  useEffect(() => {
    if (fase === 'jogando') {
      cronometroRef.current = setInterval(() => {
        setSegundosDecorridos(Math.floor((Date.now() - inicioPartidaEm.current) / 1000));
      }, 500);
      return () => clearInterval(cronometroRef.current);
    }
  }, [fase]);

  const alternarTabuada = (t: number) => {
    setTabuadasSelecionadas(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t].sort((a, b) => a - b));
  };

  const iniciarDesafio = () => {
    if (tabuadasSelecionadas.length === 0) return;
    const selecao = gerarQuestoesDesafio(tabuadasSelecionadas, quantidade);
    respostasRef.current = [];
    tempoAcumuladoRef.current = 0;
    respondendoRef.current = false;
    setFila(selecao);
    setIndice(0);
    setResposta('');
    setFeedback(null);
    setResultado(null);
    setErroEnvio(false);
    inicioPartidaEm.current = Date.now();
    perguntaIniciadaEm.current = Date.now();
    setSegundosDecorridos(0);
    setFase('jogando');
  };

  const finalizarDesafio = async () => {
    setFase('resumo');
    setEnviando(true);
    const acertos = respostasRef.current.filter(r => r.acertou).length;
    const payload = {
      tabuadas: tabuadasSelecionadas,
      quantidadeQuestoes: quantidade,
      acertos,
      tempoTotalSegundos: Math.round(tempoAcumuladoRef.current * 10) / 10,
    };
    try {
      const r = await api.enviarTabuadaDesafioResultado(payload);
      setResultado(r);
      setErroEnvio(false);
    } catch {
      setErroEnvio(true);
      try {
        const raw = await AsyncStorage.getItem(CHAVE_PENDENTES);
        const pendentes = raw ? JSON.parse(raw) : [];
        pendentes.push(payload);
        await AsyncStorage.setItem(CHAVE_PENDENTES, JSON.stringify(pendentes));
      } catch {}
    }
    setEnviando(false);
  };

  // ----- Resposta enviada (por digitação) -----
  const registrarResposta = (respostaStr: string) => {
    if (respondendoRef.current || stateRef.current.fase !== 'jogando') return;
    const item = filaRef.current[stateRef.current.indice];
    if (!item) return;
    respondendoRef.current = true;

    const tempo = (Date.now() - perguntaIniciadaEm.current) / 1000;
    tempoAcumuladoRef.current += tempo;

    const correta = item.fator1 * item.fator2;
    const dada = parseInt(respostaStr, 10);
    const acertou = dada === correta;
    respostasRef.current.push({ operacao: item.operacao, acertou });

    setFeedback({ acertou, respostaCorreta: correta });

    setTimeout(() => {
      setFeedback(null);
      setResposta('');
      respondendoRef.current = false;
      const proximo = stateRef.current.indice + 1;
      if (proximo >= filaRef.current.length) {
        finalizarDesafio();
      } else {
        setIndice(proximo);
        perguntaIniciadaEm.current = Date.now();
      }
    }, acertou ? 450 : 700);
  };

  const confirmarResposta = () => {
    if (stateRef.current.resposta === '') return;
    registrarResposta(stateRef.current.resposta);
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
  }, [indice, fila]);

  // ============================ TELAS ============================

  // ----- CONFIG -----
  if (fase === 'config') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.menuScroll}>
          <TouchableOpacity style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFB300" />
          </TouchableOpacity>

          <Ionicons name="trophy" size={56} color="#FFB300" style={{ marginTop: 10 }} />
          <Text style={styles.tituloMenu}>DESAFIO</Text>
          <Text style={styles.subtituloMenu}>FLASH CARDS</Text>
          <Text style={styles.explicacao}>
            Escolha as tabuadas que quer treinar e o tamanho da partida. Tabuadas mais difíceis
            valem muito mais pontos — só escolher as fáceis não te leva ao topo do ranking!
          </Text>

          <Text style={styles.rotuloSecao}>Tabuadas</Text>
          <View style={styles.gridTabuadas}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(t => {
              const ativa = tabuadasSelecionadas.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chipTabuada, ativa && { backgroundColor: corDificuldade(t), borderColor: corDificuldade(t) }]}
                  onPress={() => alternarTabuada(t)}
                >
                  <Text style={[styles.chipTabuadaNumero, ativa && styles.chipTabuadaNumeroAtivo]}>{t}</Text>
                  <Text style={[styles.chipTabuadaRotulo, ativa && styles.chipTabuadaRotuloAtivo]}>{rotuloDificuldade(t)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.rotuloSecao}>Quantidade de questões</Text>
          <View style={styles.tamanhoRow}>
            {QUANTIDADES_DESAFIO.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.tamanhoChip, quantidade === n && styles.tamanhoChipAtivo]}
                onPress={() => setQuantidade(n)}
              >
                <Text style={[styles.tamanhoChipTexto, quantidade === n && styles.tamanhoChipTextoAtivo]}>{n} questões</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btnIniciar, tabuadasSelecionadas.length === 0 && styles.btnIniciarDesativado]}
            disabled={tabuadasSelecionadas.length === 0}
            onPress={iniciarDesafio}
          >
            <Ionicons name="play" size={20} color="#1a1200" />
            <Text style={styles.btnIniciarTexto}>
              {tabuadasSelecionadas.length === 0 ? 'ESCOLHA AO MENOS 1 TABUADA' : 'COMEÇAR DESAFIO'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnEvolucao} onPress={() => router.push('/tabuada_desafio_ranking' as any)}>
            <Ionicons name="podium" size={18} color="#FFB300" />
            <Text style={styles.btnEvolucaoTexto}>VER RANKING</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- RESUMO -----
  if (fase === 'resumo') {
    const acertos = respostasRef.current.filter(r => r.acertou).length;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.menuScroll}>
          <Ionicons name={acertos >= fila.length / 2 ? 'trophy' : 'fitness'} size={56} color="#FFB300" style={{ marginTop: 16 }} />
          <Text style={styles.resumoTitulo}>Desafio concluído!</Text>

          {enviando && <ActivityIndicator size="small" color="#FFB300" style={{ marginTop: 4 }} />}
          {erroEnvio && (
            <Text style={styles.avisoOffline}>Sem conexão agora — seu resultado ficou salvo no aparelho e será enviado automaticamente.</Text>
          )}

          <View style={styles.resumoGrid}>
            <View style={styles.resumoBox}><Text style={[styles.resumoValor, { color: '#32CD32' }]}>{acertos}/{fila.length}</Text><Text style={styles.resumoLabel}>Acertos</Text></View>
            <View style={styles.resumoBox}><Text style={styles.resumoValor}>{formatarTempo(tempoAcumuladoRef.current)}</Text><Text style={styles.resumoLabel}>Tempo total</Text></View>
          </View>

          {resultado && (
            <View style={styles.resumoCard}>
              <Text style={styles.resumoCardTitulo}>Pontuação final</Text>
              <Text style={styles.resumoPontuacaoFinal}>{resultado.pontuacaoFinal.toFixed(0)} pts</Text>
              <Text style={styles.resumoCardTexto}>
                Base: {resultado.pontuacaoBase.toFixed(0)} (peso médio {resultado.pesoMedio.toFixed(1)}) + bônus de tempo: {resultado.bonusTempo.toFixed(0)}
              </Text>
            </View>
          )}

          <View style={styles.resumoCard}>
            <Text style={styles.resumoCardTitulo}>Tabuadas nesta partida</Text>
            <View style={styles.badgesRow}>
              {tabuadasSelecionadas.map(t => (
                <View key={t} style={[styles.badgeTabuada, { borderColor: corDificuldade(t) }]}>
                  <Text style={[styles.badgeTabuadaTexto, { color: corDificuldade(t) }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.btnIniciar} onPress={iniciarDesafio}>
            <Ionicons name="refresh" size={20} color="#1a1200" />
            <Text style={styles.btnIniciarTexto}>JOGAR DE NOVO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnEvolucao} onPress={() => router.push('/tabuada_desafio_ranking' as any)}>
            <Ionicons name="podium" size={18} color="#FFB300" />
            <Text style={styles.btnEvolucaoTexto}>VER RANKING</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnVoltar} onPress={() => setFase('config')}>
            <Text style={styles.btnVoltarTexto}>MUDAR CONFIGURAÇÃO</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- JOGANDO -----
  const item = fila[indice];
  if (!item) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.jogoTopo}>
        <TouchableOpacity onPress={() => setFase('config')}>
          <Ionicons name="close" size={26} color="#888" />
        </TouchableOpacity>
        <Text style={styles.progresso}>{Math.min(indice + 1, fila.length)} / {fila.length}</Text>
        <View style={styles.cronometro}>
          <Ionicons name="stopwatch-outline" size={14} color="#7FD4FF" />
          <Text style={styles.cronometroTexto}>{formatarTempo(segundosDecorridos)}</Text>
        </View>
      </View>

      <View style={styles.areaConta}>
        <Text style={styles.conta}>{item.fator1} × {item.fator2}</Text>
        <View style={[styles.caixaResposta, feedback && (feedback.acertou ? styles.caixaAcerto : styles.caixaErro)]}>
          <Text style={styles.respostaTexto}>{resposta || ' '}</Text>
        </View>

        {feedback && !feedback.acertou && (
          <Text style={styles.feedbackErro}>✗ {item.fator1} × {item.fator2} = {feedback.respostaCorreta}</Text>
        )}
        {feedback && feedback.acertou && (
          <Text style={styles.feedbackAcerto}>✓ Certo!</Text>
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
  subtituloMenu: { fontSize: 30, fontWeight: '900', color: '#FFB300', letterSpacing: 3, marginTop: -6 },
  explicacao: { color: '#998', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19, maxWidth: 340 },

  rotuloSecao: { color: '#FFB300', fontSize: 13, fontWeight: '800', marginTop: 26, marginBottom: 10, alignSelf: 'flex-start' },
  gridTabuadas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chipTabuada: { width: 62, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1a1608', borderWidth: 2, borderColor: '#332a10', alignItems: 'center' },
  chipTabuadaNumero: { color: '#DDC', fontSize: 20, fontWeight: '900' },
  chipTabuadaNumeroAtivo: { color: '#1a1200' },
  chipTabuadaRotulo: { color: '#776', fontSize: 9, fontWeight: '700', marginTop: 2 },
  chipTabuadaRotuloAtivo: { color: '#1a1200' },

  tamanhoRow: { flexDirection: 'row', gap: 10 },
  tamanhoChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#1a1608', borderWidth: 1, borderColor: '#332a10' },
  tamanhoChipAtivo: { backgroundColor: '#FFB300', borderColor: '#FFB300' },
  tamanhoChipTexto: { color: '#887', fontWeight: '700', fontSize: 12 },
  tamanhoChipTextoAtivo: { color: '#1a1200' },

  btnIniciar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFB300', borderRadius: 14, paddingVertical: 15, width: '100%', maxWidth: 360, marginTop: 28 },
  btnIniciarDesativado: { backgroundColor: '#3a3220' },
  btnIniciarTexto: { color: '#1a1200', fontWeight: '900', fontSize: 14, letterSpacing: 1, textAlign: 'center' },
  btnEvolucao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: '#FFB300', borderRadius: 14, paddingVertical: 13, width: '100%', maxWidth: 360, marginTop: 12 },
  btnEvolucaoTexto: { color: '#FFB300', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  btnVoltar: { marginTop: 16, padding: 10 },
  btnVoltarTexto: { color: '#776', fontWeight: '700', fontSize: 12 },

  jogoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10 },
  progresso: { color: '#CCB', fontSize: 15, fontWeight: '800' },
  cronometro: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cronometroTexto: { color: '#7FD4FF', fontSize: 14, fontWeight: '800' },
  areaConta: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  conta: { color: '#FFF', fontSize: 56, fontWeight: '900', letterSpacing: 2 },
  caixaResposta: { marginTop: 22, minWidth: 140, borderBottomWidth: 3, borderBottomColor: '#FFB300', paddingHorizontal: 18, paddingVertical: 6, alignItems: 'center' },
  caixaAcerto: { borderBottomColor: '#32CD32' },
  caixaErro: { borderBottomColor: '#FF7055' },
  respostaTexto: { color: '#FFB300', fontSize: 42, fontWeight: '900', minHeight: 52 },
  feedbackAcerto: { color: '#32CD32', fontSize: 20, fontWeight: '900', marginTop: 18 },
  feedbackErro: { color: '#FF7055', fontSize: 20, fontWeight: '900', marginTop: 18 },

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
  resumoCardTexto: { color: '#DDC', fontSize: 12, fontWeight: '600', marginTop: 4 },
  resumoPontuacaoFinal: { color: '#FFD700', fontSize: 30, fontWeight: '900' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badgeTabuada: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeTabuadaTexto: { fontWeight: '900', fontSize: 14 },
});
