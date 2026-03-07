import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Interfaces
interface Questao {
  id: string;
  texto: string; // Ex: "2 + 2" ou "2³"
  resposta: number;
}

interface Missao {
  id: string;
  titulo: string;
  alvoTipo: 'GERAL' | 'TURMA' | 'INDIVIDUAL';
  alvoNome: string; // Nome amigável (ex: "Todos", "Turma Delta", "João")
  alvoId: string;   // ID real para o banco de dados
  questoes: Questao[];
}

// MOCKS (Dados de exemplo - substitua pela chamada da API depois)
const MOCK_TURMAS = [
  { id: 't1', nome: 'Turma Delta' },
  { id: 't2', nome: 'Turma Ômega' },
  { id: 't3', nome: 'Líderes' },
];

const MOCK_ALUNOS = [
  { id: 'a1', nome: 'João Silva', email: 'joao@email.com' },
  { id: 'a2', nome: 'Maria Souza', email: 'maria@email.com' },
  { id: 'a3', nome: 'Pedro Alvo', email: 'pedro@email.com' },
];

export default function GerenciarJogosAdmin() {
  const router = useRouter();
  
  // Lista de Missões Ativas na memória (Mock)
  const [missoes, setMissoes] = useState<Missao[]>([
    {
      id: '1',
      titulo: 'Desafio de Multiplicação Avançada',
      alvoTipo: 'TURMA',
      alvoNome: 'Turma Delta',
      alvoId: 't1',
      questoes: [{ id: 'q1', texto: '12 × 12', resposta: 144 }, { id: 'q2', texto: '15 × 5', resposta: 75 }]
    }
  ]);

  // Estados do Modal de Criação
  const [modalVisivel, setModalVisivel] = useState(false);
  const [tituloMissao, setTituloMissao] = useState('');
  const [alvoTipo, setAlvoTipo] = useState<'GERAL' | 'TURMA' | 'INDIVIDUAL'>('GERAL');
  const [alvoSelecionado, setAlvoSelecionado] = useState<{id: string, nome: string} | null>(null);
  const [questoesTemporarias, setQuestoesTemporarias] = useState<Questao[]>([]);

  // Estados dos Modais de Seleção (Turma/Aluno)
  const [modalSelecaoVisivel, setModalSelecaoVisivel] = useState(false);

  // Estados da Nova Entrada Simples de Questão
  const [entradaConta, setEntradaConta] = useState(''); // Ex: "2^3"
  const [entradaResposta, setEntradaResposta] = useState(''); // Ex: "8"

  // Função para processar a digitação manual e transformar em questão
  const processarEAdicionarQuestao = () => {
    if (!entradaConta || !entradaResposta) {
      Alert.alert('Erro', 'Digite a conta (ex: 2*3) e a resposta!');
      return;
    }

    // Limpa espaços em branco
    let contaLimpa = entradaConta.replace(/\s+/g, '');
    
    // Formatação visual inteligente
    let textoVisual = contaLimpa
      .replace(/\*/g, ' × ') // Troca * por ×
      .replace(/\//g, ' ÷ '); // Troca / por ÷
    
    // Trata potência (substitui ^ por sobrescrito se for baixo)
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

  const salvarMissaoFinal = () => {
    if (!tituloMissao || questoesTemporarias.length === 0) {
      Alert.alert('Erro', 'Preencha o título e adicione questões!');
      return;
    }
    if (alvoTipo !== 'GERAL' && !alvoSelecionado) {
      Alert.alert('Erro', 'Selecione a Turma ou o Aluno alvo!');
      return;
    }

    const novaMissao: Missao = {
      id: Math.random().toString(),
      titulo: tituloMissao,
      alvoTipo,
      alvoNome: alvoTipo === 'GERAL' ? 'Todos' : alvoSelecionado!.nome,
      alvoId: alvoTipo === 'GERAL' ? 'all' : alvoSelecionado!.id,
      questoes: questoesTemporarias
    };

    setMissoes([novaMissao, ...missoes]);
    fecharModalPrincipal();
    Alert.alert('Sucesso', 'Jogo personalizado criado com sucesso!');
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
    Alert.alert('Apagar Jogo', 'Tem certeza que deseja excluir esta missão permanentemente?', [
      { text: 'Cancelar', style: 'cancel' },
      // 🚨 AGORA FUNCIONA: O botão de apagar deleta da lista na memória
      { text: 'Apagar', style: 'destructive', onPress: () => {
        setMissoes(prev => prev.filter(m => m.id !== id));
      }}
    ]);
  };

  // Renderização de cada item da lista de seleção (Turma/Aluno)
  const renderItemSelecao = ({ item }: any) => (
    <TouchableOpacity style={styles.itemSelecao} onPress={() => {
      setAlvoSelecionado({ id: item.id, nome: item.nome });
      setModalSelecaoVisivel(false);
    }}>
      <View>
        <Text style={styles.txtItemSelecaoNome}>{item.nome}</Text>
        {item.email && <Text style={styles.txtItemSelecaoEmail}>{item.email}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header padrão */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jogos Personalizados</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.btnCriarPrincipal} onPress={() => setModalVisivel(true)}>
          <Ionicons name="add-circle" size={26} color="#000" />
          <Text style={styles.txtBtnCriarPrincipal}>CRIAR NOVA MISSÃO</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Missões Ativas ({missoes.length})</Text>

        {missoes.map(missao => (
          <View key={missao.id} style={styles.cardMissao}>
            <View style={styles.cardInfo}>
              <Text style={styles.missaoTituloCard}>{missao.titulo}</Text>
              <View style={styles.tagsRow}>
                <View style={styles.tagTarget}>
                  <Ionicons name={missao.alvoTipo === 'INDIVIDUAL' ? "person" : "people"} size={14} color="#4169E1" />
                  <Text style={styles.tagTargetText}>{missao.alvoNome}</Text>
                </View>
                <View style={styles.tagCount}>
                  <Ionicons name="list" size={14} color="#32CD32" />
                  <Text style={styles.tagCountText}>{missao.questoes.length} Questões</Text>
                </View>
              </View>
            </View>
            {/* 🚨 BOTÃO DE APAGAR: Agora com a função de deletar ativa */}
            <TouchableOpacity style={styles.btnApagarCard} onPress={() => confirmarDeletarMissao(missao.id)}>
              <Ionicons name="trash" size={20} color="#FF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* ==================== MODAL PRINCIPAL DE CRIAÇÃO ==================== */}
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
              placeholder="Ex: Reforço de Tabuada do 7..." 
              placeholderTextColor="#555"
              value={tituloMissao}
              onChangeText={setTituloMissao}
            />

            <Text style={styles.fieldLabel}>2. Destinatário:</Text>
            <View style={styles.rowSegmented}>
              {(['GERAL', 'TURMA', 'INDIVIDUAL'] as const).map(tipo => (
                <TouchableOpacity 
                  key={tipo} 
                  style={[styles.btnSegmented, alvoTipo === tipo && styles.btnSegmentedAtivo]}
                  onPress={() => {
                    setAlvoTipo(tipo);
                    setAlvoSelecionado(null); // Reseta seleção anterior
                  }}
                >
                  <Text style={[styles.txtSegmented, alvoTipo === tipo && { color: '#000' }]}>{tipo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Campo de Seleção Inteligente (Lista ao invés de digitação) */}
            {alvoTipo !== 'GERAL' && (
              <TouchableOpacity style={styles.seletorAlvo} onPress={() => setModalSelecaoVisivel(true)}>
                <Ionicons name={alvoTipo === 'TURMA' ? "business" : "person-add"} size={20} color="#888" />
                <Text style={[styles.txtSeletorAlvo, alvoSelecionado && { color: '#fff' }]}>
                  {alvoSelecionado ? alvoSelecionado.nome : (alvoTipo === 'TURMA' ? "Selecionar Turma..." : "Selecionar Aluno...")}
                </Text>
                <Ionicons name="search" size={20} color="#FFD700" />
              </TouchableOpacity>
            )}

            <View style={styles.divisorModal} />

            <Text style={styles.fieldLabel}>3. Adicionar Questões (Entrada Rápida):</Text>
            
            {/* 🚨 NOVA ÁREA DE CRIAÇÃO: Input único e simples */}
            <View style={styles.painelEntradaRapida}>
              <Text style={styles.helperText}>Use * para ×, / para ÷ e ^ para potência.</Text>
              <View style={styles.rowInputsRapidos}>
                <TextInput 
                  style={[styles.inputAcao, { flex: 2 }]} 
                  placeholder="Conta (ex: 7*8)" 
                  placeholderTextColor="#555"
                  value={entradaConta}
                  onChangeText={setEntradaConta}
                  autoCapitalize="none"
                />
                <Text style={styles.txtIgualModal}>=</Text>
                <TextInput 
                  style={[styles.inputAcao, { flex: 1, borderColor: '#32CD32' }]} 
                  placeholder="Resp" 
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  value={entradaResposta}
                  onChangeText={setEntradaResposta}
                />
              </View>
              <TouchableOpacity style={styles.btnConfirmarQuestao} onPress={processarEAdicionarQuestao}>
                <Ionicons name="checkmark-circle" size={18} color="#000" />
                <Text style={styles.txtConfirmarQuestao}>Incluir na Lista</Text>
              </TouchableOpacity>
            </View>

            {/* Lista visual das questões adicionadas */}
            {questoesTemporarias.map((q, i) => (
              <View key={q.id} style={styles.itemQuestaoVisual}>
                <Text style={styles.txtQuestaoVisual}>{i + 1}.   {q.texto}  =  <Text style={{color: '#32CD32', fontWeight: 'bold'}}>{q.resposta}</Text></Text>
                <TouchableOpacity onPress={() => removerQuestao(q.id)}>
                  <Ionicons name="trash-outline" size={22} color="#FF4444" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Botão Final de Publicação */}
            {questoesTemporarias.length > 0 && (
              <TouchableOpacity style={styles.btnPublicarFinal} onPress={salvarMissaoFinal}>
                <Ionicons name="cloud-upload" size={22} color="#000" />
                <Text style={styles.txtPublicarFinal}>PUBLICAR JOGO COMPLETO</Text>
              </TouchableOpacity>
            )}
            <View style={{height: 50}} /> {/* Espaçador inferior */}

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ==================== MODAL SECUNDÁRIO DE SELEÇÃO (LISTA) ==================== */}
      <Modal visible={modalSelecaoVisivel} animationType="fade" transparent={true}>
        <View style={styles.overlaySelecao}>
          <View style={styles.containerSelecao}>
            <View style={styles.headerSelecao}>
              <Text style={styles.titleSelecao}>{alvoTipo === 'TURMA' ? "Escolha a Turma" : "Escolha o Aluno"}</Text>
              <TouchableOpacity onPress={() => setModalSelecaoVisivel(false)}>
                <Ionicons name="close-circle" size={26} color="#FF4444" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={alvoTipo === 'TURMA' ? MOCK_TURMAS : MOCK_ALUNOS}
              keyExtractor={(item) => item.id}
              renderItem={renderItemSelecao}
              contentContainerStyle={{ padding: 15 }}
              ItemSeparatorComponent={() => <View style={{height: 1, backgroundColor: '#222'}} />}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Estilos da Tela Principal
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#1a1a1a' },
  backBtn: { marginRight: 15 },
  headerTitle: { color: '#FFD700', fontSize: 19, fontWeight: 'bold' },
  scrollContent: { padding: 16 },
  btnCriarPrincipal: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 25, elevation: 3 },
  txtBtnCriarPrincipal: { color: '#000', fontSize: 15, fontWeight: '900' },
  sectionLabel: { color: '#666', fontSize: 13, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase' },
  cardMissao: { backgroundColor: '#12121e', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  cardInfo: { flex: 1 },
  missaoTituloCard: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tagTarget: { backgroundColor: '#4169E120', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagTargetText: { color: '#4169E1', fontSize: 11, fontWeight: 'bold' },
  tagCount: { backgroundColor: '#32CD3220', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagCountText: { color: '#32CD32', fontSize: 11, fontWeight: 'bold' },
  btnApagarCard: { padding: 8, backgroundColor: '#FF444415', borderRadius: 8, marginLeft: 10 },

  // Estilos do Modal Principal (Construtor)
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

  // 🚨 Estilos da NOVA ÁREA DE ENTRADA RÁPIDA
  painelEntradaRapida: { backgroundColor: '#12121e', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', marginBottom: 20 },
  helperText: { color: '#555', fontSize: 11, marginBottom: 10, textAlign: 'center', fontStyle: 'italic' },
  rowInputsRapidos: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  inputAcao: { backgroundColor: '#080808', color: '#fff', height: 45, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, fontWeight: '600', borderWidth: 1, borderColor: '#333' },
  txtIgualModal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  btnConfirmarQuestao: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 8 },
  txtConfirmarQuestao: { color: '#000', fontWeight: 'bold', fontSize: 13 },

  itemQuestaoVisual: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#12121e', padding: 14, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a1a' },
  txtQuestaoVisual: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnPublicarFinal: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30 },
  txtPublicarFinal: { color: '#000', fontSize: 16, fontWeight: '900' },

  // Estilos do Modal de Seleção (Lista)
  overlaySelecao: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  containerSelecao: { width: '85%', height: '70%', backgroundColor: '#12121e', borderRadius: 16, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  headerSelecao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#333', backgroundColor: '#1a1a2e' },
  titleSelecao: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  itemSelecao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 5 },
  txtItemSelecaoNome: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  txtItemSelecaoEmail: { color: '#666', fontSize: 12 },
});
