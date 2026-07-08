import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as api from '../src/services/api';
import { FlashcardPersonalizado, JogoPersonalizado, formatarTempoPreciso } from '../src/services/leitner';

// =============================================================================
// MEUS FLASH CARDS — área de Jogos Personalizados. Cada jogo tem nome próprio
// (ex: "MMC", "Frações") e guarda seus flash cards separados dos demais jogos
// e da Trilha da Tabuada principal (que só usa cards "soltos", sem jogoId — ver
// server.py). Dentro de um jogo: criar/editar cards (conta ou pergunta escrita,
// com dica e opções opcionais) e iniciar um treino que embaralha e pergunta só
// os cards daquele jogo, sem misturar com mais nada.
// =============================================================================

type Visao = 'jogos' | 'cards' | 'jogando' | 'resumo';

const TECLAS: string[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['apagar', '0', 'ok']];

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export default function MeusFlashcards() {
  const router = useRouter();
  const [visao, setVisao] = useState<Visao>('jogos');

  // ----- Lista de jogos personalizados -----
  const [jogos, setJogos] = useState<JogoPersonalizado[]>([]);
  const [carregandoJogos, setCarregandoJogos] = useState(true);
  const [criandoJogo, setCriandoJogo] = useState(false);
  const [nomeNovoJogo, setNomeNovoJogo] = useState('');
  const [salvandoJogo, setSalvandoJogo] = useState(false);

  // ----- Jogo aberto no momento + seus cards -----
  const [jogoAtual, setJogoAtual] = useState<JogoPersonalizado | null>(null);
  const [lista, setLista] = useState<FlashcardPersonalizado[]>([]);
  const [carregandoCards, setCarregandoCards] = useState(false);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [tipo, setTipo] = useState<'CONTA' | 'TEXTO'>('CONTA');
  const [enunciado, setEnunciado] = useState('');
  const [respostaCorreta, setRespostaCorreta] = useState('');
  const [dica, setDica] = useState('');
  const [opcoes, setOpcoes] = useState(['', '', '', '']);

  // ----- Treino (quiz embaralhado com os cards do jogo aberto) -----
  const [filaJogo, setFilaJogo] = useState<FlashcardPersonalizado[]>([]);
  const [indiceJogo, setIndiceJogo] = useState(0);
  const [respostaJogo, setRespostaJogo] = useState('');
  const [feedbackJogo, setFeedbackJogo] = useState<{ acertou: boolean; correta: number } | null>(null);
  const [dicaReveladaJogo, setDicaReveladaJogo] = useState(false);
  const [opcoesReveladasJogo, setOpcoesReveladasJogo] = useState(false);
  const [opcoesEmbaralhadasJogo, setOpcoesEmbaralhadasJogo] = useState<number[]>([]);
  const acertosJogoRef = useRef(0);
  const errosJogoRef = useRef(0);
  const tempoTotalJogoRef = useRef(0);
  const perguntaIniciadaEmJogo = useRef(0);
  const respondendoJogoRef = useRef(false);
  const stateJogoRef = useRef({ indiceJogo, feedbackJogo, respostaJogo });
  stateJogoRef.current = { indiceJogo, feedbackJogo, respostaJogo };
  const filaJogoRef = useRef(filaJogo);
  filaJogoRef.current = filaJogo;

  // ----- Carregamento -----
  const carregarJogos = useCallback(async () => {
    setCarregandoJogos(true);
    const dados = await api.getTabuadaJogos();
    setJogos(Array.isArray(dados) ? dados : []);
    setCarregandoJogos(false);
  }, []);

  const carregarCards = useCallback(async (jogoId: string) => {
    setCarregandoCards(true);
    const dados = await api.getTabuadaFlashcards(jogoId);
    setLista(Array.isArray(dados) ? dados : []);
    setCarregandoCards(false);
  }, []);

  // Cobre a carga inicial, a troca de visão/jogo e o retorno de outra tela — sem duplicar fetch.
  useFocusEffect(useCallback(() => {
    if (visao === 'jogos') carregarJogos();
    else if (visao === 'cards' && jogoAtual) carregarCards(jogoAtual.id);
  }, [visao, jogoAtual, carregarJogos, carregarCards]));

  // ----- Navegação entre jogos -----
  const abrirJogo = (jogo: JogoPersonalizado) => {
    setJogoAtual(jogo);
    setCriando(false);
    setVisao('cards');
  };

  const criarJogo = async () => {
    const nome = nomeNovoJogo.trim();
    if (!nome) {
      Alert.alert('Dê um nome', 'Escreva um nome pro jogo, tipo "MMC" ou "Frações".');
      return;
    }
    setSalvandoJogo(true);
    try {
      const novo = await api.criarTabuadaJogo(nome);
      setNomeNovoJogo('');
      setCriandoJogo(false);
      setJogos(prev => [novo, ...prev]);
      abrirJogo(novo);
    } catch {
      Alert.alert('Não deu certo', 'Não foi possível criar o jogo agora. Tente de novo.');
    }
    setSalvandoJogo(false);
  };

  const excluirJogo = (jogo: JogoPersonalizado) => {
    Alert.alert('Excluir jogo?', `"${jogo.nome}" e todos os seus flash cards vão ser apagados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          setJogos(prev => prev.filter(j => j.id !== jogo.id));
          try { await api.deletarTabuadaJogo(jogo.id); } catch { await carregarJogos(); }
        },
      },
    ]);
  };

  // ----- Form de criar/editar card (dentro de um jogo) -----
  const limparForm = () => {
    setTipo('CONTA');
    setEnunciado('');
    setRespostaCorreta('');
    setDica('');
    setOpcoes(['', '', '', '']);
  };

  const abrirCriacao = () => {
    limparForm();
    setEditandoId(null);
    setCriando(v => !v);
  };

  const abrirEdicao = (fc: FlashcardPersonalizado) => {
    setTipo(fc.tipo);
    setEnunciado(fc.enunciado);
    setRespostaCorreta(String(fc.respostaCorreta));
    setDica(fc.dica ?? '');
    const jaTinha = fc.opcoes ?? [];
    setOpcoes([0, 1, 2, 3].map(i => (jaTinha[i] != null ? String(jaTinha[i]) : '')));
    setEditandoId(fc.id);
    setCriando(true);
  };

  const alternarExpandido = (id: string) => {
    setExpandidos(prev => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const salvar = async () => {
    if (!jogoAtual) return;
    const enunciadoLimpo = enunciado.trim();
    const correta = parseInt(respostaCorreta, 10);
    if (!enunciadoLimpo) {
      Alert.alert('Faltou a pergunta', 'Escreva a conta ou a pergunta do flash card.');
      return;
    }
    if (isNaN(correta)) {
      Alert.alert('Resposta inválida', 'A resposta correta precisa ser um número.');
      return;
    }
    const opcoesNumeros = opcoes.map(o => parseInt(o, 10)).filter(n => !isNaN(n));
    if (opcoesNumeros.length > 0 && !opcoesNumeros.includes(correta)) {
      opcoesNumeros.push(correta);
    }
    const payload = {
      tipo,
      enunciado: enunciadoLimpo,
      respostaCorreta: correta,
      dica: dica.trim() || null,
      opcoes: opcoesNumeros.length > 0 ? opcoesNumeros : null,
      jogoId: jogoAtual.id,
    };

    setSalvando(true);
    try {
      if (editandoId) await api.atualizarTabuadaFlashcard(editandoId, payload);
      else await api.criarTabuadaFlashcard(payload);
      const eraEdicao = !!editandoId;
      limparForm();
      setCriando(false);
      setEditandoId(null);
      await carregarCards(jogoAtual.id);
      if (!eraEdicao) setJogos(prev => prev.map(j => j.id === jogoAtual.id ? { ...j, quantidadeCards: j.quantidadeCards + 1 } : j));
    } catch {
      Alert.alert('Não deu certo', 'Não foi possível salvar agora. Tente de novo.');
    }
    setSalvando(false);
  };

  const excluir = (fc: FlashcardPersonalizado) => {
    Alert.alert('Excluir flash card?', `"${fc.enunciado}" vai ser removido deste jogo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          setLista(prev => prev.filter(x => x.id !== fc.id));
          if (jogoAtual) setJogos(prev => prev.map(j => j.id === jogoAtual.id ? { ...j, quantidadeCards: Math.max(0, j.quantidadeCards - 1) } : j));
          try { await api.deletarTabuadaFlashcard(fc.id); } catch { if (jogoAtual) await carregarCards(jogoAtual.id); }
        },
      },
    ]);
  };

  // ----- Treino: embaralha os cards do jogo aberto e pergunta um a um -----
  const iniciarTreinoJogo = () => {
    if (lista.length === 0) return;
    acertosJogoRef.current = 0;
    errosJogoRef.current = 0;
    tempoTotalJogoRef.current = 0;
    respondendoJogoRef.current = false;
    const embaralhada = embaralhar(lista);
    setFilaJogo(embaralhada);
    setIndiceJogo(0);
    setRespostaJogo('');
    setFeedbackJogo(null);
    setDicaReveladaJogo(false);
    setOpcoesReveladasJogo(false);
    setOpcoesEmbaralhadasJogo(embaralhada[0]?.opcoes ? embaralhar(embaralhada[0].opcoes) : []);
    perguntaIniciadaEmJogo.current = Date.now();
    setVisao('jogando');
  };

  const registrarRespostaJogo = (respostaStr: string) => {
    if (respondendoJogoRef.current) return;
    const item = filaJogoRef.current[stateJogoRef.current.indiceJogo];
    if (!item) return;
    respondendoJogoRef.current = true;

    const tempo = (Date.now() - perguntaIniciadaEmJogo.current) / 1000;
    tempoTotalJogoRef.current += tempo;
    const dada = parseInt(respostaStr, 10);
    const acertou = dada === item.respostaCorreta;
    if (acertou) acertosJogoRef.current += 1; else errosJogoRef.current += 1;

    setFeedbackJogo({ acertou, correta: item.respostaCorreta });

    setTimeout(() => {
      setFeedbackJogo(null);
      setRespostaJogo('');
      respondendoJogoRef.current = false;
      const proximo = stateJogoRef.current.indiceJogo + 1;
      if (proximo >= filaJogoRef.current.length) {
        setVisao('resumo');
      } else {
        const prox = filaJogoRef.current[proximo];
        setIndiceJogo(proximo);
        setDicaReveladaJogo(false);
        setOpcoesReveladasJogo(false);
        setOpcoesEmbaralhadasJogo(prox?.opcoes ? embaralhar(prox.opcoes) : []);
        perguntaIniciadaEmJogo.current = Date.now();
      }
    }, acertou ? 1100 : 2000);
  };

  const confirmarRespostaJogo = () => {
    if (stateJogoRef.current.respostaJogo === '') return;
    registrarRespostaJogo(stateJogoRef.current.respostaJogo);
  };

  const escolherOpcaoJogo = (valor: number) => registrarRespostaJogo(String(valor));

  const apertarTeclaJogo = (valor: string) => {
    if (stateJogoRef.current.feedbackJogo) return;
    if (valor === 'apagar') setRespostaJogo(r => r.slice(0, -1));
    else if (valor === 'ok') confirmarRespostaJogo();
    else setRespostaJogo(r => (r.length < 3 ? r + valor : r));
  };

  // ----- Teclado físico (web) -----
  useEffect(() => {
    if (Platform.OS !== 'web' || visao !== 'jogando') return;
    const onKey = (e: any) => {
      if (e.key >= '0' && e.key <= '9') apertarTeclaJogo(e.key);
      else if (e.key === 'Backspace') apertarTeclaJogo('apagar');
      else if (e.key === 'Enter') apertarTeclaJogo('ok');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visao, indiceJogo, filaJogo]);

  // ============================ TELAS ============================

  // ----- VISÃO: JOGANDO (quiz do jogo aberto) -----
  if (visao === 'jogando') {
    const item = filaJogo[indiceJogo];
    if (!item) return null;
    const temDica = !!item.dica;
    const temOpcoes = !!(item.opcoes && item.opcoes.length > 0);
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.jogoTopo}>
          <TouchableOpacity onPress={() => setVisao('cards')}>
            <Ionicons name="close" size={26} color="#888" />
          </TouchableOpacity>
          <Text style={styles.progresso}>{Math.min(indiceJogo + 1, filaJogo.length)} / {filaJogo.length}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.areaConta}>
          {item.tipo === 'TEXTO' ? (
            <Text style={styles.contaTexto}>{item.enunciado}</Text>
          ) : (
            <Text style={styles.conta}>{item.enunciado}</Text>
          )}

          <View style={[styles.caixaResposta, feedbackJogo && (feedbackJogo.acertou ? styles.caixaAcerto : styles.caixaErro)]}>
            <Text style={styles.respostaTexto}>{respostaJogo || ' '}</Text>
          </View>

          {!feedbackJogo && (temDica || temOpcoes) && (
            <View style={styles.ajudaRow}>
              {temDica && !dicaReveladaJogo && (
                <TouchableOpacity style={styles.btnAjuda} onPress={() => setDicaReveladaJogo(true)}>
                  <Ionicons name="bulb-outline" size={13} color="#FFD700" />
                  <Text style={styles.btnAjudaTexto}>Ver dica</Text>
                </TouchableOpacity>
              )}
              {temOpcoes && !opcoesReveladasJogo && (
                <TouchableOpacity style={styles.btnAjuda} onPress={() => setOpcoesReveladasJogo(true)}>
                  <Ionicons name="list-outline" size={13} color="#7FD4FF" />
                  <Text style={styles.btnAjudaTexto}>Ver opções</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {!feedbackJogo && dicaReveladaJogo && item.dica && (
            <View style={styles.dicaBox}>
              <Ionicons name="bulb" size={13} color="#FFD700" />
              <Text style={styles.dicaTexto}>{item.dica}</Text>
            </View>
          )}

          {!feedbackJogo && opcoesReveladasJogo && opcoesEmbaralhadasJogo.length > 0 && (
            <View style={styles.opcoesRow}>
              {opcoesEmbaralhadasJogo.map((op, i) => (
                <TouchableOpacity key={i} style={styles.opcaoBtn} onPress={() => escolherOpcaoJogo(op)}>
                  <Text style={styles.opcaoBtnTexto}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {feedbackJogo && (
            <Text style={feedbackJogo.acertou ? styles.feedbackAcerto : styles.feedbackErro}>
              {feedbackJogo.acertou ? '✓ Certo!' : `✗ Era ${feedbackJogo.correta}`}
            </Text>
          )}
        </View>

        <View style={styles.teclado}>
          {TECLAS.map((linha, i) => (
            <View key={i} style={styles.tecladoLinha}>
              {linha.map(tecla => (
                <TouchableOpacity
                  key={tecla}
                  style={[styles.tecla, tecla === 'ok' && styles.teclaOk, tecla === 'apagar' && styles.teclaApagar]}
                  onPress={() => apertarTeclaJogo(tecla)}
                  disabled={!!feedbackJogo}
                >
                  {tecla === 'apagar' ? <Ionicons name="backspace" size={22} color="#FFF" />
                    : tecla === 'ok' ? <Ionicons name="checkmark" size={24} color="#04141a" />
                    : <Text style={styles.teclaTexto}>{tecla}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // ----- VISÃO: RESUMO do treino -----
  if (visao === 'resumo') {
    const total = acertosJogoRef.current + errosJogoRef.current;
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.resumoScroll}>
          <Ionicons name={acertosJogoRef.current >= errosJogoRef.current ? 'trophy' : 'fitness'} size={56} color="#7FD4FF" style={{ marginTop: 16 }} />
          <Text style={styles.resumoTitulo}>Treino concluído!</Text>
          <Text style={styles.resumoSubtitulo}>{jogoAtual?.nome}</Text>

          <View style={styles.resumoGrid}>
            <View style={styles.resumoBox}><Text style={[styles.resumoValor, { color: '#32CD32' }]}>{acertosJogoRef.current}/{total}</Text><Text style={styles.resumoLabel}>Acertos</Text></View>
            <View style={styles.resumoBox}><Text style={styles.resumoValorTempo}>{formatarTempoPreciso(tempoTotalJogoRef.current)}</Text><Text style={styles.resumoLabel}>Tempo total</Text></View>
          </View>

          <TouchableOpacity style={styles.btnPrimario} onPress={iniciarTreinoJogo}>
            <Ionicons name="refresh" size={20} color="#04141a" />
            <Text style={styles.btnPrimarioTexto}>JOGAR DE NOVO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecundario} onPress={() => setVisao('cards')}>
            <Text style={styles.btnSecundarioTexto}>VOLTAR AOS CARDS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnVoltar} onPress={() => setVisao('jogos')}>
            <Text style={styles.btnVoltarTexto}>VOLTAR AOS JOGOS</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- VISÃO: CARDS de um jogo -----
  if (visao === 'cards' && jogoAtual) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setVisao('jogos')}>
            <Ionicons name="arrow-back" size={26} color="#7FD4FF" />
          </TouchableOpacity>
          <Text style={styles.headerTitulo} numberOfLines={1}>{jogoAtual.nome}</Text>
          <TouchableOpacity onPress={abrirCriacao}>
            <Ionicons name={criando ? 'close' : 'add-circle'} size={28} color="#7FD4FF" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <TouchableOpacity
              style={[styles.btnIniciarTreino, lista.length === 0 && styles.btnDesativado]}
              disabled={lista.length === 0}
              onPress={iniciarTreinoJogo}
            >
              <Ionicons name="play" size={18} color="#04141a" />
              <Text style={styles.btnIniciarTreinoTexto}>
                {lista.length === 0 ? 'CRIE AO MENOS 1 CARD PRA TREINAR' : `INICIAR TREINO (${lista.length} cards)`}
              </Text>
            </TouchableOpacity>

            {criando && (
              <View style={styles.formCard}>
                <Text style={styles.formTitulo}>{editandoId ? 'Editar flash card' : 'Novo flash card'}</Text>

                <View style={styles.tipoRow}>
                  <TouchableOpacity style={[styles.tipoChip, tipo === 'CONTA' && styles.tipoChipAtivo]} onPress={() => setTipo('CONTA')}>
                    <Text style={[styles.tipoChipTexto, tipo === 'CONTA' && styles.tipoChipTextoAtivo]}>Conta matemática</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tipoChip, tipo === 'TEXTO' && styles.tipoChipAtivo]} onPress={() => setTipo('TEXTO')}>
                    <Text style={[styles.tipoChipTexto, tipo === 'TEXTO' && styles.tipoChipTextoAtivo]}>Pergunta escrita</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.rotulo}>{tipo === 'CONTA' ? 'Conta' : 'Pergunta'}</Text>
                <TextInput
                  style={styles.input}
                  value={enunciado}
                  onChangeText={setEnunciado}
                  placeholder={tipo === 'CONTA' ? 'Ex: 7 x 8' : 'Ex: Qual o MMC de 4 e 6?'}
                  placeholderTextColor="#556"
                />

                <Text style={styles.rotulo}>Resposta correta</Text>
                <TextInput
                  style={styles.input}
                  value={respostaCorreta}
                  onChangeText={setRespostaCorreta}
                  placeholder="Ex: 12"
                  placeholderTextColor="#556"
                  keyboardType="numeric"
                />

                <Text style={styles.rotulo}>Dica (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={dica}
                  onChangeText={setDica}
                  placeholder="Ex: Liste os múltiplos dos dois números"
                  placeholderTextColor="#556"
                />

                <Text style={styles.rotulo}>Alternativas (opcional, 3 ou 4 números)</Text>
                <View style={styles.opcoesFormRow}>
                  {opcoes.map((valor, i) => (
                    <TextInput
                      key={i}
                      style={styles.inputOpcao}
                      value={valor}
                      onChangeText={(t) => setOpcoes(prev => prev.map((p, j) => j === i ? t : p))}
                      placeholder="—"
                      placeholderTextColor="#556"
                      keyboardType="numeric"
                    />
                  ))}
                </View>

                <TouchableOpacity style={styles.btnSalvar} onPress={salvar} disabled={salvando}>
                  {salvando ? <ActivityIndicator size="small" color="#04141a" /> : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#04141a" />
                      <Text style={styles.btnSalvarTexto}>{editandoId ? 'SALVAR ALTERAÇÕES' : 'SALVAR FLASH CARD'}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {carregandoCards ? (
              <ActivityIndicator size="large" color="#7FD4FF" style={{ marginTop: 40 }} />
            ) : lista.length === 0 ? (
              <View style={styles.vazio}>
                <Ionicons name="create-outline" size={44} color="#556" />
                <Text style={styles.vazioTexto}>Este jogo ainda não tem flash cards. Toque no + para criar o primeiro!</Text>
              </View>
            ) : (
              lista.map(fc => {
                const expandido = expandidos.has(fc.id);
                return (
                  <TouchableOpacity
                    key={fc.id}
                    style={styles.itemCard}
                    onPress={() => alternarExpandido(fc.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.itemTopo}>
                      <View style={[styles.itemBadge, fc.tipo === 'TEXTO' && styles.itemBadgeTipoTexto]}>
                        <Text style={styles.itemBadgeLabel}>{fc.tipo === 'CONTA' ? 'Conta' : 'Texto'}</Text>
                      </View>
                      <View style={styles.itemAcoes}>
                        <TouchableOpacity style={styles.itemBtnIcone} onPress={() => abrirEdicao(fc)}>
                          <Ionicons name="pencil" size={13} color="#7FD4FF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.itemBtnIcone} onPress={() => excluir(fc)}>
                          <Ionicons name="trash-outline" size={15} color="#FF7055" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={styles.itemEnunciado}>{fc.enunciado}</Text>
                    {expandido ? (
                      <View style={styles.itemDetalhe}>
                        <Text style={styles.itemResposta}>Resposta: {fc.respostaCorreta}</Text>
                        {fc.dica ? <Text style={styles.itemDica}>💡 {fc.dica}</Text> : null}
                        {fc.opcoes && fc.opcoes.length > 0 ? (
                          <Text style={styles.itemOpcoes}>Opções: {fc.opcoes.join(', ')}</Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.itemToque}>Toque para ver a resposta</Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ----- VISÃO: LISTA DE JOGOS (tela inicial) -----
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#7FD4FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Meus Flash Cards</Text>
        <TouchableOpacity onPress={() => setCriandoJogo(v => !v)}>
          <Ionicons name={criandoJogo ? 'close' : 'add-circle'} size={28} color="#7FD4FF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.explicacaoJogos}>
            Crie jogos personalizados sobre qualquer assunto — MMC, frações, o que quiser — e
            adicione seus próprios flash cards em cada um. Cada jogo treina separado dos demais.
          </Text>

          {criandoJogo && (
            <View style={styles.formCard}>
              <Text style={styles.formTitulo}>Novo jogo</Text>
              <Text style={styles.rotulo}>Nome do jogo</Text>
              <TextInput
                style={styles.input}
                value={nomeNovoJogo}
                onChangeText={setNomeNovoJogo}
                placeholder="Ex: MMC, Frações, Verbos..."
                placeholderTextColor="#556"
              />
              <TouchableOpacity style={styles.btnSalvar} onPress={criarJogo} disabled={salvandoJogo}>
                {salvandoJogo ? <ActivityIndicator size="small" color="#04141a" /> : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#04141a" />
                    <Text style={styles.btnSalvarTexto}>CRIAR JOGO</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {carregandoJogos ? (
            <ActivityIndicator size="large" color="#7FD4FF" style={{ marginTop: 40 }} />
          ) : jogos.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="game-controller-outline" size={44} color="#556" />
              <Text style={styles.vazioTexto}>Você ainda não criou nenhum jogo personalizado. Toque no + para criar o primeiro!</Text>
            </View>
          ) : (
            jogos.map(jogo => (
              <TouchableOpacity key={jogo.id} style={styles.jogoCard} onPress={() => abrirJogo(jogo)} activeOpacity={0.8}>
                <View style={styles.jogoCardIcone}>
                  <Ionicons name="game-controller" size={22} color="#7FD4FF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jogoCardNome}>{jogo.nome}</Text>
                  <Text style={styles.jogoCardQtd}>{jogo.quantidadeCards} flash card{jogo.quantidadeCards !== 1 ? 's' : ''}</Text>
                </View>
                <TouchableOpacity style={styles.itemBtnIcone} onPress={() => excluirJogo(jogo)}>
                  <Ionicons name="trash-outline" size={16} color="#FF7055" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color="#556" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b04' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1c2430' },
  headerTitulo: { color: '#FFF', fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { padding: 18, paddingBottom: 50 },

  explicacaoJogos: { color: '#889', fontSize: 12, lineHeight: 18, marginBottom: 16 },

  jogoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#14142e', borderRadius: 14, borderWidth: 1, borderColor: '#26264a', padding: 14, marginBottom: 12 },
  jogoCardIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0f1622', alignItems: 'center', justifyContent: 'center' },
  jogoCardNome: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  jogoCardQtd: { color: '#778', fontSize: 11, marginTop: 2 },

  btnIniciarTreino: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7FD4FF', borderRadius: 14, paddingVertical: 14, marginBottom: 18 },
  btnIniciarTreinoTexto: { color: '#04141a', fontWeight: '900', fontSize: 13, letterSpacing: 0.5, textAlign: 'center' },
  btnDesativado: { backgroundColor: '#243040' },

  formCard: { backgroundColor: '#0f1622', borderRadius: 16, borderWidth: 1, borderColor: '#1c3040', padding: 16, marginBottom: 20 },
  formTitulo: { color: '#7FD4FF', fontSize: 14, fontWeight: '900', marginBottom: 12 },
  tipoRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tipoChip: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#132030', borderWidth: 1, borderColor: '#1c3040', alignItems: 'center' },
  tipoChipAtivo: { backgroundColor: '#7FD4FF', borderColor: '#7FD4FF' },
  tipoChipTexto: { color: '#8AB', fontWeight: '700', fontSize: 12 },
  tipoChipTextoAtivo: { color: '#04141a' },
  rotulo: { color: '#889', fontSize: 11, marginBottom: 5, marginTop: 4 },
  input: { backgroundColor: '#132030', borderRadius: 10, borderWidth: 1, borderColor: '#1c3040', color: '#FFF', paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 6 },
  opcoesFormRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  inputOpcao: { flex: 1, backgroundColor: '#132030', borderRadius: 10, borderWidth: 1, borderColor: '#1c3040', color: '#FFF', paddingHorizontal: 10, paddingVertical: 11, fontSize: 14, textAlign: 'center' },
  btnSalvar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7FD4FF', borderRadius: 12, paddingVertical: 13, marginTop: 12 },
  btnSalvarTexto: { color: '#04141a', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  vazio: { alignItems: 'center', padding: 40, gap: 14 },
  vazioTexto: { color: '#667', fontSize: 13, textAlign: 'center', lineHeight: 20 },

  itemCard: { backgroundColor: '#14142e', borderRadius: 14, borderWidth: 1, borderColor: '#26264a', padding: 14, marginBottom: 12 },
  itemTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: '#1c3040' },
  itemBadgeTipoTexto: { backgroundColor: '#2a1e40' },
  itemBadgeLabel: { color: '#7FD4FF', fontSize: 10, fontWeight: '800' },
  itemAcoes: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemBtnIcone: { padding: 4 },
  itemEnunciado: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  itemToque: { color: '#556', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  itemDetalhe: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1e1e3a' },
  itemResposta: { color: '#32CD32', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  itemDica: { color: '#FFD700', fontSize: 12, marginTop: 2 },
  itemOpcoes: { color: '#889', fontSize: 12, marginTop: 2 },

  // ----- Quiz (jogando) -----
  jogoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10 },
  progresso: { color: '#CCB', fontSize: 15, fontWeight: '800' },
  areaConta: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  conta: { color: '#FFF', fontSize: 48, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  contaTexto: { color: '#FFF', fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  caixaResposta: { marginTop: 22, minWidth: 140, borderBottomWidth: 3, borderBottomColor: '#7FD4FF', paddingHorizontal: 18, paddingVertical: 6, alignItems: 'center' },
  caixaAcerto: { borderBottomColor: '#32CD32' },
  caixaErro: { borderBottomColor: '#FF7055' },
  respostaTexto: { color: '#7FD4FF', fontSize: 42, fontWeight: '900', minHeight: 52 },
  feedbackAcerto: { color: '#32CD32', fontSize: 20, fontWeight: '900', marginTop: 18 },
  feedbackErro: { color: '#FF7055', fontSize: 20, fontWeight: '900', marginTop: 18 },

  ajudaRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btnAjuda: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#132030', borderWidth: 1, borderColor: '#1c3040' },
  btnAjudaTexto: { color: '#AA9', fontSize: 11, fontWeight: '700' },
  dicaBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, maxWidth: 300, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#1e1a08', borderWidth: 1, borderColor: '#443a10' },
  dicaTexto: { color: '#FFD700', fontSize: 12, fontWeight: '600', flex: 1 },
  opcoesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center', maxWidth: 320 },
  opcaoBtn: { minWidth: 56, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#132030', borderWidth: 1, borderColor: '#7FD4FF', alignItems: 'center' },
  opcaoBtnTexto: { color: '#7FD4FF', fontSize: 16, fontWeight: '800' },

  teclado: { paddingHorizontal: 24, paddingBottom: 18, gap: 10, alignSelf: 'center', width: '100%', maxWidth: 380 },
  tecladoLinha: { flexDirection: 'row', gap: 10 },
  tecla: { flex: 1, height: 58, borderRadius: 12, backgroundColor: '#132030', borderWidth: 1, borderColor: '#1c3040', alignItems: 'center', justifyContent: 'center' },
  teclaOk: { backgroundColor: '#7FD4FF', borderColor: '#7FD4FF' },
  teclaApagar: { backgroundColor: '#2a1410', borderColor: '#442018' },
  teclaTexto: { color: '#FFF', fontSize: 24, fontWeight: '800' },

  // ----- Resumo do treino -----
  resumoScroll: { padding: 20, alignItems: 'center', paddingBottom: 50 },
  resumoTitulo: { color: '#FFF', fontSize: 24, fontWeight: '900', marginTop: 10 },
  resumoSubtitulo: { color: '#7FD4FF', fontSize: 14, fontWeight: '700', marginTop: 4 },
  resumoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20, justifyContent: 'center' },
  resumoBox: { backgroundColor: '#14142e', borderRadius: 12, borderWidth: 1, borderColor: '#26264a', paddingVertical: 12, alignItems: 'center', width: '46%', maxWidth: 170 },
  resumoValor: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  resumoValorTempo: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  resumoLabel: { color: '#887', fontSize: 11, marginTop: 2 },
  btnPrimario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7FD4FF', borderRadius: 14, paddingVertical: 15, width: '100%', maxWidth: 360, marginTop: 28 },
  btnPrimarioTexto: { color: '#04141a', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  btnSecundario: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: '#7FD4FF', borderRadius: 14, paddingVertical: 13, width: '100%', maxWidth: 360, marginTop: 12 },
  btnSecundarioTexto: { color: '#7FD4FF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  btnVoltar: { marginTop: 16, padding: 10 },
  btnVoltarTexto: { color: '#776', fontWeight: '700', fontSize: 12 },
});
