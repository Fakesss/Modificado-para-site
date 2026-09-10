import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

export default function ModeracaoChat() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  
  // Etapas de navegação: 'lista_alunos' -> 'inbox_aluno' -> 'conversa'
  const [view, setView] = useState<'lista_alunos' | 'inbox_aluno' | 'conversa'>('lista_alunos');
  
  // Dados brutos
  const [todosUsuarios, setTodosUsuarios] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  
  // Dados de seleção
  const [alunoSelecionado, setAlunoSelecionado] = useState<any>(null); // Conta que o Admin assumiu a visão
  const [contatosNoInbox, setContatosNoInbox] = useState<any[]>([]); // Quem conversou com o aluno
  
  const [contatoSelecionado, setContatoSelecionado] = useState<any>(null); // Chat aberto
  const [mensagens, setMensagens] = useState<any[]>([]);
  
  // Edição
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [msgParaEditar, setMsgParaEditar] = useState<any>(null);
  const [novoTexto, setNovoTexto] = useState('');

  const [loading, setLoading] = useState(true);

  // 1. CARREGA TODOS OS USUÁRIOS
  useEffect(() => {
    const carregarUsuarios = async () => {
      try {
        const [users, trms, eqps] = await Promise.all([api.getUsuarios(), api.getTurmas(), api.getEquipes()]);
        setTurmas(trms);
        setEquipes(eqps);
        setTodosUsuarios(users);
      } catch (e) {}
      setLoading(false);
    };
    if (view === 'lista_alunos') carregarUsuarios();
  }, [view]);

  // 2. ENTRAR NO INBOX DO ALUNO SELECIONADO
  const abrirInbox = async (aluno: any) => {
    setLoading(true);
    setAlunoSelecionado(aluno);
    try {
      const inboxSummary = await api.adminGetInboxUsuario(aluno.id);
      
      const contatos = Object.keys(inboxSummary).map(contatoId => {
         const userRef = todosUsuarios.find(u => u.id === contatoId);
         return {
            id: contatoId,
            nome: userRef ? userRef.nome : 'Usuário Deletado',
            perfil: userRef ? userRef.perfil : 'DESCONHECIDO',
            lastMessageTime: inboxSummary[contatoId].lastMessageTime
         };
      });
      
      contatos.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
      setContatosNoInbox(contatos);
      setView('inbox_aluno');
    } catch(e) {}
    setLoading(false);
  };

  // 3. ABRIR UMA CONVERSA ESPECÍFICA
  const abrirConversa = async (contato: any) => {
    setLoading(true);
    setContatoSelecionado(contato);
    try {
      const msgs = await api.adminGetConversa(alunoSelecionado.id, contato.id);
      setMensagens(msgs);
      setView('conversa');
    } catch(e) {}
    setLoading(false);
  };

  // AÇÕES DE MODERAÇÃO
  const apagarMensagem = (id: string) => {
    if (Platform.OS === 'web') {
      if (window.confirm("Deseja realmente apagar esta mensagem da visão dos alunos?")) executarApagar(id);
    } else {
      Alert.alert("Atenção", "Deseja deletar o conteúdo desta mensagem para os alunos?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar", style: "destructive", onPress: () => executarApagar(id) }
      ]);
    }
  };

  const executarApagar = async (id: string) => {
      try {
        await api.adminApagarMensagem(id);
        const msgs = await api.adminGetConversa(alunoSelecionado.id, contatoSelecionado.id);
        setMensagens(msgs);
      } catch (e) { Alert.alert("Erro", "Falha ao apagar mensagem."); }
  };

  const iniciarEdicao = (msg: any) => {
      setMsgParaEditar(msg);
      setNovoTexto(msg.texto);
      setModalEditVisible(true);
  };

  const salvarEdicao = async () => {
      if (!msgParaEditar) return;
      try {
          await api.adminEditarMensagem(msgParaEditar.id, novoTexto);
          setModalEditVisible(false);
          const msgs = await api.adminGetConversa(alunoSelecionado.id, contatoSelecionado.id);
          setMensagens(msgs);
      } catch (e) { Alert.alert("Erro", "Falha ao editar a mensagem."); }
  };

  // DOWNLOAD DA CONVERSA
  const baixarConversa = async () => {
    let conteudo = `====================================================\n`;
    conteudo += `MODERAÇÃO - AUDITORIA DE CHAT\n`;
    conteudo += `CONVERSA ENTRE: ${alunoSelecionado.nome} e ${contatoSelecionado.nome}\n`;
    conteudo += `====================================================\n\n`;

    mensagens.forEach(m => {
        const remetente = m.remetenteId === alunoSelecionado.id ? alunoSelecionado.nome : contatoSelecionado.nome;
        const data = new Date(m.criadoEm).toLocaleString('pt-BR');
        const flagApagada = m.apagadaPorAdmin ? " [APAGADA PELA MODERAÇÃO]" : "";
        const flagEditada = m.editadaPorAdmin ? " [EDITADA PELA MODERAÇÃO]" : "";
        conteudo += `[${data}] ${remetente}${flagApagada}${flagEditada}:\n${m.texto}\n\n`;
    });

    if (Platform.OS === 'web') {
        const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Auditoria_${alunoSelecionado.nome}_${contatoSelecionado.nome}.txt`;
        link.click();
    } else {
        try {
            const fileUri = FileSystem.documentDirectory + `Auditoria_Chat.txt`;
            await FileSystem.writeAsStringAsync(fileUri, conteudo);
            await Sharing.shareAsync(fileUri);
        } catch(e) { Alert.alert("Erro", "Não foi possível compartilhar o arquivo."); }
    }
  };

  const gerenciarBloqueio = async (bloquear: boolean) => {
    const acao = bloquear ? "BLOQUEAR" : "DESBLOQUEAR";
    const executar = async () => {
        try {
            if (bloquear) await api.adminBloquearConversa(alunoSelecionado.id, contatoSelecionado.id);
            else await api.adminDesbloquearConversa(alunoSelecionado.id, contatoSelecionado.id);
            Alert.alert("Sucesso", `A comunicação foi ${acao.toLowerCase()}a.`);
        } catch(e) { Alert.alert("Erro", "Falha na operação."); }
    };

    if (Platform.OS === 'web') {
        if (window.confirm(`Deseja ${acao} a comunicação entre estes alunos?`)) executar();
    } else {
        Alert.alert("Moderação", `Deseja ${acao} a comunicação entre estes alunos?`, [
          { text: "Cancelar", style: "cancel" }, { text: "Confirmar", style: "default", onPress: executar }
        ]);
    }
  };

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================
  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={cores.erro} style={{ marginTop: 50 }} /></SafeAreaView>;
  }

  // TELA 1: LISTA DE ALUNOS
  if (view === 'lista_alunos') {
      const mapeados = todosUsuarios.map(u => {
          const t = turmas.find(x => x.id === u.turmaId);
          const e = equipes.find(x => x.id === u.equipeId);
          return { ...u, turmaNome: t ? t.nome : '', equipeCor: e ? e.cor : cores.textoFraco };
      });
      mapeados.sort((a, b) => a.nome.localeCompare(b.nome));

      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}><Ionicons name="arrow-back" size={28} color={cores.texto} /></TouchableOpacity>
            <Ionicons name="shield-checkmark" size={32} color={cores.erro} />
            <Text style={styles.headerTitle}>Moderação (Selecionar)</Text>
          </View>
          <Text style={{color: cores.textoFraco, paddingHorizontal: 15, paddingBottom: 10}}>Selecione o usuário que deseja investigar:</Text>
          <FlatList
            data={mapeados}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.cardSelect} onPress={() => abrirInbox(item)}>
                <View style={[styles.avatar, { borderColor: item.equipeCor }]}><Ionicons name="person" size={20} color={item.equipeCor} /></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.nomeText}>{item.nome}</Text>
                    {item.turmaNome ? <Text style={styles.subText}>{item.turmaNome}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={cores.textoFraco} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      );
  }

  // TELA 2: INBOX DO ALUNO SELECIONADO
  if (view === 'inbox_aluno') {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setView('lista_alunos')} style={{ marginRight: 15 }}><Ionicons name="arrow-back" size={28} color={cores.texto} /></TouchableOpacity>
            <View>
                <Text style={styles.headerTitle}>Inbox de {alunoSelecionado.nome.split(' ')[0]}</Text>
                <Text style={{color: cores.erro, fontSize: 12, fontWeight: 'bold', marginLeft: 10}}>Visão do Administrador</Text>
            </View>
          </View>
          
          <FlatList
            data={contatosNoInbox}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.cardSelect} onPress={() => abrirConversa(item)}>
                <View style={[styles.avatar, { borderColor: '#FFF' }]}><Ionicons name="chatbubbles" size={20} color="#FFF" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.nomeText}>{item.nome}</Text>
                    <Text style={styles.subText}>Última interção: {new Date(item.lastMessageTime).toLocaleString('pt-BR')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={cores.textoFraco} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Este usuário não possui conversas.</Text>}
          />
        </SafeAreaView>
      );
  }

  // TELA 3: A CONVERSA EM SI (CHAT BUBBLES + FERRAMENTAS DE MODERAÇÃO)
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setView('inbox_aluno')} style={{ padding: 10 }}>
            <Ionicons name="arrow-back" size={24} color={cores.texto} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 5 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{alunoSelecionado.nome.split(' ')[0]} ⚡ {contatoSelecionado.nome.split(' ')[0]}</Text>
          </View>
          
          <TouchableOpacity onPress={() => gerenciarBloqueio(true)} style={{ padding: 10 }}><Ionicons name="lock-closed" size={20} color={cores.erro} /></TouchableOpacity>
          <TouchableOpacity onPress={() => gerenciarBloqueio(false)} style={{ padding: 10 }}><Ionicons name="lock-open" size={20} color={cores.sucesso} /></TouchableOpacity>
          <TouchableOpacity onPress={baixarConversa} style={{ padding: 10 }}><Ionicons name="download" size={22} color={cores.ciano} /></TouchableOpacity>
      </View>

      <FlatList
        data={mensagens}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 30 }}
        renderItem={({ item }) => {
          const isAlunoSelecionado = item.remetenteId === alunoSelecionado.id;
          
          return (
            <View style={[styles.msgWrapper, isAlunoSelecionado ? styles.msgWrapperRight : styles.msgWrapperLeft]}>
              <View style={[styles.msgBubble, isAlunoSelecionado ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                
                <Text style={styles.nomeTagMod}>{isAlunoSelecionado ? alunoSelecionado.nome : contatoSelecionado.nome}</Text>
                
                <Text style={[styles.msgText, item.apagadaPorAdmin && { fontStyle: 'italic', color: cores.erro }]}>
                  {item.texto}
                </Text>
                
                <View style={styles.toolsRow}>
                    <Text style={styles.msgTime}>{new Date(item.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                    
                    {!item.apagadaPorAdmin && (
                        <View style={{flexDirection: 'row', gap: 10}}>
                            <TouchableOpacity onPress={() => iniciarEdicao(item)}><Ionicons name="pencil" size={14} color={cores.textoFraco} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => apagarMensagem(item.id)}><Ionicons name="trash" size={14} color={cores.erro} /></TouchableOpacity>
                        </View>
                    )}
                </View>

              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>Sem mensagens no histórico.</Text>}
      />

      {/* MODAL DE EDIÇÃO DE TEXTO */}
      <Modal visible={modalEditVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Editar Mensagem (Moderação)</Text>
              <TextInput
                  style={styles.textInput}
                  value={novoTexto}
                  onChangeText={setNovoTexto}
                  multiline
              />
              <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}>
                  <TouchableOpacity style={styles.btnCancel} onPress={() => setModalEditVisible(false)}>
                      <Text style={styles.btnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSave} onPress={salvarEdicao}>
                      <Text style={[styles.btnText, { color: '#FFF' }]}>Salvar Edição</Text>
                  </TouchableOpacity>
              </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: cores.texto, marginLeft: 10 },
  
  cardSelect: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficie, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  nomeText: { color: cores.texto, fontSize: 16, fontWeight: 'bold' },
  subText: { color: cores.textoFraco, fontSize: 13, marginTop: 2 },
  emptyText: { color: cores.textoFraco, textAlign: 'center', marginTop: 30, fontStyle: 'italic' },
  
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: cores.superficie, borderBottomWidth: 1, borderBottomColor: 'rgba(231, 76, 60, 0.5)' },
  
  msgWrapper: { width: '100%', marginBottom: 15, flexDirection: 'row' },
  msgWrapperRight: { justifyContent: 'flex-end' },
  msgWrapperLeft: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '85%', padding: 12, borderRadius: 16 },
  msgBubbleMe: { backgroundColor: 'rgba(65, 105, 225, 0.3)', borderBottomRightRadius: 4, borderWidth: 1, borderColor: cores.azul },
  msgBubbleOther: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: cores.borda },
  
  nomeTagMod: { color: cores.textoFraco, fontSize: 10, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase' },
  msgText: { color: cores.texto, fontSize: 15, marginBottom: 12 },
  toolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 },
  msgTime: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: cores.superficie, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: cores.erro },
  modalTitle: { color: cores.erro, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  textInput: { backgroundColor: cores.fundo, color: cores.texto, padding: 15, borderRadius: 12, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: cores.borda },
  btnCancel: { flex: 1, backgroundColor: cores.borda, padding: 15, borderRadius: 12, alignItems: 'center' },
  btnSave: { flex: 1, backgroundColor: cores.erro, padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { color: cores.texto, fontWeight: 'bold', fontSize: 14 }
});
