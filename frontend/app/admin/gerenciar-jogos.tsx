import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert, FlatList, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api'; 

interface Questao { id: string; texto: string; resposta: number; }
interface Missao {
  id: string; titulo: string; alvoTipo: string; alvoNome: string; alvoId: string;
  questoes: Questao[];
  recompensa: number; // Valor em pontos
  vidas: number;      // Quantidade de vidas
}

export default function GerenciarJogosAdmin() {
  const router = useRouter();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [listaTurmas, setListaTurmas] = useState<any[]>([]);
  const [listaAlunos, setListaAlunos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // Modal e Inputs
  const [modalVisivel, setModalVisivel] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [pontos, setPontos] = useState(''); 
  const [vidas, setVidas] = useState('');   
  const [alvoTipo, setAlvoTipo] = useState<'GERAL' | 'TURMA' | 'INDIVIDUAL'>('GERAL');
  const [alvoSel, setAlvoSel] = useState<{id: string, nome: string} | null>(null);
  
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [inConta, setInConta] = useState('');
  const [inResp, setInResp] = useState('');
  const [modalSelVisivel, setModalSelVisivel] = useState(false);

  useEffect(() => { carregar(); }, []);
  
  const carregar = async () => {
    setCarregando(true);
    try {
      const dados = await api.getJogosPersonalizados();
      if(dados) setMissoes(dados);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível carregar os jogos.");
    } finally {
      setCarregando(false);
    }
  };

  const carregarAlvos = async () => {
    const t = await api.getTurmas(); setListaTurmas(t || []);
    const u = await api.getUsuarios(); setListaAlunos(u?.filter((x:any)=>x.perfil==='ALUNO') || []);
  };

  const addQuestao = () => {
    if(!inConta || !inResp) return Alert.alert('Aviso', 'Preencha a conta e a resposta');
    let txt = inConta.replace(/\s/g, '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/\^/g, '^');
    setQuestoes([...questoes, { id: Math.random().toString(), texto: txt, resposta: parseInt(inResp) }]);
    setInConta(''); setInResp('');
  };

  const salvar = async () => {
    if(!titulo || questoes.length===0) return Alert.alert('Erro', 'Título e questões são obrigatórios');
    if(alvoTipo!=='GERAL' && !alvoSel) return Alert.alert('Erro', 'Selecione o alvo do jogo');
    if(!pontos || !vidas) return Alert.alert('Erro', 'Defina Pontos e Vidas');

    setSalvando(true);
    try {
      const nova = {
        titulo,
        alvoTipo,
        alvoNome: alvoTipo==='GERAL' ? 'Todos' : alvoSel!.nome,
        alvoId: alvoTipo==='GERAL' ? 'all' : alvoSel!.id,
        questoes,
        recompensa: parseInt(pontos),
        vidas: parseInt(vidas),
        criadoEm: new Date().toISOString()
      };

      await api.criarJogo(nova);
      
      // Somente faz isso se salvou com sucesso
      Alert.alert('Sucesso', 'Jogo Publicado!', [
        { 
          text: 'OK', 
          onPress: () => {
            setModalVisivel(false);
            limparForm();
            carregar(); // Recarrega a lista instantaneamente
          } 
        }
      ]);
    } catch (error) {
      console.log("Erro ao salvar jogo:", error);
      Alert.alert('Falha ao Salvar', 'Ocorreu um erro ao comunicar com o servidor.');
    } finally {
      setSalvando(false);
    }
  };

  const limparForm = () => {
    setTitulo(''); setPontos(''); setVidas(''); setQuestoes([]); setAlvoTipo('GERAL'); setAlvoSel(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#FFD700" /></TouchableOpacity>
        <Text style={styles.title}>Gerenciar Jogos</Text>
      </View>

      {carregando && <ActivityIndicator size="large" color="#FFD700" style={{marginTop: 20}} />}

      <ScrollView contentContainerStyle={{padding: 16}}>
        <TouchableOpacity style={styles.btnNew} onPress={() => { setModalVisivel(true); carregarAlvos(); }}>
          <Ionicons name="add-circle" size={24} color="#000" />
          <Text style={styles.btnNewTxt}>CRIAR NOVO JOGO</Text>
        </TouchableOpacity>

        {!carregando && missoes.length === 0 && (
          <Text style={{color: '#888', textAlign: 'center', marginTop: 20}}>Nenhum jogo criado ainda.</Text>
        )}

        {missoes.map(m => (
          <View key={m.id} style={styles.card}>
            <View style={{flex:1}}>
              <Text style={styles.cardTitle}>{m.titulo}</Text>
              <Text style={styles.cardSub}>{m.alvoNome} • {m.questoes.length} Questões</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}><Text style={styles.badgeTxt}>{m.vidas} ❤️</Text></View>
                <View style={styles.badge}><Text style={styles.badgeTxt}>{m.recompensa} pts</Text></View>
              </View>
            </View>
            <TouchableOpacity onPress={async ()=>{ await api.deletarJogo(m.id); carregar(); }}>
              <Ionicons name="trash" size={20} color="#FF4444" />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* MODAL CRIAR */}
      <Modal visible={modalVisivel} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Jogo</Text>
            <TouchableOpacity onPress={() => setModalVisivel(false)}><Ionicons name="close" size={28} color="#FF4444"/></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{padding: 20}}>
            
            <Text style={styles.label}>1. Configurações:</Text>
            <TextInput style={styles.input} placeholder="Título do Jogo" placeholderTextColor="#666" value={titulo} onChangeText={setTitulo} />
            
            <View style={{flexDirection:'row', gap:10, marginTop:10}}>
              <View style={{flex:1}}>
                <Text style={styles.miniLabel}>Vidas:</Text>
                <TextInput style={styles.input} placeholder="Ex: 3" keyboardType="numeric" placeholderTextColor="#666" value={vidas} onChangeText={setVidas} />
              </View>
              <View style={{flex:1}}>
                <Text style={styles.miniLabel}>Pontos:</Text>
                <TextInput style={styles.input} placeholder="Ex: 500" keyboardType="numeric" placeholderTextColor="#666" value={pontos} onChangeText={setPontos} />
              </View>
            </View>

            <Text style={styles.label}>2. Para quem?</Text>
            <View style={{flexDirection:'row', gap:8, marginBottom:10}}>
              {['GERAL','TURMA','INDIVIDUAL'].map((t:any) => (
                <TouchableOpacity key={t} style={[styles.btnSeg, alvoTipo===t && styles.btnSegAtivo]} onPress={()=>{setAlvoTipo(t); setAlvoSel(null);}}>
                  <Text style={{color: alvoTipo===t?'#000':'#666', fontWeight:'bold', fontSize:11}}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {alvoTipo!=='GERAL' && (
              <TouchableOpacity style={styles.input} onPress={()=>setModalSelVisivel(true)}>
                <Text style={{color: alvoSel?'#fff':'#666'}}>{alvoSel?alvoSel.nome:'Selecionar...'}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>3. Questões:</Text>
            <View style={styles.boxQ}>
              <TextInput style={[styles.input, {marginBottom:10}]} placeholder="Conta (ex: 2^3)" placeholderTextColor="#666" value={inConta} onChangeText={setInConta} />
              <TextInput style={[styles.input, {marginBottom:10}]} placeholder="Resposta (ex: 8)" keyboardType="numeric" placeholderTextColor="#666" value={inResp} onChangeText={setInResp} />
              <TouchableOpacity style={styles.btnAdd} onPress={addQuestao}><Text style={styles.btnAddTxt}>ADICIONAR</Text></TouchableOpacity>
            </View>

            {questoes.map((q,i) => (
              <View key={q.id} style={styles.itemQ}>
                <Text style={{color:'#fff'}}>{i+1}. {q.texto} = <Text style={{color:'#32CD32'}}>{q.resposta}</Text></Text>
                <TouchableOpacity onPress={()=>setQuestoes(questoes.filter(x=>x.id!==q.id))}><Ionicons name="trash" size={18} color="#FF4444"/></TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[styles.btnSave, salvando && {opacity: 0.6}]} onPress={salvar} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#000" /> : <Text style={styles.btnSaveTxt}>PUBLICAR JOGO</Text>}
            </TouchableOpacity>
            <View style={{height:50}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL SELEÇÃO */}
      <Modal visible={modalSelVisivel} transparent>
        <View style={styles.overlay}>
          <View style={styles.selBox}>
            <FlatList 
              data={alvoTipo==='TURMA'?listaTurmas:listaAlunos}
              keyExtractor={(i:any)=>i.id}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.selItem} onPress={()=>{setAlvoSel(item); setModalSelVisivel(false);}}>
                  <Text style={{color:'#fff'}}>{item.nome}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={{padding:15, alignItems:'center'}} onPress={()=>setModalSelVisivel(false)}><Text style={{color:'#FF4444'}}>Fechar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex:1, backgroundColor:'#0a0a0a'},
  header: {padding:20, flexDirection:'row', alignItems:'center', gap:15, borderBottomWidth:1, borderColor:'#222'},
  title: {color:'#FFD700', fontSize:20, fontWeight:'bold'},
  btnNew: {backgroundColor:'#FFD700', padding:15, borderRadius:10, flexDirection:'row', justifyContent:'center', alignItems:'center', gap:10, marginBottom:20},
  btnNewTxt: {fontWeight:'900'},
  card: {backgroundColor:'#1a1a2e', padding:15, borderRadius:12, marginBottom:10, flexDirection:'row', alignItems:'center', justifyContent:'space-between'},
  cardTitle: {color:'#fff', fontWeight:'bold', fontSize:16},
  cardSub: {color:'#888', fontSize:12, marginBottom:5},
  badgeRow: {flexDirection:'row', gap:8},
  badge: {backgroundColor:'#333', paddingHorizontal:8, paddingVertical:2, borderRadius:4},
  badgeTxt: {color:'#FFD700', fontSize:10, fontWeight:'bold'},
  
  modal: {flex:1, backgroundColor:'#0a0a0a'},
  modalHeader: {padding:20, flexDirection:'row', justifyContent:'space-between', borderBottomWidth:1, borderColor:'#222'},
  modalTitle: {color:'#fff', fontSize:20, fontWeight:'bold'},
  label: {color:'#FFD700', marginTop:20, marginBottom:10, fontWeight:'bold'},
  miniLabel: {color:'#888', fontSize:12, marginBottom:5},
  input: {backgroundColor:'#1a1a2e', color:'#fff', padding:12, borderRadius:8, borderWidth:1, borderColor:'#333'},
  btnSeg: {flex:1, padding:10, backgroundColor:'#1a1a2e', borderRadius:6, alignItems:'center', borderWidth:1, borderColor:'#333'},
  btnSegAtivo: {backgroundColor:'#FFD700', borderColor:'#FFD700'},
  boxQ: {backgroundColor:'#1a1a2e', padding:15, borderRadius:10, borderWidth:1, borderColor:'#333'},
  btnAdd: {backgroundColor:'#333', padding:10, borderRadius:6, alignItems:'center'},
  btnAddTxt: {color:'#fff', fontWeight:'bold'},
  itemQ: {flexDirection:'row', justifyContent:'space-between', padding:15, borderBottomWidth:1, borderColor:'#222'},
  btnSave: {backgroundColor:'#32CD32', padding:15, borderRadius:10, alignItems:'center', marginTop:30},
  btnSaveTxt: {fontWeight:'900', fontSize:16},
  
  overlay: {flex:1, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'center', alignItems:'center'},
  selBox: {width:'80%', maxHeight:'60%', backgroundColor:'#1a1a2e', borderRadius:10},
  selItem: {padding:15, borderBottomWidth:1, borderColor:'#333'}
});
