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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Questao {
  id: string;
  texto: string;
  resposta: number;
}

interface Missao {
  id: string;
  titulo: string;
  alvoTipo: 'GERAL' | 'TURMA' | 'INDIVIDUAL';
  alvoId: string;
  questoes: Questao[];
}

export default function GerenciarJogosAdmin() {
  const router = useRouter();
  
  // Lista de Missões (Mock inicial para você ver como fica)
  const [missoes, setMissoes] = useState<Missao[]>([
    {
      id: '1',
      titulo: 'Desafio de Multiplicação Avançada',
      alvoTipo: 'TURMA',
      alvoId: 'Turma Delta',
      questoes: [{ id: 'q1', texto: '12 × 12', resposta: 144 }, { id: 'q2', texto: '15 × 5', resposta: 75 }]
    }
  ]);

  // Controles do Modal de Criação
  const [modalVisivel, setModalVisivel] = useState(false);
  const [tituloMissao, setTituloMissao] = useState('');
  const [alvoTipo, setAlvoTipo] = useState<'GERAL' | 'TURMA' | 'INDIVIDUAL'>('GERAL');
  const [alvoId, setAlvoId] = useState(''); // Nome da turma ou ID do aluno
  const [questoesTemporarias, setQuestoesTemporarias] = useState<Questao[]>([]);

  // Controles de Adicionar Questão
  const [n1, setN1] = useState('');
  const [operador, setOperador] = useState('+');
  const [n2, setN2] = useState('');
  const [resposta, setResposta] = useState('');

  const adicionarQuestao = () => {
    if (!n1 || !resposta) {
      Alert.alert('Erro', 'Preencha pelo menos o Número 1 e a Resposta!');
      return;
    }
    
    // Monta o texto da questão (Ex: "2 + 2" ou "√16")
    let textoQuestao = '';
    if (operador === '√') textoQuestao = `√${n1}`;
    else if (operador === '^') textoQuestao = `${n1}^${n2}`;
    else textoQuestao = `${n1} ${operador} ${n2}`;

    const novaQuestao: Questao = {
      id: Math.random().toString(),
      texto: textoQuestao,
      resposta: parseInt(resposta)
    };

    setQuestoesTemporarias([...questoesTemporarias, novaQuestao]);
    
    // Limpa os campos para a próxima
    setN1(''); setN2(''); setResposta('');
  };

  const removerQuestao = (id: string) => {
    setQuestoesTemporarias(questoesTemporarias.filter(q => q.id !== id));
  };

  const salvarMissao = () => {
    if (!tituloMissao || questoesTemporarias.length === 0) {
      Alert.alert('Erro', 'Dê um título e adicione pelo menos uma questão!');
      return;
    }
    if (alvoTipo !== 'GERAL' && !alvoId) {
      Alert.alert('Erro', 'Especifique o nome da Turma ou o ID do Aluno!');
      return;
    }

    const novaMissao: Missao = {
      id: Math.random().toString(),
      titulo: tituloMissao,
      alvoTipo,
      alvoId: alvoTipo === 'GERAL' ? 'Todos' : alvoId,
      questoes: questoesTemporarias
    };

    setMissoes([novaMissao, ...missoes]);
    fecharModal();
  };

  const fecharModal = () => {
    setModalVisivel(false);
    setTituloMissao('');
    setAlvoTipo('GERAL');
    setAlvoId('');
    setQuestoesTemporarias([]);
  };

  const deletarMissao = (id: string) => {
    Alert.alert('Atenção', 'Deseja mesmo apagar este jogo personalizado?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => setMissoes(missoes.filter(m => m.id !== id)) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jogos Personalizados</Text>
      </View>

      {/* Lista de Missões Ativas */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.btnCriar} onPress={() => setModalVisivel(true)}>
          <Ionicons name="add-circle" size={24} color="#000" />
          <Text style={styles.txtBtnCriar}>CRIAR NOVA MISSÃO</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Missões Ativas ({missoes.length})</Text>

        {missoes.map(missao => (
          <View key={missao.id} style={styles.cardMissao}>
            <View style={styles.cardInfo}>
              <Text style={styles.missaoTitulo}>{missao.titulo}</Text>
              <View style={styles.tagsRow}>
                <View style={styles.tag}>
                  <Ionicons name="people" size={14} color="#4169E1" />
                  <Text style={styles.tagText}>{missao.alvoId}</Text>
                </View>
                <View style={[styles.tag, { backgroundColor: '#32CD3230' }]}>
                  <Ionicons name="list" size={14} color="#32CD32" />
                  <Text style={[styles.tagText, { color: '#32CD32' }]}>{missao.questoes.length} Questões</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.btnApagar} onPress={() => deletarMissao(missao.id)}>
              <Ionicons name="trash" size={20} color="#FF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* MODAL DE CRIAÇÃO (O CONSTRUTOR) */}
      <Modal visible={modalVisivel} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Construir Jogo</Text>
            <TouchableOpacity onPress={fecharModal}>
              <Ionicons name="close" size={28} color="#FF4444" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Text style={styles.label}>1. Título do Jogo:</Text>
            <TextInput 
              style={styles.inputGeral} 
              placeholder="Ex: Treinamento de Frações..." 
              placeholderTextColor="#666"
              value={tituloMissao}
              onChangeText={setTituloMissao}
            />

            <Text style={styles.label}>2. Quem vai receber?</Text>
            <View style={styles.rowAlvo}>
              {['GERAL', 'TURMA', 'INDIVIDUAL'].map(tipo => (
                <TouchableOpacity 
                  key={tipo} 
                  style={[styles.btnAlvo, alvoTipo === tipo && styles.btnAlvoAtivo]}
                  onPress={() => setAlvoTipo(tipo as any)}
                >
                  <Text style={[styles.txtAlvo, alvoTipo === tipo && { color: '#000' }]}>{tipo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {alvoTipo !== 'GERAL' && (
              <TextInput 
                style={[styles.inputGeral, { marginTop: 10 }]} 
                placeholder={alvoTipo === 'TURMA' ? "Digite o nome da Turma..." : "Digite o ID ou Email do Aluno..."} 
                placeholderTextColor="#666"
                value={alvoId}
                onChangeText={setAlvoId}
              />
            )}

            <View style={styles.divisor} />

            <Text style={styles.label}>3. Adicionar Questões:</Text>
            
            {/* Máquina de Criar Contas */}
            <View style={styles.boxCriador}>
              <View style={styles.rowEquacao}>
                <TextInput style={styles.inputMat} placeholder="N1" placeholderTextColor="#666" keyboardType="numeric" value={n1} onChangeText={setN1} />
                
                {/* Operador Simulator (Simplificado para o layout) */}
                <TouchableOpacity style={styles.btnOperador} onPress={() => {
                  const ops = ['+', '-', '×', '÷', '^', '√'];
                  const idx = ops.indexOf(operador);
                  setOperador(ops[(idx + 1) % ops.length]);
                }}>
                  <Text style={styles.txtOperador}>{operador}</Text>
                </TouchableOpacity>

                <TextInput style={[styles.inputMat, operador === '√' && { opacity: 0.3 }]} placeholder="N2" placeholderTextColor="#666" keyboardType="numeric" value={n2} onChangeText={setN2} editable={operador !== '√'} />
                
                <Text style={styles.txtIgual}>=</Text>
                
                <TextInput style={[styles.inputMat, { borderColor: '#32CD32' }]} placeholder="Res" placeholderTextColor="#666" keyboardType="numeric" value={resposta} onChangeText={setResposta} />
              </View>

              <TouchableOpacity style={styles.btnAddQuestao} onPress={adicionarQuestao}>
                <Text style={styles.txtAddQuestao}>Adicionar à Lista</Text>
              </TouchableOpacity>
            </View>

            {/* Lista de Questões Adicionadas */}
            {questoesTemporarias.map((q, i) => (
              <View key={q.id} style={styles.itemQuestao}>
                <Text style={styles.textoItemQuestao}>{i + 1}.   {q.texto}  =  <Text style={{color: '#32CD32'}}>{q.resposta}</Text></Text>
                <TouchableOpacity onPress={() => removerQuestao(q.id)}>
                  <Ionicons name="close-circle" size={24} color="#FF4444" />
                </TouchableOpacity>
              </View>
            ))}

            {questoesTemporarias.length > 0 && (
              <TouchableOpacity style={styles.btnSalvarFinal} onPress={salvarMissao}>
                <Ionicons name="save" size={20} color="#000" />
                <Text style={styles.txtSalvarFinal}>SALVAR E PUBLICAR JOGO</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#222' },
  backBtn: { marginRight: 15 },
  headerTitle: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' },
  
  scrollContent: { padding: 20 },
  btnCriar: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 30 },
  txtBtnCriar: { color: '#000', fontSize: 16, fontWeight: '900' },
  
  sectionLabel: { color: '#888', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  
  cardMissao: { backgroundColor: '#1a1a2e', padding: 20, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  cardInfo: { flex: 1 },
  missaoTitulo: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  tagsRow: { flexDirection: 'row', gap: 10 },
  tag: { backgroundColor: '#4169E130', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tagText: { color: '#4169E1', fontSize: 12, fontWeight: 'bold' },
  btnApagar: { padding: 10, backgroundColor: '#FF444420', borderRadius: 8 },

  // Estilos do Modal
  modalContainer: { flex: 1, backgroundColor: '#0c0c0c' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  modalScroll: { padding: 20 },
  
  label: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 15 },
  inputGeral: { backgroundColor: '#1a1a2e', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  
  rowAlvo: { flexDirection: 'row', gap: 10 },
  btnAlvo: { flex: 1, padding: 12, backgroundColor: '#1a1a2e', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  btnAlvoAtivo: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  txtAlvo: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  
  divisor: { height: 1, backgroundColor: '#222', marginVertical: 25 },
  
  boxCriador: { backgroundColor: '#1a1a2e', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  rowEquacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  inputMat: { backgroundColor: '#0a0a0a', color: '#fff', flex: 1, height: 50, borderRadius: 8, textAlign: 'center', fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#444' },
  btnOperador: { backgroundColor: '#4169E1', width: 40, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 5 },
  txtOperador: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  txtIgual: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginHorizontal: 10 },
  
  btnAddQuestao: { backgroundColor: '#333', padding: 15, borderRadius: 8, alignItems: 'center' },
  txtAddQuestao: { color: '#fff', fontWeight: 'bold' },

  itemQuestao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 15, borderRadius: 8, marginBottom: 8 },
  textoItemQuestao: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  
  btnSalvarFinal: { flexDirection: 'row', backgroundColor: '#32CD32', padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30, marginBottom: 50 },
  txtSalvarFinal: { color: '#000', fontSize: 16, fontWeight: '900' },
});
