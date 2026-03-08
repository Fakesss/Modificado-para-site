import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Turma } from '../../src/types'; 

const ALTERNATIVA_CORES = [
  { letra: 'A', cor: '#E74C3C' },
  { letra: 'B', cor: '#F39C12' },
  { letra: 'C', cor: '#27AE60' },
  { letra: 'D', cor: '#3498DB' },
  { letra: 'E', cor: '#9B59B6' },
];

interface QuestaoForm {
  id: string;
  numero: number;
  tipoResposta: 'MULTIPLA_ESCOLHA' | 'TEXTO';
  enunciado: string;
  alternativas: { letra: string; texto: string; cor: string }[];
  correta: string;
}

type TipoDestinatario = 'TURMA' | 'EQUIPE' | 'ALUNO';

export default function CriarExercicio() {
  const router = useRouter();
  
  // Dados das listas
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  
  // Formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontuacaoTotal, setPontuacaoTotal] = useState('10');
  const [habilidadesBNCC, setHabilidadesBNCC] = useState('');
  
  // Controle de Destinatário
  const [tipoDestinatario, setTipoDestinatario] = useState<TipoDestinatario>('TURMA');
  const [destinatarioId, setDestinatarioId] = useState('');
  
  const [questoes, setQuestoes] = useState<QuestaoForm[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Carrega Turmas
      const turmasData = await api.getTurmas();
      setTurmas(turmasData);

      // Tenta carregar Equipes (se a função existir na API)
      if ((api as any).getEquipes) {
        const equipesData = await (api as any).getEquipes();
        setEquipes(equipesData);
      }

      // Tenta carregar Alunos (se a função existir na API)
      if ((api as any).getAlunos) {
        const alunosData = await (api as any).getAlunos();
        setAlunos(alunosData);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const addQuestao = () => {
    const novaQuestao: QuestaoForm = {
      id: `q-${Date.now()}`,
      numero: questoes.length + 1,
      tipoResposta: 'MULTIPLA_ESCOLHA',
      enunciado: '',
      alternativas: ALTERNATIVA_CORES.slice(0, 4).map((a) => ({
        letra: a.letra,
        texto: '',
        cor: a.cor,
      })),
      correta: '',
    };
    setQuestoes([...questoes, novaQuestao]);
  };

  const removeQuestao = (index: number) => {
    const newQuestoes = questoes.filter((_, i) => i !== index);
    newQuestoes.forEach((q, i) => {
      q.numero = i + 1;
    });
    setQuestoes(newQuestoes);
  };

  const updateQuestao = (index: number, field: keyof QuestaoForm, value: any) => {
    const newQuestoes = [...questoes];
    newQuestoes[index] = { ...newQuestoes[index], [field]: value };
    setQuestoes(newQuestoes);
  };

  const updateAlternativa = (qIndex: number, altIndex: number, texto: string) => {
    const newQuestoes = [...questoes];
    newQuestoes[qIndex].alternativas[altIndex].texto = texto;
    setQuestoes(newQuestoes);
  };

  const handleSave = async () => {
    if (!titulo.trim()) {
      Alert.alert('Erro', 'O título é obrigatório.');
      return;
    }
    if (questoes.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos uma questão.');
      return;
    }
    const pontos = Number(pontuacaoTotal.replace(/[^0-9.]/g, ''));
    if (!pontos || pontos <= 0) {
      Alert.alert('Erro', 'A pontuação total deve ser maior que zero.');
      return;
    }

    for (const q of questoes) {
      if (!q.enunciado.trim()) {
        Alert.alert('Erro', `A Questão ${q.numero} está sem enunciado.`);
        return;
      }
      if (q.tipoResposta === 'MULTIPLA_ESCOLHA' && !q.correta) {
        Alert.alert('Erro', `Selecione a alternativa correta na Questão ${q.numero}.`);
        return;
      }
      if (q.tipoResposta === 'TEXTO' && !q.correta.trim()) {
        Alert.alert('Erro', `Informe a resposta esperada na Questão ${q.numero}.`);
        return;
      }
    }

    setLoading(true);

    try {
      const habilidades = habilidadesBNCC
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h);

      const valorPorQuestao = pontos / questoes.length;

      const exercicioData = {
        titulo,
        descricao,
        modoCriacao: 'MANUAL',
        habilidadesBNCC: habilidades,
        pontosPorQuestao: valorPorQuestao,
        
        turmaId: tipoDestinatario === 'TURMA' && destinatarioId ? destinatarioId : undefined,
        equipeId: tipoDestinatario === 'EQUIPE' && destinatarioId ? destinatarioId : undefined,
        alunoId: tipoDestinatario === 'ALUNO' && destinatarioId ? destinatarioId : undefined,

        questoes: questoes.map((q) => ({
          numero: q.numero,
          tipoResposta: q.tipoResposta,
          enunciado: q.enunciado,
          alternativas: q.alternativas.filter((a) => a.texto.trim()),
          correta: q.correta,
          pontuacaoMax: valorPorQuestao,
          habilidadesBNCC: habilidades,
        })),
      };

      await api.createExercicio(exercicioData);
      
      Alert.alert('Sucesso!', 'Exercício salvo e enviado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      
    } catch (error: any) {
      console.log("=== ERRO AO SALVAR ===");
      console.log(error);
      
      let mensagemErro = 'Não foi possível salvar. Verifique sua conexão.';
      
      if (error.response && error.response.data && error.response.data.detail) {
        const detalhe = error.response.data.detail;
        mensagemErro = typeof detalhe === 'string' ? detalhe : "Verifique os dados preenchidos.";
      }
      Alert.alert('Erro ao Salvar', mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  const renderDestinatarios = () => {
    let dados: any[] = [];
    
    if (tipoDestinatario === 'TURMA') {
      dados = turmas;
    } else if (tipoDestinatario === 'EQUIPE') {
      dados = equipes;
    } else {
      dados = alunos;
    }

    if (loadingData) {
      return (
        <View style={{ padding: 20 }}>
          <ActivityIndicator size="small" color="#FFD700" />
        </View>
      );
    }

    if (dados.length === 0) {
      return (
        <Text style={styles.emptyListText}>
          Nenhum(a) {tipoDestinatario.toLowerCase()} encontrado(a).
        </Text>
      );
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.listContainer}>
        <TouchableOpacity
          style={[styles.selectOption, !destinatarioId && styles.selectOptionActive]}
          onPress={() => setDestinatarioId('')}
        >
          <Text style={[styles.selectText, !destinatarioId && { color: '#000' }]}>
            {tipoDestinatario === 'ALUNO' ? 'Todos' : 'Geral (Sem vínculo)'}
          </Text>
        </TouchableOpacity>
        
        {dados.map((item: any) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.selectOption, destinatarioId === item.id && styles.selectOptionActive]}
            onPress={() => setDestinatarioId(item.id)}
          >
            <Text style={[styles.selectText, destinatarioId === item.id && { color: '#000' }]}>
              {item.nome || item.name || 'Sem Nome'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.loadingText}>Salvando...</Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Novo Exercício</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            <Ionicons name="checkmark" size={28} color={loading ? "#666" : "#FFD700"} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configurações</Text>

            <Text style={styles.inputLabel}>Título</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Lista de Equações do 2º Grau"
              placeholderTextColor="#666"
              value={titulo}
              onChangeText={setTitulo}
            />

            <Text style={styles.inputLabel}>Enviar Para:</Text>
            <View style={styles.tabsContainer}>
              {(['TURMA', 'EQUIPE', 'ALUNO'] as TipoDestinatario[]).map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[styles.tabButton, tipoDestinatario === tipo && styles.tabButtonActive]}
                  onPress={() => {
                    setTipoDestinatario(tipo);
                    setDestinatarioId('');
                  }}
                >
                  <Text style={[styles.tabText, tipoDestinatario === tipo && styles.tabTextActive]}>
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {renderDestinatarios()}

            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.inputLabel}>Pontos Totais</Text>
                <TextInput
                  style={[styles.textInput, styles.pontosInput]}
                  keyboardType="numeric"
                  value={pontuacaoTotal}
                  onChangeText={setPontuacaoTotal}
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.inputLabel}>BNCC (Códigos)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: EF09MA06"
                  placeholderTextColor="#666"
                  value={habilidadesBNCC}
                  onChangeText={setHabilidadesBNCC}
                />
              </View>
            </View>
            
            <Text style={styles.inputLabel}>Descrição (Opcional)</Text>
            <TextInput
              style={[styles.textInput, { height: 60 }]}
              placeholder="Instruções para os alunos..."
              placeholderTextColor="#666"
              value={descricao}
              onChangeText={setDescricao}
              multiline
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Questões ({questoes.length})</Text>
              <TouchableOpacity style={styles.addButton} onPress={addQuestao}>
                <Ionicons name="add" size={20} color="#000" />
                <Text style={styles.addButtonText}>Nova Questão</Text>
              </TouchableOpacity>
            </View>

            {questoes.map((questao, qIndex) => (
              <View key={questao.id} style={styles.questaoCard}>
                <View style={styles.questaoHeader}>
                  <View style={styles.questaoNumero}>
                    <Text style={styles.questaoNumeroText}>{questao.numero}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeQuestao(qIndex)}>
                    <Ionicons name="trash-outline" size={22} color="#E74C3C" />
                  </TouchableOpacity>
                </View>

                <View style={styles.tipoSwitch}>
                   <TouchableOpacity 
                     style={[styles.switchOption, questao.tipoResposta === 'MULTIPLA_ESCOLHA' && styles.switchActive]}
                     onPress={() => updateQuestao(qIndex, 'tipoResposta', 'MULTIPLA_ESCOLHA')}
                   >
                     <Text style={[styles.switchText, questao.tipoResposta === 'MULTIPLA_ESCOLHA' && {color: '#000'}]}>Múltipla Escolha</Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                     style={[styles.switchOption, questao.tipoResposta === 'TEXTO' && styles.switchActive]}
                     onPress={() => updateQuestao(qIndex, 'tipoResposta', 'TEXTO')}
                   >
                     <Text style={[styles.switchText, questao.tipoResposta === 'TEXTO' && {color: '#000'}]}>Dissertativa</Text>
                   </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Enunciado (Aceita LaTeX entre $)</Text>
                <TextInput
                  style={[styles.textInput, styles.codeFont]}
                  placeholder="Escreva a pergunta aqui. Ex: Calcule $\sqrt{144}$."
                  placeholderTextColor="#666"
                  value={questao.enunciado}
                  onChangeText={(text) => updateQuestao(qIndex, 'enunciado', text)}
                  multiline
                />

                {questao.tipoResposta === 'MULTIPLA_ESCOLHA' && (
                  <View style={{ marginTop: 10 }}>
                    {questao.alternativas.map((alt, altIndex) => (
                      <View key={alt.letra} style={styles.alternativaRow}>
                        <TouchableOpacity
                          style={[
                            styles.alternativaLetra,
                            { backgroundColor: alt.cor },
                            questao.correta === alt.letra && styles.alternativaCorreta,
                          ]}
                          onPress={() => updateQuestao(qIndex, 'correta', alt.letra)}
                        >
                          <Text style={styles.alternativaLetraText}>{alt.letra}</Text>
                          {questao.correta === alt.letra && (
                            <View style={styles.checkBadge}>
                              <Ionicons name="checkmark" size={10} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                        <TextInput
                          style={styles.alternativaInput}
                          placeholder={`Opção ${alt.letra}`}
                          placeholderTextColor="#666"
                          value={alt.texto}
                          onChangeText={(text) => updateAlternativa(qIndex, altIndex, text)}
                        />
                      </View>
                    ))}
                  </View>
                )}

                {questao.tipoResposta === 'TEXTO' && (
                  <>
                    <Text style={styles.inputLabel}>Resposta Esperada (Gabarito)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Resposta correta para correção automática"
                      placeholderTextColor="#666"
                      value={questao.correta}
                      onChangeText={(text) => updateQuestao(qIndex, 'correta', text)}
                    />
                  </>
                )}
              </View>
            ))}

            {questoes.length === 0 && (
              <View style={styles.emptyQuestions}>
                <Ionicons name="school-outline" size={48} color="#333" />
                <Text style={styles.emptyText}>Comece adicionando uma questão</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 50 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addButtonText: { color: '#000', fontWeight: '600', fontSize: 12 },
  
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
  textInput: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#333' },
  pontosInput: { color: '#FFD700', fontWeight: 'bold', textAlign: 'center' },
  codeFont: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', minHeight: 80, textAlignVertical: 'top' },
  
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  
  tabsContainer: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 4, marginBottom: 12 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabButtonActive: { backgroundColor: '#333' },
  tabText: { color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  
  listContainer: { marginBottom: 8, maxHeight: 50 },
  selectOption: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#333', marginRight: 8, backgroundColor: '#1a1a2e' },
  selectOptionActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  selectText: { color: '#888', fontWeight: '600', fontSize: 13 },
  emptyListText: { color: '#555', fontStyle: 'italic', fontSize: 12, marginVertical: 8 },

  questaoCard: { backgroundColor: '#151520', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#222' },
  questaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  questaoNumero: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' },
  questaoNumeroText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  
  tipoSwitch: { flexDirection: 'row', backgroundColor: '#000', borderRadius: 8, padding: 2, marginBottom: 12 },
  switchOption: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  switchActive: { backgroundColor: '#333' },
  switchText: { color: '#666', fontSize: 12, fontWeight: 'bold' },

  alternativaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  alternativaLetra: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  alternativaCorreta: { borderWidth: 2, borderColor: '#fff' },
  alternativaLetraText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  checkBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#27AE60', width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#151520' },
  alternativaInput: { flex: 1, backgroundColor: '#222', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14 },

  emptyQuestions: { alignItems: 'center', padding: 30, opacity: 0.5 },
  emptyText: { color: '#888', fontSize: 14, marginTop: 12 },

  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { backgroundColor: '#222', padding: 24, borderRadius: 16, alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 16, fontWeight: '600' },
});
