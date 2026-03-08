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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Turma, Equipe, Usuario } from '../../src/types';

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
  pontuacaoMax: number;
  habilidadesBNCC: string[];
}

export default function CriarExercicio() {
  const router = useRouter();
  
  // Listas puxadas do banco de dados
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  
  // Destinatários selecionados
  const [turmaId, setTurmaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  
  const [habilidadesBNCC, setHabilidadesBNCC] = useState('');
  const [questoes, setQuestoes] = useState<QuestaoForm[]>([]);

  useEffect(() => {
    loadDestinatarios();
  }, []);

  const loadDestinatarios = async () => {
    try {
      const [turmasData, equipesData, usuariosData] = await Promise.all([
        api.getTurmas().catch(() => []),
        api.getEquipes().catch(() => []),
        api.getUsuarios().catch(() => [])
      ]);
      setTurmas(turmasData);
      setEquipes(equipesData);
      setUsuarios(usuariosData);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
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
      pontuacaoMax: 1, 
      habilidadesBNCC: [],
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
      Alert.alert('Erro', 'Título é obrigatório');
      return;
    }

    if (questoes.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos uma questão');
      return;
    }

    for (const q of questoes) {
      if (!q.enunciado.trim()) {
        Alert.alert('Erro', `Questão ${q.numero} precisa de um enunciado`);
        return;
      }
      if (q.tipoResposta === 'MULTIPLA_ESCOLHA' && !q.correta) {
        Alert.alert('Erro', `Questão ${q.numero} precisa ter uma resposta marcada como correta`);
        return;
      }
      if (q.tipoResposta === 'TEXTO' && !q.correta.trim()) {
        Alert.alert('Erro', `Questão ${q.numero} precisa de uma resposta esperada`);
        return;
      }
    }

    setLoading(true);
    try {
      const habilidades = habilidadesBNCC
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h);

      const exercicioData = {
        titulo,
        descricao,
        modoCriacao: 'MANUAL',
        habilidadesBNCC: habilidades,
        turmaId: turmaId || undefined,
        equipeId: equipeId || undefined,
        usuarioId: usuarioId || undefined,
        pontosPorQuestao: questoes[0]?.pontuacaoMax || 1, 
        questoes: questoes.map((q) => ({
          numero: q.numero,
          tipoResposta: q.tipoResposta,
          enunciado: q.enunciado,
          alternativas: q.alternativas.filter((a) => a.texto.trim()),
          correta: q.correta,
          pontuacaoMax: q.pontuacaoMax,
          habilidadesBNCC: habilidades,
        })),
      };

      await api.createExercicio(exercicioData);
      Alert.alert('Sucesso', 'Exercício criado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.log("=== ERRO AO SALVAR ===");
      console.log(error);
      
      let mensagemErro = 'Erro desconhecido ao tentar salvar. Verifique sua internet.';
      
      if (error.response && error.response.data) {
        const detalhe = error.response.data.detail;
        if (typeof detalhe === 'string') {
          mensagemErro = detalhe;
        } else if (Array.isArray(detalhe)) {
          mensagemErro = "O servidor recusou os dados (Erro 422). Pode ser que ele ainda não suporte envio para Equipe ou Usuário específico.";
        }
      }
      Alert.alert('Falha ao Salvar', mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Criar Exercício</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFD700" />
            ) : (
              <Ionicons name="checkmark" size={28} color="#FFD700" />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Informações Básicas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações Básicas</Text>

            <Text style={styles.inputLabel}>Título *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Título do exercício"
              placeholderTextColor="#666"
              value={titulo}
              onChangeText={setTitulo}
            />

            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={[styles.textInput, { height: 80 }]}
              placeholder="Descrição (opcional)"
              placeholderTextColor="#666"
              value={descricao}
              onChangeText={setDescricao}
              multiline
            />

            <Text style={styles.inputLabel}>Habilidades BNCC (separadas por vírgula)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: EF06MA01, EF06MA02"
              placeholderTextColor="#666"
              value={habilidadesBNCC}
              onChangeText={setHabilidadesBNCC}
            />
          </View>

          {/* Área de Destinatários */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Público-Alvo (Opcional)</Text>
            <Text style={styles.hintText}>Se deixar tudo marcado como "Todas/Todos", o exercício será público.</Text>

            <Text style={styles.inputLabel}>Enviar para Turma Específica:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.selectOption, !turmaId && styles.selectOptionActive]}
                onPress={() => setTurmaId('')}
              >
                <Text style={[styles.selectText, !turmaId && { color: '#000' }]}>Todas</Text>
              </TouchableOpacity>
              {turmas.map((turma) => (
                <TouchableOpacity
                  key={turma.id}
                  style={[styles.selectOption, turmaId === turma.id && styles.selectOptionActive]}
                  onPress={() => setTurmaId(turma.id)}
                >
                  <Text style={[styles.selectText, turmaId === turma.id && { color: '#000' }]}>{turma.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Enviar para Equipe Específica:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.selectOption, !equipeId && styles.selectOptionActive]}
                onPress={() => setEquipeId('')}
              >
                <Text style={[styles.selectText, !equipeId && { color: '#000' }]}>Todas</Text>
              </TouchableOpacity>
              {equipes.map((equipe) => (
                <TouchableOpacity
                  key={equipe.id}
                  style={[styles.selectOption, equipeId === equipe.id && styles.selectOptionActive]}
                  onPress={() => setEquipeId(equipe.id)}
                >
                  <Text style={[styles.selectText, equipeId === equipe.id && { color: '#000' }]}>{equipe.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Enviar para Usuário Específico:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.selectOption, !usuarioId && styles.selectOptionActive]}
                onPress={() => setUsuarioId('')}
              >
                <Text style={[styles.selectText, !usuarioId && { color: '#000' }]}>Todos</Text>
              </TouchableOpacity>
              {usuarios.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={[styles.selectOption, usuarioId === user.id && styles.selectOptionActive]}
                  onPress={() => setUsuarioId(user.id)}
                >
                  <Text style={[styles.selectText, usuarioId === user.id && { color: '#000' }]}>{user.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Questões */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Questões ({questoes.length})</Text>
              <TouchableOpacity style={styles.addButton} onPress={addQuestao}>
                <Ionicons name="add" size={20} color="#000" />
                <Text style={styles.addButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </View>

            {questoes.map((questao, qIndex) => (
              <View key={questao.id} style={styles.questaoCard}>
                <View style={styles.questaoHeader}>
                  <View style={styles.questaoNumero}>
                    <Text style={styles.questaoNumeroText}>{questao.numero}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeQuestao(qIndex)}>
                    <Ionicons name="trash" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>

                {/* Pontuação da Questão */}
                <Text style={styles.inputLabel}>Pontos que essa questão vale:</Text>
                <TextInput
                  style={[styles.textInput, { width: 100, textAlign: 'center' }]}
                  keyboardType="numeric"
                  value={String(questao.pontuacaoMax)}
                  onChangeText={(text) => {
                    const number = Number(text.replace(/[^0-9]/g, ''));
                    updateQuestao(qIndex, 'pontuacaoMax', number);
                  }}
                />

                <Text style={styles.inputLabel}>Tipo de Resposta</Text>
                <View style={styles.tipoContainer}>
                  <TouchableOpacity
                    style={[
                      styles.tipoOption,
                      questao.tipoResposta === 'MULTIPLA_ESCOLHA' && styles.tipoOptionActive,
                    ]}
                    onPress={() => updateQuestao(qIndex, 'tipoResposta', 'MULTIPLA_ESCOLHA')}
                  >
                    <Text
                      style={[
                        styles.tipoText,
                        questao.tipoResposta === 'MULTIPLA_ESCOLHA' && { color: '#000' },
                      ]}
                    >
                      Múltipla Escolha
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.tipoOption,
                      questao.tipoResposta === 'TEXTO' && styles.tipoOptionActive,
                    ]}
                    onPress={() => updateQuestao(qIndex, 'tipoResposta', 'TEXTO')}
                  >
                    <Text
                      style={[
                        styles.tipoText,
                        questao.tipoResposta === 'TEXTO' && { color: '#000' },
                      ]}
                    >
                      Texto
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Enunciado *</Text>
                <TextInput
                  style={[styles.textInput, { height: 100 }]}
                  placeholder="Ex: Qual o valor de $x$ na equação $2x = 4$?"
                  placeholderTextColor="#666"
                  value={questao.enunciado}
                  onChangeText={(text) => updateQuestao(qIndex, 'enunciado', text)}
                  multiline
                />

                {questao.tipoResposta === 'MULTIPLA_ESCOLHA' && (
                  <>
                    <Text style={styles.inputLabel}>Alternativas (suporta LaTeX com cifrão)</Text>
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
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </TouchableOpacity>
                        <TextInput
                          style={styles.alternativaInput}
                          placeholder={`Alternativa ${alt.letra}`}
                          placeholderTextColor="#666"
                          value={alt.texto}
                          onChangeText={(text) => updateAlternativa(qIndex, altIndex, text)}
                        />
                      </View>
                    ))}
                    <Text style={styles.hintText}>
                      Toque na bolinha colorida com a letra para marcar como a resposta correta.
                    </Text>
                  </>
                )}

                {questao.tipoResposta === 'TEXTO' && (
                  <>
                    <Text style={styles.inputLabel}>Resposta Esperada Exata</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Resposta correta (suporta LaTeX)"
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
                <Ionicons name="document-text-outline" size={40} color="#666" />
                <Text style={styles.emptyText}>Nenhuma questão adicionada</Text>
                <Text style={styles.emptyHint}>Clique em "Adicionar" para criar questões</Text>
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
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addButtonText: { color: '#000', fontWeight: '600' },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 8, marginTop: 12 },
  textInput: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, color: '#fff', fontSize: 16 },
  selectOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginRight: 8 },
  selectOptionActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  selectText: { color: '#888', fontWeight: '600' },
  questaoCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  questaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  questaoNumero: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' },
  questaoNumeroText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  tipoContainer: { flexDirection: 'row', gap: 8 },
  tipoOption: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  tipoOptionActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  tipoText: { color: '#888', fontWeight: '600' },
  alternativaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  alternativaLetra: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 2 },
  alternativaCorreta: { borderWidth: 3, borderColor: '#fff' },
  alternativaLetraText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  alternativaInput: { flex: 1, backgroundColor: '#252540', borderRadius: 10, padding: 12, color: '#fff', fontSize: 14 },
  hintText: { color: '#666', fontSize: 12, fontStyle: 'italic', marginTop: 8 },
  emptyQuestions: { alignItems: 'center', padding: 30, backgroundColor: '#1a1a2e', borderRadius: 16 },
  emptyText: { color: '#888', fontSize: 16, marginTop: 12 },
  emptyHint: { color: '#666', fontSize: 12, marginTop: 4 },
});
