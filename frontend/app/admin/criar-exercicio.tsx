import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { useTema, CoresTema, textoSobre } from '../../src/context/ThemeContext';

const ALTERNATIVA_CORES = [
  { letra: 'A', cor: '#E74C3C' }, // Vermelho
  { letra: 'B', cor: '#F39C12' }, // Laranja
  { letra: 'C', cor: '#27AE60' }, // Verde
  { letra: 'D', cor: '#4169E1' }, // Azul
  { letra: 'E', cor: '#9B59B6' }  // Roxo
];

export default function CriarExercicio() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // Formulário Geral
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontuacaoTotal, setPontuacaoTotal] = useState('10');
  const [habilidadesBNCC, setHabilidadesBNCC] = useState(''); // Geral
  
  // Destinatários
  const [turmas, setTurmas] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [alunos, setAlunos] = useState<any[]>([]);
  
  // Controle de Seleção
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
        api.getEquipes().catch(() => []),
        api.getUsuarios().catch(() => [])
      ]);
      setTurmas(t || []);
      setEquipes(e || []);
      setAlunos(u || []);

      if (isEditing) {
        const ex = await api.getExercicio(id as string);
        if (ex) {
          setTitulo(ex.titulo);
          setDescricao(ex.descricao || '');
          setHabilidadesBNCC(Array.isArray(ex.habilidadesBNCC) ? ex.habilidadesBNCC.join(', ') : ex.habilidadesBNCC || '');
          
          if (ex.turmaId) { setTipoDestinatario('TURMA'); setDestinatarioId(ex.turmaId); }
          else if (ex.equipeId) { setTipoDestinatario('EQUIPE'); setDestinatarioId(ex.equipeId); }
          else if (ex.alunoId) { setTipoDestinatario('ALUNO'); setDestinatarioId(ex.alunoId); }
          else { setTipoDestinatario('TURMA'); setDestinatarioId(''); } // Geral
          
          if (ex.questoes && ex.questoes.length > 0) {
            const questoesFormatadas = ex.questoes.map((q: any) => ({
              ...q,
              id: q.id || Math.random().toString(),
              habilidadeBNCC: Array.isArray(q.habilidadesBNCC) ? q.habilidadesBNCC.join(', ') : (q.habilidadeBNCC || ''),
              alternativas: q.tipoResposta === 'MULTIPLA_ESCOLHA' 
                ? (q.alternativas || []).map((alt: any) => ({
                    ...alt,
                    cor: alt.cor || ALTERNATIVA_CORES.find(c => c.letra === alt.letra)?.cor || cores.textoFraco
                  }))
                : ALTERNATIVA_CORES.slice(0, 4).map(c => ({ letra: c.letra, texto: '', cor: c.cor }))
            }));
            
            setQuestoes(questoesFormatadas);
            
            const totalPts = ex.questoes.reduce((acc: number, q: any) => acc + (Number(q.pontuacaoMax) || 0), 0);
            if (totalPts > 0) setPontuacaoTotal(totalPts.toString());
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
      habilidadeBNCC: '',
      alternativas: ALTERNATIVA_CORES.slice(0, 4).map(c => ({ 
        letra: c.letra, 
        texto: '', 
        cor: c.cor
      })),
      correta: ''
    }]);
  };

  const removeQuestao = (index: number) => {
    const novas = questoes.filter((_, i) => i !== index);
    novas.forEach((q, i) => q.numero = i + 1);
    setQuestoes(novas);
  };

  const handleSave = async () => {
    if (!titulo.trim()) return Alert.alert("Erro", "O título é obrigatório");
    if (questoes.length === 0) return Alert.alert("Erro", "Adicione questões");

    for (const q of questoes) {
        if (!q.enunciado) return Alert.alert("Erro", `Questão ${q.numero} sem enunciado.`);
        if (q.tipoResposta === 'MULTIPLA_ESCOLHA' && !q.correta) return Alert.alert("Erro", `Questão ${q.numero} sem resposta correta.`);
        if (q.tipoResposta === 'TEXTO' && !q.correta) return Alert.alert("Erro", `Questão ${q.numero} sem gabarito.`);
    }

    setLoading(true);
    
    try {
      const pts = parseFloat(pontuacaoTotal.replace(',', '.')) || 10;
      
      // === CORREÇÃO AQUI: Usando 'questoes' (português) ao invés de 'questions' ===
      const valorPorQuestao = questoes.length > 0 ? (pts / questoes.length) : 0;
      
      const habilidadesGerais = habilidadesBNCC.split(',').map(s => s.trim()).filter(Boolean);

      const payload = {
        titulo,
        descricao,
        habilidadesBNCC: habilidadesGerais,
        turmaId: tipoDestinatario === 'TURMA' && destinatarioId ? destinatarioId : null,
        equipeId: tipoDestinatario === 'EQUIPE' && destinatarioId ? destinatarioId : null,
        alunoId: tipoDestinatario === 'ALUNO' && destinatarioId ? destinatarioId : null,
        pontosPorQuestao: valorPorQuestao,
        questoes: questoes.map((q, i) => ({
          numero: i + 1,
          tipoResposta: q.tipoResposta,
          enunciado: q.enunciado,
          correta: q.correta,
          pontuacaoMax: valorPorQuestao,
          habilidadesBNCC: q.habilidadeBNCC 
             ? q.habilidadeBNCC.split(',').map((s: string) => s.trim()).filter(Boolean)
             : habilidadesGerais,
          alternativas: q.tipoResposta === 'MULTIPLA_ESCOLHA' 
            ? q.alternativas.map((a: any) => ({ 
                letra: a.letra, 
                texto: a.texto,
                cor: a.cor 
              })) 
            : []
        }))
      };

      if (isEditing && id) {
        if ((api as any).updateExercicio) {
            await (api as any).updateExercicio(id as string, payload);
        } else {
            throw new Error("Função updateExercicio não encontrada");
        }
      } else {
        await api.createExercicio(payload);
      }

      setLoading(false);
      setTimeout(() => {
        Alert.alert("Sucesso", "Salvo com sucesso!", [
            { text: "OK", onPress: () => router.back() }
        ]);
      }, 500);

    } catch (error: any) {
      setLoading(false);
      console.error(error);
      const msg = error.response?.data?.detail || error.message || "Erro desconhecido";
      setTimeout(() => {
        Alert.alert("Erro ao Salvar", typeof msg === 'string' ? msg : JSON.stringify(msg));
      }, 500);
    }
  };

  const renderListaSelecao = () => {
    let dados: any[] = [];
    if (tipoDestinatario === 'TURMA') dados = turmas;
    else if (tipoDestinatario === 'EQUIPE') dados = equipes;
    else dados = alunos;

    if (dados.length === 0) return <Text style={styles.emptyListText}>Nenhum dado encontrado.</Text>;

    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
        <TouchableOpacity onPress={() => setDestinatarioId('')} style={[styles.chip, !destinatarioId && styles.chipActive]}>
            <Text style={{color: !destinatarioId ? cores.sobreAcento : cores.texto}}>Geral</Text>
        </TouchableOpacity>
        {dados.map((item: any) => (
            <TouchableOpacity key={item.id} onPress={() => setDestinatarioId(item.id)} 
            style={[styles.chip, destinatarioId === item.id && styles.chipActive]}>
            <Text style={{color: destinatarioId === item.id ? cores.sobreAcento : cores.texto}}>{item.nome || item.name}</Text>
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
                <ActivityIndicator size="large" color={cores.dourado} />
                <Text style={{color: cores.texto, marginTop:10}}>{isEditing ? "Atualizando..." : "Salvando..."}</Text>
            </View>
        </View>
      </Modal>
      
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={cores.texto} /></TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? "Editar" : "Novo"} Exercício</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
                <Ionicons name="checkmark" size={28} color={loading ? "#666" : "#FFD700"} />
            </TouchableOpacity>
        </View>

        {loadingData ? (
            <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
                <ActivityIndicator size="large" color={cores.dourado} />
                <Text style={{color:cores.textoFraco, marginTop:10}}>Carregando...</Text>
            </View>
        ) : (
            <ScrollView style={{padding: 16}} contentContainerStyle={{paddingBottom: 50}}>
            
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Dados Básicos</Text>
                
                <Text style={styles.label}>Título</Text>
                <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholderTextColor={cores.textoFraco} placeholder="Ex: Equações de 1º Grau" />
                
                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                    <View style={{flex:1, marginRight:10}}>
                        <Text style={styles.label}>Pontos Totais</Text>
                        <TextInput style={[styles.input, {textAlign:'center', color:cores.dourado, fontWeight:'bold'}]} 
                            value={pontuacaoTotal} onChangeText={setPontuacaoTotal} keyboardType="numeric" />
                    </View>
                    <View style={{flex:2}}>
                        <Text style={styles.label}>BNCC (Padrão)</Text>
                        <TextInput style={styles.input} value={habilidadesBNCC} onChangeText={setHabilidadesBNCC} placeholder="Ex: EF06MA01" placeholderTextColor={cores.textoFraco} />
                    </View>
                </View>

                <Text style={styles.label}>Descrição (Opcional)</Text>
                <TextInput style={[styles.input, {height:60}]} multiline value={descricao} onChangeText={setDescricao} placeholder="Instruções..." placeholderTextColor={cores.textoFraco} />

                <Text style={styles.label}>Enviar Para:</Text>
                <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                    {['TURMA', 'EQUIPE', 'ALUNO'].map(t => (
                    <TouchableOpacity key={t} onPress={() => { setTipoDestinatario(t as any); setDestinatarioId(''); }} 
                        style={[styles.chip, tipoDestinatario === t && styles.chipActive]}>
                        <Text style={{color: tipoDestinatario === t ? cores.sobreAcento : cores.texto, fontSize:12}}>{t}</Text>
                    </TouchableOpacity>
                    ))}
                </View>
                {renderListaSelecao()}
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10}}>
                <Text style={styles.sectionTitle}>Questões ({questoes.length})</Text>
                <TouchableOpacity onPress={addQuestao} style={styles.btnAdd}>
                    <Ionicons name="add" size={16} color={cores.sobreAcento}/>
                    <Text style={{color: cores.sobreAcento, fontWeight:'bold', marginLeft:4}}>Adicionar</Text>
                </TouchableOpacity>
            </View>

            {questoes.map((q, i) => (
                <View key={q.id || i} style={styles.card}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:10}}>
                    <View style={styles.badgeNumero}><Text style={{fontWeight:'bold'}}>{q.numero}</Text></View>
                    <TouchableOpacity onPress={() => removeQuestao(i)}><Ionicons name="trash" size={20} color={cores.erro}/></TouchableOpacity>
                </View>

                <Text style={styles.label}>Habilidade BNCC desta questão</Text>
                <TextInput 
                    style={[styles.input, {marginBottom:10}]} 
                    value={q.habilidadeBNCC} 
                    onChangeText={t => {const n=[...questoes]; n[i].habilidadeBNCC=t; setQuestoes(n)}} 
                    placeholder="Ex: EF06MA12 (Vazio = usa Padrão)" 
                    placeholderTextColor={cores.textoFraco} 
                />
                
                <Text style={styles.label}>Enunciado</Text>
                <TextInput style={[styles.input, {height:80, fontFamily: Platform.OS==='ios'?'Courier':'monospace'}]} multiline value={q.enunciado} 
                    onChangeText={t => {const n=[...questoes]; n[i].enunciado=t; setQuestoes(n)}} placeholder="Digite a pergunta..." placeholderTextColor={cores.textoFraco}/>

                <View style={{flexDirection:'row', marginVertical:10, backgroundColor: cores.superficieAlt, padding:2, borderRadius:8}}>
                    <TouchableOpacity onPress={() => {const n=[...questoes]; n[i].tipoResposta='MULTIPLA_ESCOLHA'; setQuestoes(n)}} 
                    style={[styles.switchOption, q.tipoResposta==='MULTIPLA_ESCOLHA' && styles.chipActive]}><Text style={{color: q.tipoResposta==='MULTIPLA_ESCOLHA'?cores.sobreAcento:cores.textoFraco, fontSize:12}}>Múltipla Escolha</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => {const n=[...questoes]; n[i].tipoResposta='TEXTO'; setQuestoes(n)}} 
                    style={[styles.switchOption, q.tipoResposta==='TEXTO' && styles.chipActive]}><Text style={{color: q.tipoResposta==='TEXTO'?cores.sobreAcento:cores.textoFraco, fontSize:12}}>Dissertativa</Text></TouchableOpacity>
                </View>

                {q.tipoResposta === 'MULTIPLA_ESCOLHA' ? q.alternativas.map((alt: any, idx: number) => (
                    <View key={idx} style={{flexDirection:'row', alignItems:'center', marginBottom:8}}>
                    <TouchableOpacity onPress={() => {const n=[...questoes]; n[i].correta=alt.letra; setQuestoes(n)}} 
                        style={{width:32, height:32, borderRadius:16, backgroundColor: alt.cor, alignItems:'center', justifyContent:'center', borderWidth: q.correta===alt.letra?2:0, borderColor: cores.texto}}>
                        <Text style={{fontWeight:'bold', color: textoSobre(alt.cor)}}>{alt.letra}</Text>
                    </TouchableOpacity>
                    <TextInput style={[styles.input, {flex:1, marginLeft:10, marginBottom:0, height:40}]} value={alt.texto} 
                        onChangeText={t => {const n=[...questoes]; n[i].alternativas[idx].texto=t; setQuestoes(n)}} placeholder={`Opção ${alt.letra}`} placeholderTextColor={cores.textoFraco}/>
                    </View>
                )) : (
                    <View>
                        <Text style={styles.label}>Resposta Esperada (Gabarito)</Text>
                        <TextInput style={styles.input} value={q.correta} onChangeText={t => {const n=[...questoes]; n[i].correta=t; setQuestoes(n)}} placeholder="Ex: 25" placeholderTextColor={cores.textoFraco}/>
                    </View>
                )}
                </View>
            ))}
            </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: cores.superficieAlt, borderBottomWidth:1, borderBottomColor:cores.superficieAlt },
  headerTitle: { color: cores.texto, fontSize: 18, fontWeight: 'bold' },
  section: { marginBottom: 20 },
  sectionTitle: { color: cores.texto, fontSize: 18, fontWeight: 'bold' },
  label: { color: cores.textoFraco, fontSize: 11, marginTop: 10, marginBottom: 5, textTransform: 'uppercase', letterSpacing:1 },
  input: { backgroundColor: cores.superficie, color: cores.texto, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: cores.borda, fontSize:15 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, marginRight: 8 },
  chipActive: { backgroundColor: cores.dourado, borderColor: cores.dourado },
  card: { backgroundColor: cores.superficieAlt, padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: cores.borda },
  btnAdd: { flexDirection:'row', alignItems:'center', backgroundColor: cores.dourado, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  badgeNumero: { width:24, height:24, borderRadius:12, backgroundColor:cores.dourado, alignItems:'center', justifyContent:'center' },
  switchOption: { flex:1, alignItems:'center', paddingVertical:8, borderRadius:6 },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { backgroundColor:cores.superficieAlt, padding:20, borderRadius:10, alignItems:'center' },
  emptyListText: { color: cores.textoFraco, fontStyle: 'italic' }
});
