import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api'; 

// Interfaces
interface Questao {
  id: string;
  texto: string;
  resposta: number;
}

interface Missao {
  id: string;
  titulo: string;
  alvoTipo: 'GERAL' | 'TURMA' | 'INDIVIDUAL';
  alvoNome: string;
  alvoId: string;
  questoes: Questao[];
  criadoEm?: string;
}

export default function GerenciarJogosAdmin() {
  const router = useRouter();
  
  // Estados de Dados
  const [listaTurmas, setListaTurmas] = useState<any[]>([]);
  const [listaAlunos, setListaAlunos] = useState<any[]>([]);
  const [missoes, setMissoes] = useState<Missao[]>([]);
  
  // Loadings
  const [loadingGeral, setLoadingGeral] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);

  // Estados do Modal de Criação
  const [modalVisivel, setModalVisivel] = useState(false);
  const [tituloMissao, setTituloMissao] = useState('');
  const [alvoTipo, setAlvoTipo] = useState<'GERAL' | 'TURMA' | 'INDIVIDUAL'>('GERAL');
  const [alvoSelecionado, setAlvoSelecionado] = useState<{id: string, nome: string} | null>(null);
  const [questoesTemporarias, setQuestoesTemporarias] = useState<Questao[]>([]);

  // Modais Auxiliares e Inputs
  const [modalSelecaoVisivel, setModalSelecaoVisivel] = useState(false);
  const [entradaConta, setEntradaConta] = useState('');
  const [entradaResposta, setEntradaResposta] = useState('');

  // 🔄 CARREGAR JOGOS EXISTENTES AO ABRIR A TELA
  useEffect(() => {
    carregarJogosAtivos();
  }, []);

  const carregarJogosAtivos = async () => {
    setLoadingGeral(true);
    try {
      // Tenta buscar do banco de dados (se a função existir no api.ts)
      // Se não existir, ele vai cair no catch e manter a lista vazia por segurança
      const jogos = await api.getJogosPersonalizados(); 
      if (jogos) setMissoes(jogos);
    } catch (error) {
      console.log('API getJogosPersonalizados não implementada ou erro de conexão');
    } finally {
      setLoadingGeral(false);
    }
  };

  // 🔄 CARREGAR ALUNOS/TURMAS AO ABRIR O MODAL DE CRIAÇÃO
  useEffect(() => {
    if (modalVisivel) {
      carregarDadosAlvos();
    }
  }, [modalVisivel]);

  const carregarDadosAlvos = async () => {
    setLoadingModal(true);
    try {
      const turmasData = await api.getTurmas(); 
      setListaTurmas(turmasData || []);

      const usuariosData = await api.getUsuarios(); 
      const apenasAlunos = usuariosData?.filter((u: any) => u.perfil === 'ALUNO') || [];
      setListaAlunos(apenasAlunos);
    } catch (error) {
      console.log('Erro ao carregar turmas/alunos:', error);
    } finally {
      setLoadingModal(false);
    }
  };

  const processarEAdicionarQuestao = () => {
    if (!entradaConta || !entradaResposta) {
      Alert.alert('Atenção', 'Preencha a conta e a resposta!');
      return;
    }

    let contaLimpa = entradaConta.replace(/\s+/g, '');
    let textoVisual = contaLimpa
      .replace(/\*/g, ' × ')
      .replace(/\//g, ' ÷ ');
    
    if (contaLimpa.includes('^')) {
      const partes = contaLimpa.split('^');
      const superscripts: {[key: string]: string} = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵' };
      if (partes[1] && superscripts[partes[1]]) {
        textoVisual = `${partes[0]}${superscripts[partes[1]]}`;
      }
    }

    const novaQuestao: Questao = {
      id: Math.random().toString(),
      texto: textoVisual,
      resposta: parseInt(entradaResposta)
    };

    setQuestoesTemporarias([...questoesTemporarias, novaQuestao]);
    setEntradaConta('');
    setEntradaResposta('');
  };

  const removerQuestao = (id: string) => {
    setQuestoesTemporarias(questoesTemporarias.filter(q => q.id !== id));
  };

  const salvarMissaoFinal = async () => {
    if (!tituloMissao || questoesTemporarias.length === 0) {
      Alert.alert('Erro', 'Preencha o título e adicione pelo menos uma questão!');
      return;
    }
    if (alvoTipo !== 'GERAL' && !alvoSelecionado) {
      Alert.alert('Erro', 'Selecione quem receberá o jogo (Turma ou Aluno)!');
      return;
    }

    const novaMissao = {
      titulo: tituloMissao,
      alvoTipo,
      alvoNome: alvoTipo === 'GERAL' ? 'Todos' : alvoSelecionado!.nome,
      alvoId: alvoTipo === 'GERAL' ? 'all' : alvoSelecionado!.id,
      questoes: questoesTemporarias,
      criadoEm: new Date().toISOString()
    };

    try {
      // 🚨 CHAMADA REAL PARA O BANCO DE DADOS
      // Se não tiver essa função no api.ts, adicione: 
      // export const criarJogo = (dados) => api.post('/jogos', dados);
      await api.criarJogo(novaMissao); 
      
      Alert.alert('Sucesso', 'Jogo publicado com sucesso!');
      fecharModalPrincipal();
      carregarJogosAtivos(); // Recarrega a lista
    } catch (error) {
      // Fallback: Salva localmente se a API falhar para você testar a interface
      console.log('Erro ao salvar no banco (API off), salvando localmente...');
      setMissoes([{ ...novaMissao, id: Math.random().toString() } as Missao, ...missoes]);
      fecharModalPrincipal();
    }
  };

  const fecharModalPrincipal = () => {
    setModalVisivel(false);
    setTituloMissao('');
    setAlvoTipo('GERAL');
    setAlvoSelecionado(null);
    setQuestoesTemporarias([]);
    setEntradaConta('');
    setEntradaResposta('');
  };

  const confirmarDeletarMissao = (id: string) => {
    Alert.alert('Apagar Jogo', 'Tem certeza? Isso removerá o jogo para todos os alunos.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
          try {
            await api.deletarJogo(id); // Chamada real para deletar
            carregarJogosAtivos();
          } catch (e) {
            // Fallback local
            setMissoes(prev => prev.filter(m => m.id !== id));
          }
        } 
      }
    ]);
  };

  const renderItemSelecao = ({ item }: any) => (
    <TouchableOpacity style={styles.itemSelecao} onPress={() => {
      setAlvoSelecionado({ id: item.id, nome: item.nome });
      setModalSelecaoVisivel(false);
    }}>
      <View>
        <Text style={styles.txtItemSelecaoNome}>{item.nome}</Text>
        {alvoTipo === 'INDIVIDUAL' && item.email && <Text style={styles.txtItemSelecaoInfo}>{item.email}</Text>}
        {alvoTipo === 'TURMA' && item.serie && <Text style={styles.txtItemSelecaoInfo}>{item.serie}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jogos Personalizados</Text>
      </View>

      {loadingGeral ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={{color: '#666', marginTop: 10}}>Carregando missões...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.btnCriarPrincipal} onPress={() => setModalVisivel(true)}>
            <Ionicons name="add-circle" size={26} color="#000" />
            <Text style={styles.txtBtnCriarPrincipal}>CRIAR NOVA MISSÃO</Text>
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>Missões Ativas ({missoes.length})</Text>

          {missoes.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="game-controller-outline" size={48} color="#333" />
              <Text style={styles.emptyText}>Nenhum jogo criado ainda.</Text>
            </View>
          )}

          {missoes.map(missao => (
            <View key={missao.id} style={styles.cardMissao}>
              <View style={styles.cardInfo}>
                <Text style={styles.missaoTituloCard}>{missao.titulo}</Text>
                <View style={styles.tagsRow}>
                  <View style={styles.tagTarget}>
                    <Ionicons name={missao.alvoTipo === 'INDIVIDUAL' ? "person" : missao.alvoTipo === 'TURMA' ? "people" : "globe"} size={14} color="#4169E1" />
                    <Text style={styles.tagTargetText} numberOfLines={1}>{missao.alvoNome}</Text>
                  </View>
                  <View style={styles.tagCount}>
                    <Ionicons name="list" size={14} color="#32CD32" />
                    <Text style={styles.tagCountText}>{missao.questoes.length} Questões</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.btnApagarCard} onPress={() => confirmarDeletarMissao(missao.id)}>
                <Ionicons name="trash" size={20} color="#FF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ==================== MODAL PRINCIPAL ==================== */}
      <Modal visible={modalVisivel} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalPrincipal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Construir Jogo</Text>
            <TouchableOpacity onPress={fecharModalPrincipal}>
              <Ionicons name="close" size={28} color="#FF4444" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>1. Título do Jogo:</Text>
            <TextInput 
              style={styles.inputSimplificado} 
              placeholder="Ex: Treino de Tabuada..." 
              placeholderTextColor="#555"
              value={tituloMissao}
              onChangeText={setTituloMissao}
            />

            <Text style={styles.fieldLabel}>2. Destinatário:</Text>
            <View style={styles.rowSegmented}>
              <TouchableOpacity 
                style={[styles.btnSegmented, alvoTipo === 'GERAL' && styles.btnSegmentedAtivo]}
                onPress={() => { setAlvoTipo('GERAL'); setAlvoSelecionado(null); }}
              >
                <Text style={[styles.txtSegmented, alvoTipo === 'GERAL' && { color: '#000' }]}>TODOS</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.btnSegmented, alvoTipo === 'TURMA' && styles.btnSegmentedAtivo]}
                onPress={() => { setAlvoTipo('TURMA'); setAlvoSelecionado(null); }}
              >
                <Text style={[styles.txtSegmented, alvoTipo === 'TURMA' && { color: '#000' }]}>TURMA</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.btnSegmented, alvoTipo === 'INDIVIDUAL' && styles.btnSegmentedAtivo]}
                onPress={() => { setAlvoTipo('INDIVIDUAL'); setAlvoSelecionado(null); }}
              >
                <Text style={[styles.txtSegmented, alvoTipo === 'INDIVIDUAL' && { color: '#000' }]}>ALUNO</Text>
              </TouchableOpacity>
            </View>

            {/* Seletor de Alvo */}
            {alvoTipo !== 'GERAL' && (
              <TouchableOpacity style={styles.seletorAlvo} onPress={() => setModalSelecaoVisivel(true)}>
                <Ionicons name={alvoTipo === 'TURMA' ? "people" : "person"} size={20} color="#888" />
                <Text style={[styles.txtSeletorAlvo, alvoSelecionado && { color: '#fff' }]}>
                  {alvoSelecionado ? alvoSelecionado.nome : (alvoTipo === 'TURMA' ? "Selecionar Turma..." : "Selecionar Aluno...")}
                </Text>
                <Ionicons name="search" size={20} color="#FFD700" />
              </TouchableOpacity>
            )}

            <View style={styles.divisorModal} />

            <Text style={styles.fieldLabel}>3. Adicionar Questões:</Text>
            
            {/* 🚨 CORREÇÃO LAYOUT VERTICAL: Campos empilhados para não vazar */}
            <View style={styles.painelEntradaRapida}>
              <Text style={styles.helperText}>Use * para multiplicar, / dividir, ^ potência</Text>
              
              <View style={styles.colunaInputs}>
                {/* CAMPO CONTA (LINHA 1) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.miniLabel}>Operação:</Text>
                  <TextInput 
                    style={styles.inputContaVertical} 
                    placeholder="Ex: 7 * 8" 
                    placeholderTextColor="#555"
                    value={entradaConta}
                    onChangeText={setEntradaConta}
                    autoCapitalize="none"
                  />
                </View>

                {/* CAMPO RESPOSTA (LINHA 2) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.miniLabel}>Resposta:</Text>
                  <TextInput 
                    style={styles.inputRespVertical} 
                    placeholder="Resultado (Ex: 56)" 
                    placeholderTextColor="#555"
                    keyboardType="numeric"
                    value={entradaResposta}
                    onChangeText={setEntradaResposta}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.btnConfirmarQuestao} onPress={processarEAdicionarQuestao}>
                <Ionicons name="arrow-down-circle" size={18} color="#000" />
                <Text style={styles.txtConfirmarQuestao}>Adicionar Questão na Lista</Text>
              </TouchableOpacity>
            </View>

            {/* Lista Visual */}
            {questoesTemporarias.map((q, i) => (
              <View key={q.id} style={styles.itemQuestaoVisual}>
                <View style={{flex: 1}}>
                  <Text style={styles.txtQuestaoLabel}>Questão {i + 1}</Text>
                  <Text style={styles.txtQuestaoVisual}>{q.texto}  =  <Text style={{color: '#32CD32'}}>{q.resposta}</Text></Text>
                </View>
                <TouchableOpacity onPress={() => removerQuestao(q.id)} style={{padding: 5}}>
                  <Ionicons name="trash-outline" size={22} color="#FF4444" />
                </TouchableOpacity>
              </View>
            ))}

            {questoesTemporarias.length > 0 && (
              <TouchableOpacity style={styles.btnPublicarFinal} onPress={salvarMissaoFinal}>
                <Ionicons name="cloud-upload" size={22} color="#000" />
                <Text style={styles.txtPublicarFinal}>PUBLICAR JOGO</Text>
              </TouchableOpacity>
            )}
            <View style={{height: 80}} /> 

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ==================== MODAL DE SELEÇÃO ==================== */}
      <Modal visible={modalSelecaoVisivel} animationType="fade" transparent={true}>
        <View style={styles.overlaySelecao}>
          <View style={styles.containerSelecao}>
            <View style={styles.headerSelecao}>
              <Text style={styles.titleSelecao}>
                {alvoTipo === 'TURMA' ? "Escolha a Turma" : "Escolha o Aluno"}
              </Text>
              <TouchableOpacity onPress={() => setModalSelecaoVisivel(false)}>
                <Ionicons name="close-circle" size={26} color="#FF4444" />
              </TouchableOpacity>
            </View>
            
            {loadingModal ? (
              <ActivityIndicator size="large" color="#FFD700" style={{marginTop: 50}} />
            ) : (
              <FlatList
                data={alvoTipo === 'TURMA' ? listaTurmas : listaAlunos}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItemSelecao}
                contentContainerStyle={{ padding: 15 }}
                ItemSeparatorComponent={() => <View style={{height: 1, backgroundColor: '#222'}} />}
                ListEmptyComponent={
                  <Text style={{color: '#666', textAlign: 'center', marginTop: 20}}>
                    Nenhuma {alvoTipo === 'TURMA' ? 'turma' : 'aluno'} encontrado.
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  backBtn: { marginRight: 15 },
  headerTitle: { color: '#FFD700', fontSize: 19, fontWeight: 'bold' },
  scrollContent: { padding: 16 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  
  btnCriarPrincipal: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 25 },
  txtBtnCriarPrincipal: { color: '#000', fontSize: 15, fontWeight: '900' },
  sectionLabel: { color: '#666', fontSize: 13, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', marginTop: 30, opacity: 0.5 },
  emptyText: { color: '#fff', marginTop: 10 },
  
  cardMissao: { backgroundColor: '#12121e', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  cardInfo: { flex: 1 },
  missaoTituloCard: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tagTarget: { backgroundColor: '#4169E120', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '60%' },
  tagTargetText: { color: '#4169E1', fontSize: 11, fontWeight: 'bold' },
  tagCount: { backgroundColor: '#32CD3220', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagCountText: { color: '#32CD32', fontSize: 11, fontWeight: 'bold' },
  btnApagarCard: { padding: 8, backgroundColor: '#FF444415', borderRadius: 8, marginLeft: 10 },

  // Modal Principal
  modalPrincipal: { flex: 1, backgroundColor: '#080808' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalScroll: { padding: 20 },
  fieldLabel: { color: '#FFD700', fontSize: 15, fontWeight: 'bold', marginBottom: 8, marginTop: 18 },
  inputSimplificado: { backgroundColor: '#12121e', color: '#fff', padding: 14, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#222' },
  
  rowSegmented: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  btnSegmented: { flex: 1, padding: 12, backgroundColor: '#12121e', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  btnSegmentedAtivo: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  txtSegmented: { color: '#666', fontWeight: 'bold', fontSize: 11 },
  
  seletorAlvo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12121e', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#222', gap: 10 },
  txtSeletorAlvo: { flex: 1, color: '#555', fontSize: 14, fontWeight: '600' },
  divisorModal: { height: 1, backgroundColor: '#1a1a1a', marginVertical: 25 },

  // 🚨 NOVO LAYOUT VERTICAL
  painelEntradaRapida: { backgroundColor: '#12121e', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 20 },
  helperText: { color: '#555', fontSize: 11, marginBottom: 15, textAlign: 'center', fontStyle: 'italic' },
  colunaInputs: { flexDirection: 'column', gap: 12, marginBottom: 15 },
  inputGroup: { width: '100%' },
  miniLabel: { color: '#888', fontSize: 12, marginBottom: 5, marginLeft: 2 },
  
  inputContaVertical: { backgroundColor: '#080808', color: '#fff', height: 50, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, fontWeight: '600', borderWidth: 1, borderColor: '#333' },
  inputRespVertical: { backgroundColor: '#080808', color: '#32CD32', height: 50, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, fontWeight: 'bold', borderWidth: 1, borderColor: '#333' },

  btnConfirmarQuestao: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 8 },
  txtConfirmarQuestao: { color: '#000', fontWeight: 'bold', fontSize: 14 },

  itemQuestaoVisual: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#12121e', padding: 14, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a1a' },
  txtQuestaoLabel: { color: '#666', fontSize: 11, fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' },
  txtQuestaoVisual: { color: '#fff', fontSize: 17, fontWeight: '600' },
  btnPublicarFinal: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30 },
  txtPublicarFinal: { color: '#000', fontSize: 16, fontWeight: '900' },

  // Modal Seleção
  overlaySelecao: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  containerSelecao: { width: '85%', height: '70%', backgroundColor: '#12121e', borderRadius: 16, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  headerSelecao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#333', backgroundColor: '#1a1a2e' },
  titleSelecao: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  itemSelecao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 15 },
  txtItemSelecaoNome: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  txtItemSelecaoInfo: { color: '#666', fontSize: 12 },
});
