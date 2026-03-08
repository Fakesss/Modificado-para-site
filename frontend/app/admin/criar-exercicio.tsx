import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';

const ALTERNATIVA_CORES = [
  { letra: 'A', cor: '#E74C3C' }, { letra: 'B', cor: '#F39C12' },
  { letra: 'C', cor: '#27AE60' }, { letra: 'D', cor: '#3498DB' }
];

export default function CriarExercicio() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontuacaoTotal, setPontuacaoTotal] = useState('10');
  const [habilidadesBNCC, setHabilidadesBNCC] = useState('');
  
  // Destinatários
  const [turmas, setTurmas] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [tipoDestinatario, setTipoDestinatario] = useState<'TURMA' | 'EQUIPE' | 'ALUNO'>('TURMA');
  const [destinatarioId, setDestinatarioId] = useState('');

  const [questoes, setQuestoes] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [id]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      const [t, e, u] = await Promise.all([
        api.getTurmas(),
        api.getEquipes(),
        api.getUsuarios()
      ]);
      setTurmas(t || []);
      setEquipes(e || []);
      setAlunos(u || []);

      if (isEditing) {
        const ex = await api.getExercicio(id as string);
        if (ex) {
          setTitulo(ex.titulo);
          setDescricao(ex.descricao || '');
          setHabilidadesBNCC(ex.habilidadesBNCC?.join(', ') || '');
          
          if (ex.turmaId) { setTipoDestinatario('TURMA'); setDestinatarioId(ex.turmaId); }
          else if (ex.equipeId) { setTipoDestinatario('EQUIPE'); setDestinatarioId(ex.equipeId); }
          else if (ex.alunoId) { setTipoDestinatario('ALUNO'); setDestinatarioId(ex.alunoId); }
          
          if (ex.questoes && ex.questoes.length > 0) {
            setQuestoes(ex.questoes.map((q: any) => ({
              ...q,
              alternativas: q.tipoResposta === 'MULTIPLA_ESCOLHA' 
                ? q.alternativas.map((alt: any) => ({
                    ...alt,
                    cor: ALTERNATIVA_CORES.find(c => c.letra === alt.letra)?.cor || '#999'
                  }))
                : ALTERNATIVA_CORES.map(c => ({ letra: c.letra, texto: '', cor: c.cor }))
            })));
            
            // Recalcula pontuação total visual
            const totalPts = ex.questoes.reduce((acc: number, q: any) => acc + (q.pontuacaoMax || 0), 0);
            setPontuacaoTotal(totalPts.toString());
          }
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert("Erro", "Falha ao carregar dados.");
    } finally {
      setLoadingData(false);
    }
  };

  const addQuestao = () => {
    setQuestoes([...questoes, {
      id: Date.now().toString(),
      numero: questoes.length + 1,
      tipoResposta: 'MULTIPLA_ESCOLHA',
      enunciado: '',
      alternativas: ALTERNATIVA_CORES.map(c => ({ letra: c.letra, texto: '', cor: c.cor })),
      correta: ''
    }]);
  };

  const handleSave = async () => {
    if (!titulo) return Alert.alert("Erro", "Título obrigatório");
    if (questoes.length === 0) return Alert.alert("Erro", "Adicione questões");

    setLoading(true);
    try {
      const pts = parseFloat(pontuacaoTotal) || 10;
      const ptsPorQ = pts / questions.length;
      
      const payload = {
        titulo,
        descricao,
        habilidadesBNCC: habilidadesBNCC.split(',').map(s => s.trim()).filter(Boolean),
        turmaId: tipoDestinatario === 'TURMA' && destinatarioId ? destinatarioId : null,
        equipeId: tipoDestinatario === 'EQUIPE' && destinatarioId ? destinatarioId : null,
        alunoId: tipoDestinatario === 'ALUNO' && destinatarioId ? destinatarioId : null,
        pontosPorQuestao: ptsPorQ,
        questoes: questoes.map((q, i) => ({
          numero: i + 1,
          tipoResposta: q.tipoResposta,
          enunciado: q.enunciado,
          correta: q.correta,
          pontuacaoMax: ptsPorQ,
          alternativas: q.tipoResposta === 'MULTIPLA_ESCOLHA' 
            ? q.alternativas.map((a: any) => ({ letra: a.letra, texto: a.texto })) 
            : [],
          habilidadesBNCC: habilidadesBNCC.split(',').map(s => s.trim()).filter(Boolean)
        }))
      };

      if (isEditing) {
        await api.updateExercicio(id as string, payload);
        Alert.alert("Sucesso", "Exercício atualizado!", [{ text: "OK", onPress: () => router.back() }]);
      } else {
        await api.createExercicio(payload);
        Alert.alert("Sucesso", "Exercício criado!", [{ text: "OK", onPress: () => router.back() }]);
      }
    } catch (error: any) {
      Alert.alert("Erro ao Salvar", error.message || "Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  // ... (Mantenha o resto do seu render igual, usando as variáveis acima)
  // Vou colocar apenas a estrutura principal para caber na resposta
  
  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={loading} transparent><View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#FFD700" /></View></Modal>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={router.back}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? "Editar" : "Novo"} Exercício</Text>
        <TouchableOpacity onPress={handleSave}><Ionicons name="checkmark" size={28} color="#FFD700" /></TouchableOpacity>
      </View>

      {loadingData ? <ActivityIndicator style={{marginTop: 50}} color="#FFD700" /> : (
        <ScrollView style={{padding: 16}}>
          <Text style={styles.label}>Título</Text>
          <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholderTextColor="#666" placeholder="Ex: Equações" />
          
          <Text style={styles.label}>Pontuação Total</Text>
          <TextInput style={styles.input} value={pontuacaoTotal} onChangeText={setPontuacaoTotal} keyboardType="numeric" />

          <Text style={styles.label}>Destinatário</Text>
          <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
            {['TURMA', 'EQUIPE', 'ALUNO'].map(t => (
              <TouchableOpacity key={t} onPress={() => { setTipoDestinatario(t as any); setDestinatarioId(''); }} 
                style={[styles.chip, tipoDestinatario === t && styles.chipActive]}>
                <Text style={{color: tipoDestinatario === t ? '#000' : '#fff'}}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView horizontal style={{marginBottom: 20}}>
            <TouchableOpacity onPress={() => setDestinatarioId('')} style={[styles.chip, !destinatarioId && styles.chipActive]}><Text>Geral</Text></TouchableOpacity>
            {(tipoDestinatario === 'TURMA' ? turmas : tipoDestinatario === 'EQUIPE' ? equipes : alunos).map((item: any) => (
              <TouchableOpacity key={item.id} onPress={() => setDestinatarioId(item.id)} 
                style={[styles.chip, destinatarioId === item.id && styles.chipActive]}>
                <Text style={{color: destinatarioId === item.id ? '#000' : '#fff'}}>{item.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
            <Text style={styles.sectionTitle}>Questões ({questoes.length})</Text>
            <TouchableOpacity onPress={addQuestao} style={styles.btnAdd}><Text style={{color:'#000'}}>+ Adicionar</Text></TouchableOpacity>
          </View>

          {questoes.map((q, i) => (
            <View key={i} style={styles.card}>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={{color:'#FFD700', fontWeight:'bold'}}>Questão {q.numero}</Text>
                <TouchableOpacity onPress={() => {
                   const n = [...questoes]; n.splice(i, 1);
                   setQuestoes(n.map((x, idx) => ({...x, numero: idx+1})));
                }}><Ionicons name="trash" size={20} color="red"/></TouchableOpacity>
              </View>
              
              <TextInput style={[styles.input, {height:60, marginTop:10}]} multiline value={q.enunciado} 
                onChangeText={t => {const n=[...questoes]; n[i].enunciado=t; setQuestoes(n)}} placeholder="Enunciado" placeholderTextColor="#555"/>

              <View style={{flexDirection:'row', marginVertical:10}}>
                 <TouchableOpacity onPress={() => {const n=[...questoes]; n[i].tipoResposta='MULTIPLA_ESCOLHA'; setQuestoes(n)}} 
                   style={[styles.chip, q.tipoResposta==='MULTIPLA_ESCOLHA' && styles.chipActive]}><Text>Múltipla</Text></TouchableOpacity>
                 <TouchableOpacity onPress={() => {const n=[...questoes]; n[i].tipoResposta='TEXTO'; setQuestoes(n)}} 
                   style={[styles.chip, q.tipoResposta==='TEXTO' && styles.chipActive, {marginLeft:10}]}><Text>Texto</Text></TouchableOpacity>
              </View>

              {q.tipoResposta === 'MULTIPLA_ESCOLHA' ? q.alternativas.map((alt: any, idx: number) => (
                <View key={idx} style={{flexDirection:'row', alignItems:'center', marginBottom:5}}>
                  <TouchableOpacity onPress={() => {const n=[...questoes]; n[i].correta=alt.letra; setQuestoes(n)}} 
                    style={{width:30, height:30, borderRadius:15, backgroundColor: alt.cor, alignItems:'center', justifyContent:'center', borderWidth: q.correta===alt.letra?2:0, borderColor:'#fff'}}>
                    <Text style={{fontWeight:'bold'}}>{alt.letra}</Text>
                  </TouchableOpacity>
                  <TextInput style={[styles.input, {flex:1, marginLeft:10, marginBottom:0}]} value={alt.texto} 
                    onChangeText={t => {const n=[...questoes]; n[i].alternativas[idx].texto=t; setQuestoes(n)}} placeholder={`Opção ${alt.letra}`} placeholderTextColor="#555"/>
                </View>
              )) : (
                <TextInput style={styles.input} value={q.correta} onChangeText={t => {const n=[...questoes]; n[i].correta=t; setQuestoes(n)}} placeholder="Resposta Correta" placeholderTextColor="#555"/>
              )}
            </View>
          ))}
          <View style={{height:50}}/>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: '#151520' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  label: { color: '#888', fontSize: 12, marginTop: 10, marginBottom: 5, textTransform: 'uppercase' },
  input: { backgroundColor: '#1a1a2e', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333', marginRight: 8 },
  chipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  card: { backgroundColor: '#151520', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  btnAdd: { backgroundColor: '#FFD700', padding: 8, borderRadius: 6 },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }
});
