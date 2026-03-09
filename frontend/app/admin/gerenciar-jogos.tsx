import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, Alert, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api'; 

interface Questao { id: string; texto: string; resposta: number; }
interface Missao {
  id: string; titulo: string; alvoTipo: string; alvoNome: string; alvoId: string;
  questoes: Questao[]; recompensa: number; vidas: number; expiraEm: string; limiteTentativas: number;
}

export default function GerenciarJogosAdmin() {
  const router = useRouter();
  const [missoes, setMissoes] = useState<Missao[]>([]);
  const [listaTurmas, setListaTurmas] = useState<any[]>([]);
  const [listaAlunos, setListaAlunos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // Modal Criar
  const [modalVisivel, setModalVisivel] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [pontos, setPontos] = useState(''); 
  const [vidas, setVidas] = useState('');   
  const [limiteTentativas, setLimiteTentativas] = useState('1'); 
  const [alvoTipo, setAlvoTipo] = useState<'GERAL' | 'TURMA' | 'INDIVIDUAL'>('GERAL');
  const [alvoSel, setAlvoSel] = useState<{id: string, nome: string} | null>(null);
  
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [inConta, setInConta] = useState('');
  const [inResp, setInResp] = useState('');
  
  // Modal Selecionar e Reenviar
  const [modalSelVisivel, setModalSelVisivel] = useState(false);
  const [modalReenviar, setModalReenviar] = useState(false);
  const [missaoReenviar, setMissaoReenviar] = useState<Missao | null>(null);

  useEffect(() => { 
    carregar(); 
    carregarAlvos(); 
  }, []);
  
  const carregar = async () => {
    setCarregando(true);
    try {
      const dados = await api.getJogosPersonalizados();
      if(dados) setMissoes(dados);
    } catch (e) {
      console.error(e);
    } finally { 
      setCarregando(false); 
    }
  };

  const carregarAlvos = async () => {
    const t = await api.getTurmas(); 
    setListaTurmas(t || []);
    const u = await api.getUsuarios(); 
    setListaAlunos(u?.filter((x:any)=>x.perfil==='ALUNO') || []);
  };

  const addQuestao = () => {
    if(!inConta || !inResp) return Alert.alert('Aviso', 'Preencha a conta e a resposta');
    let txt = inConta.replace(/\s/g, '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/\^/g, '^');
    setQuestoes([...questoes, { id: Math.random().toString(), texto: txt, resposta: parseInt(inResp) }]);
    setInConta(''); 
    setInResp('');
  };

  const salvar = async () => {
    if(!titulo || questoes.length===0) return Alert.alert('Erro', 'Título e questões obrigatórios');
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
        limiteTentativas: parseInt(limiteTentativas || '0'),
      };
      await api.criarJogo(nova);
      Alert.alert('Sucesso', 'Jogo Publicado por 24 horas!', [
        { text: 'OK', onPress: () => { setModalVisivel(false); limparForm(); carregar(); } }
      ]);
    } catch (e) { 
      Alert.alert('Falha', 'Erro ao salvar jogo.'); 
    } finally { 
      setSalvando(false); 
    }
  };

  const reenviar = async () => {
    if(alvoTipo!=='GERAL' && !alvoSel) return Alert.alert('Erro', 'Selecione o alvo para reenviar');
    setSalvando(true);
    try {
      await api.reenviarJogo(missaoReenviar!.id, {
        alvoTipo,
        alvoNome: alvoTipo==='GERAL' ? 'Todos' : alvoSel!.nome,
        alvoId: alvoTipo==='GERAL' ? 'all' : alvoSel!.id,
      });
      Alert.alert('Sucesso', 'Jogo reenviado! Validade de +24h.', [
        { text: 'OK', onPress: () => { setModalReenviar(false); carregar(); } }
      ]);
    } catch (e) { 
      Alert.alert('Falha', 'Erro ao reenviar.'); 
    } finally { 
      setSalvando(false); 
    }
  };

  const limparForm = () => { 
    setTitulo(''); setPontos(''); setVidas(''); setLimiteTentativas('1'); setQuestoes([]); setAlvoTipo('GERAL'); setAlvoSel(null); 
  };

  const abrirReenviar = (m: Missao) => {
    setMissaoReenviar(m); 
    setAlvoTipo('GERAL'); 
    setAlvoSel(null); 
    setModalReenviar(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Jogos</Text>
      </View>

      {carregando && <ActivityIndicator size="large" color="#FFD700" style={{marginTop: 20}} />}

      <ScrollView contentContainerStyle={{padding: 16}}>
        <TouchableOpacity style={styles.btnNew} onPress={() => { limparForm(); setModalVisivel(true); }}>
          <Ionicons name="add-circle" size={24} color="#000" />
          <Text style={styles.btnNewTxt}>CRIAR NOVO JOGO</Text>
        </TouchableOpacity>

        {missoes.map(m => {
          const expirado = m.expiraEm ? new Date(m.expiraEm) < new Date() : false;
          return (
            <View key={m.id} style={styles.card}>
              <View style={{flex:1}}>
                <Text style={styles.cardTitle}>
                  {m.titulo} <Text style={{color: expirado ? '#FF4444' : '#32CD32', fontSize: 12}}>({expirado ? '🔴 Expirado' : '🟢 Ativo'})</Text>
                </Text>
                <Text style={styles.cardSub}>{m.alvoNome} • {m.questoes.length} Questões</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}><Text style={styles.badgeTxt}>{m.vidas} ❤️</Text></View>
                  <View style={styles.badge}><Text style={styles.badgeTxt}>{m.recompensa} pts</Text></View>
                  <View style={styles.badge}><Text style={styles.badgeTxt}>Tents: {m.limiteTentativas===0?'Ilimitado':m.limiteTentativas}</Text></View>
                </View>
              </View>
              <View style={{flexDirection: 'row', gap: 15, alignItems: 'center'}}>
                <TouchableOpacity onPress={() => abrirReenviar(m)}>
                  <Ionicons name="refresh-circle" size={28} color="#4169E1" />
                </TouchableOpacity>
                <TouchableOpacity onPress={async ()=>{ await api.deletarJogo(m.id); carregar(); }}>
                  <Ionicons name="trash" size={24} color="#FF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* MODAL CRIAR */}
      <Modal visible={modalVisivel} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Novo Jogo (Vale 24h)</Text>
            <TouchableOpacity onPress={() => setModalVisivel(false)}>
              <Ionicons name="close" size={28} color="#FF4444"/>
            </TouchableOpacity>
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
            
            <View style={{marginTop:10}}>
              <Text style={styles.miniLabel}>Quantas vezes o aluno pode jogar? (0 = Ilimitado)</Text>
              <TextInput style={styles.input} placeholder="Padrão: 1" keyboardType="numeric" placeholderTextColor="#666" value={limiteTentativas} onChangeText={setLimiteTentativas} />
            </View>

            <Text style={styles.label}>2. Para quem?</Text>
            <View style={{flexDirection:'row', gap:8, marginBottom:10}}>
              {['GERAL','TURMA','INDIVIDUAL'].map((t:any) => (
                <TouchableOpacity key={t} style={[styles.btnSeg, alvoTipo===t && styles.btnSegAtivo]} onPress={()=>{setAlvoTipo(t); setAlvoSel(null);}}>
                  <Text style={{color: alvoTipo===t?'#000':'#666', fontWeight:'bold', fontSize:11}}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {alvoTipo !== 'GERAL' && (
              <TouchableOpacity style={styles.input} onPress={()=>setModalSelVisivel(true)}>
                <Text style={{color: alvoSel?'#fff':'#666'}}>{alvoSel ? alvoSel.nome : 'Selecionar...'}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>3. Questões:</Text>
            <View style={styles.boxQ}>
              <TextInput style={[styles.input, {marginBottom:10}]} placeholder="Conta (ex: 2^3)" placeholderTextColor="#666" value={inConta} onChangeText={setInConta} />
              <TextInput style={[styles.input, {marginBottom:10}]} placeholder="Resposta (ex: 8)" keyboardType="numeric" placeholderTextColor="#666" value={inResp} onChangeText={setInResp} />
              <TouchableOpacity style={styles.btnAdd} onPress={addQuestao}>
                <Text style={styles.btnAddTxt}>ADICIONAR</Text>
              </TouchableOpacity>
            </View>

            {questoes.map((q,i) => (
              <View key={q.id} style={styles.itemQ}>
                <Text style={{color:'#fff'}}>
                  {i+1}. {q.texto} = <Text style={{color:'#32CD32'}}>{q.resposta}</Text>
                </Text>
                <TouchableOpacity onPress={()=>setQuestoes(questoes.filter(x=>x.id!==q.id))}>
                  <Ionicons name="trash" size={18} color="#FF4444"/>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[styles.btnSave, salvando && {opacity: 0.6}]} onPress={salvar} disabled={salvando}>
              {salvando ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnSaveTxt}>PUBLICAR JOGO</Text>
              )}
            </TouchableOpacity>
            <View style={{height:50}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL REENVIAR */}
      <Modal visible={modalReenviar} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.selBox, {padding: 20}]}>
            <Text style={styles.modalTitle}>Reenviar Jogo</Text>
            <Text style={{color: '#888', marginBottom: 15, fontSize: 12}}>
              Para quem você quer enviar o jogo "{missaoReenviar?.titulo}"?
            </Text>
            
            <View style={{flexDirection:'row', gap:8, marginBottom:10}}>
              {['GERAL','TURMA','INDIVIDUAL'].map((t:any) => (
                <TouchableOpacity key={t} style={[styles.btnSeg, alvoTipo===t && styles.btnSegAtivo]} onPress={()=>{setAlvoTipo(t); setAlvoSel(null);}}>
                  <Text style={{color: alvoTipo===t?'#000':'#666', fontWeight:'bold', fontSize:11}}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {alvoTipo !== 'GERAL' && (
              <TouchableOpacity style={styles.input} onPress={()=>setModalSelVisivel(true)}>
                <Text style={{color: alvoSel?'#fff':'#666'}}>{alvoSel ? alvoSel.nome : 'Selecionar...'}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={[styles.btnSave, {marginTop: 20}]} onPress={reenviar} disabled={salvando}>
              {salvando ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnSaveTxt}>REENVIAR</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={{padding:15, alignItems:'center'}} onPress={()=>setModalReenviar(false)}>
              <Text style={{color:'#FF4444'}}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL SELEÇÃO (Alunos/Turmas) */}
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
            <TouchableOpacity style={{padding:15, alignItems:'center'}} onPress={()=>setModalSelVisivel(false)}>
              <Text style={{color:'#FF4444'}}>Fechar</Text>
            </TouchableOpacity>
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
  badgeRow: {flexDirection:'row', gap:8, marginTop: 4}, 
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
