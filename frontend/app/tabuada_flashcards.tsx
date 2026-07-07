import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../src/services/api';
import { FlashcardPersonalizado } from '../src/services/leitner';

// =============================================================================
// MEUS FLASH CARDS — o aluno cria seus próprios cards para treinar na Trilha da
// Tabuada. Contas matemáticas (7 x 8, 12 ÷ 3...) usam o mesmo visual grande dos
// cards fixos; perguntas escritas (Qual é o dobro de 8?) usam um visual de texto.
// Dica e opções são sempre opcionais, e viram os botões discretos "Ver dica" e
// "Ver opções" durante o jogo.
// =============================================================================

export default function MeusFlashcards() {
  const router = useRouter();
  const [lista, setLista] = useState<FlashcardPersonalizado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  const [tipo, setTipo] = useState<'CONTA' | 'TEXTO'>('CONTA');
  const [enunciado, setEnunciado] = useState('');
  const [respostaCorreta, setRespostaCorreta] = useState('');
  const [dica, setDica] = useState('');
  const [opcoes, setOpcoes] = useState(['', '', '', '']);

  const carregar = async () => {
    setCarregando(true);
    const dados = await api.getTabuadaFlashcards();
    setLista(Array.isArray(dados) ? dados : []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, []);

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
    };

    setSalvando(true);
    try {
      if (editandoId) await api.atualizarTabuadaFlashcard(editandoId, payload);
      else await api.criarTabuadaFlashcard(payload);
      limparForm();
      setCriando(false);
      setEditandoId(null);
      await carregar();
    } catch {
      Alert.alert('Não deu certo', 'Não foi possível salvar agora. Tente de novo.');
    }
    setSalvando(false);
  };

  const excluir = (fc: FlashcardPersonalizado) => {
    Alert.alert('Excluir flash card?', `"${fc.enunciado}" vai ser removido da sua trilha.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          setLista(prev => prev.filter(x => x.id !== fc.id));
          try { await api.deletarTabuadaFlashcard(fc.id); } catch { await carregar(); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#7FD4FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitulo}>Meus Flash Cards</Text>
        <TouchableOpacity onPress={abrirCriacao}>
          <Ionicons name={criando ? 'close' : 'add-circle'} size={28} color="#7FD4FF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
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
                placeholder={tipo === 'CONTA' ? 'Ex: 7 x 8' : 'Ex: Qual é o dobro de 8?'}
                placeholderTextColor="#556"
              />

              <Text style={styles.rotulo}>Resposta correta</Text>
              <TextInput
                style={styles.input}
                value={respostaCorreta}
                onChangeText={setRespostaCorreta}
                placeholder="Ex: 16"
                placeholderTextColor="#556"
                keyboardType="numeric"
              />

              <Text style={styles.rotulo}>Dica (opcional)</Text>
              <TextInput
                style={styles.input}
                value={dica}
                onChangeText={setDica}
                placeholder="Ex: Some 8 + 8"
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

          {carregando ? (
            <ActivityIndicator size="large" color="#7FD4FF" style={{ marginTop: 40 }} />
          ) : lista.length === 0 ? (
            <View style={styles.vazio}>
              <Ionicons name="create-outline" size={44} color="#556" />
              <Text style={styles.vazioTexto}>Você ainda não criou nenhum flash card. Toque no + para criar o primeiro!</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b04' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1c2430' },
  headerTitulo: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  scroll: { padding: 18, paddingBottom: 50 },

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
});
