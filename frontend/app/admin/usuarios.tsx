import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, TextInput, Platform, AppState, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { buscarUsuariosOnline } from '../../src/services/multiplayerApi';
import { Usuario, Turma, Equipe } from '../../src/types';

export default function AdminUsuarios() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [editNome, setEditNome] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editPerfil, setEditPerfil] = useState('');
  const [editTurma, setEditTurma] = useState('');
  const [editEquipe, setEditEquipe] = useState('');
  const [editPontos, setEditPontos] = useState(''); 
  const [editRecordeArcade, setEditRecordeArcade] = useState(''); 
  const [editOcultoChat, setEditOcultoChat] = useState(false); // NOVO: Controle de Fantasma

  useEffect(() => {
    loadData();

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const checkOnline = async () => {
      if (!isActive) return;
      if (AppState.currentState === 'active') {
        try {
          const onlineData = await buscarUsuariosOnline();
          if (isActive) setOnlineUsers(onlineData || []);
        } catch (e) {}
      }
      if (isActive) timeoutId = setTimeout(checkOnline, 10000);
    };

    timeoutId = setTimeout(checkOnline, 10000);
    return () => { isActive = false; clearTimeout(timeoutId); };
  }, []);

  const loadData = async () => {
    try {
      const [usuariosData, turmasData, equipesData, onlineData] = await Promise.all([
        api.getUsuarios(), api.getTurmas(), api.getEquipes(), buscarUsuariosOnline()
      ]);
      setUsuarios(usuariosData); setTurmas(turmasData); setEquipes(equipesData); setOnlineUsers(onlineData || []);
    } catch (error) {} finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setEditNome(user.nome || '');
    setEditPerfil(user.perfil);
    setEditTurma(user.turmaId || '');
    setEditEquipe(user.equipeId || '');
    setEditSenha(''); 
    setEditPontos(String(user.pontosTotais || 0)); 
    setEditRecordeArcade(String(user.recordeJogoSingle || 0)); 
    setEditOcultoChat(user.ocultoChat || false); // Inicia a chave com o valor do banco
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      const data: any = { 
        nome: editNome, perfil: editPerfil, turmaId: editTurma || null, equipeId: editEquipe || null,
        pontosTotais: Number(editPontos), recordeJogoSingle: Number(editRecordeArcade),
        ocultoChat: editOcultoChat // Salva se é fantasma ou não
      };
      if (editSenha.trim() !== '') data.senha = editSenha;
      await api.updateUsuario(selectedUser.id, data);
      Alert.alert('Sucesso', 'Usuário atualizado!');
      setModalVisible(false);
      loadData();
    } catch (error: any) { Alert.alert('Erro', error.response?.data?.detail || 'Erro ao salvar.'); }
  };

  const handleDelete = async (userId: string) => {
    if (Platform.OS === 'web') {
      const confirmou = window.confirm('Deseja realmente desativar este usuário? (Ele sairá dos rankings)');
      if (confirmou) {
        try { await api.deleteUsuario(userId); Alert.alert('Sucesso', 'Usuário desativado com sucesso!'); loadData(); } catch (error) {}
      }
    } else {
      Alert.alert('Confirmar exclusão', 'Deseja desativar este usuário?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desativar', style: 'destructive', onPress: async () => {
            try { await api.deleteUsuario(userId); Alert.alert('Sucesso', 'Usuário desativado!'); loadData(); } catch (error) {}
          }
        },
      ]);
    }
  };

  const confirmarZerarTodos = () => {
    const mensagem = 'Isso vai ZERAR a pontuação de TODOS os jogadores do jogo e mudar o ranking. Essa ação não pode ser desfeita. Deseja continuar?';
    if (Platform.OS === 'web') { if (window.confirm(mensagem)) executarZerarTodos(); } else {
      Alert.alert('ATENÇÃO EXTREMA ⚠️', mensagem, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sim, ZERAR TUDO!', style: 'destructive', onPress: executarZerarTodos }]);
    }
  };

  const executarZerarTodos = async () => {
    try { await api.zerarTodosPontos(); Alert.alert('Sucesso', 'O ranking foi limpo!'); loadData(); } catch (error) {}
  };

  const getPerfilColor = (perfil: string) => { if (perfil === 'ADMIN') return '#E74C3C'; if (perfil === 'ALUNO_LIDER') return '#FFD700'; return '#4169E1'; };
  const getPerfilLabel = (perfil: string) => { if (perfil === 'ADMIN') return 'Admin'; if (perfil === 'ALUNO_LIDER') return 'Líder'; return 'Aluno'; };

  const formatarUltimoAcesso = (dataIso?: string) => {
    if (!dataIso) return 'Nunca acessou';
    try {
      const data = new Date(dataIso);
      return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (error) { return 'Data inválida'; }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFD700" /></View>
      </SafeAreaView>
    );
  }

  const sortedUsuarios = [...usuarios].sort((a, b) => {
    const aOnline = onlineUsers.some(ou => ou.id === a.id);
    const bOnline = onlineUsers.some(ou => ou.id === b.id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Usuários</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}>
        
        <TouchableOpacity style={styles.zerarAllButton} onPress={confirmarZerarTodos}>
          <Ionicons name="warning" size={20} color="#FFF" />
          <Text style={styles.zerarAllText}>Zerar Pontos de Todos os Jogadores</Text>
        </TouchableOpacity>

        {sortedUsuarios.map((user: any) => {
          const equipe = equipes.find((e) => e.id === user.equipeId);
          const turma = turmas.find((t) => t.id === user.turmaId);
          const isOnline = onlineUsers.some(ou => ou.id === user.id);

          return (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.userHeader}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#32CD32' : '#555' }]} />
                    <Text style={styles.userName}>{user.nome}</Text>
                    {user.ocultoChat && <Ionicons name="eye-off" size={14} color="#888" />}
                  </View>
                  <View style={[styles.perfilBadge, { backgroundColor: getPerfilColor(user.perfil) + '30' }]}>
                    <Text style={[styles.perfilText, { color: getPerfilColor(user.perfil) }]}>{getPerfilLabel(user.perfil)}</Text>
                  </View>
                </View>

                <View style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: isOnline ? '#32CD32' : '#555', fontSize: 12, fontWeight: 'bold' }}>{isOnline ? 'Online agora' : 'Offline'}</Text>
                    <Text style={styles.userEmail}> • {user.email}</Text>
                  </View>
                  {!isOnline && (
                    <Text style={{ color: '#666', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>Último acesso: {formatarUltimoAcesso(user.ultimoAcesso)}</Text>
                  )}
                </View>

                <View style={styles.userMeta}>
                  {turma && <Text style={styles.metaText}>{turma.nome}</Text>}
                  {equipe && (
                    <View style={[styles.teamBadge, { backgroundColor: equipe.cor + '30' }]}>
                      <Text style={[styles.teamText, { color: equipe.cor }]}>{equipe.nome}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userStats}>
                  <View style={styles.statItem}><Ionicons name="star" size={14} color="#FFD700" /><Text style={styles.statText}>{user.pontosTotais} pts</Text></View>
                  <View style={styles.statItem}><Ionicons name="flame" size={14} color="#FF6B35" /><Text style={styles.statText}>{user.streakDias} dias</Text></View>
                  <View style={styles.statItem}><Ionicons name="game-controller" size={14} color="#9b59b6" /><Text style={styles.statText}>{user.recordeJogoSingle || 0} arcade</Text></View>
                </View>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(user)}><Ionicons name="create" size={20} color="#4169E1" /></TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(user.id)}><Ionicons name="trash" size={20} color="#E74C3C" /></TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Painel do Usuário</Text>
              <Text style={styles.modalSubtitle}>{selectedUser?.email}</Text>

              <Text style={[styles.inputLabel, { color: '#FFD700' }]}>🏆 Pontos Atuais</Text>
              <TextInput style={[styles.textInput, { borderColor: '#FFD700' }]} value={editPontos} onChangeText={setEditPontos} keyboardType="numeric" placeholder="Zerar ou Diminuir pontos..." placeholderTextColor="#666" />

              <Text style={[styles.inputLabel, { color: '#9b59b6', marginTop: 16 }]}>🕹️ Recorde Arcade (Hall da Fama)</Text>
              <TextInput style={[styles.textInput, { borderColor: '#9b59b6' }]} value={editRecordeArcade} onChangeText={setEditRecordeArcade} keyboardType="numeric" placeholder="Definir recorde do Arcade..." placeholderTextColor="#666" />

              <Text style={styles.inputLabel}>Nome de Exibição</Text>
              <TextInput style={styles.textInput} value={editNome} onChangeText={setEditNome} placeholder="Ex: João da Silva" placeholderTextColor="#666" />

              <Text style={styles.inputLabel}>Redefinir Senha</Text>
              <TextInput style={styles.textInput} value={editSenha} onChangeText={setEditSenha} placeholder="Deixe em branco para manter a atual..." placeholderTextColor="#666" />

              {/* CONTROLE DE CONTA DE TESTE AQUI */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Ocultar no Inbox (Conta de Teste)</Text>
                  <Text style={{color:'#666', fontSize: 11}}>O usuário sumirá do chat dos alunos</Text>
                </View>
                <Switch value={editOcultoChat} onValueChange={setEditOcultoChat} trackColor={{ false: '#333', true: '#FFD700' }} thumbColor={editOcultoChat ? '#fff' : '#888'} />
              </View>

              <Text style={styles.inputLabel}>Nível de Permissão (Perfil)</Text>
              <View style={styles.selectContainer}>
                {['ALUNO', 'ALUNO_LIDER', 'ADMIN'].map((perfil) => (
                  <TouchableOpacity key={perfil} style={[styles.selectOption, editPerfil === perfil && { backgroundColor: getPerfilColor(perfil) }]} onPress={() => setEditPerfil(perfil)}>
                    <Text style={[styles.selectText, editPerfil === perfil && { color: '#000' }]}>{getPerfilLabel(perfil)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Turma</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                <TouchableOpacity style={[styles.selectOption, !editTurma && styles.selectOptionActive]} onPress={() => setEditTurma('')}><Text style={[styles.selectText, !editTurma && { color: '#000' }]}>Nenhuma</Text></TouchableOpacity>
                {turmas.map((turma) => (
                  <TouchableOpacity key={turma.id} style={[styles.selectOption, editTurma === turma.id && styles.selectOptionActive]} onPress={() => setEditTurma(turma.id)}>
                    <Text style={[styles.selectText, editTurma === turma.id && { color: '#000' }]}>{turma.nome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Equipe do Aluno</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
                <TouchableOpacity style={[styles.selectOption, !editEquipe && styles.selectOptionActive]} onPress={() => setEditEquipe('')}><Text style={[styles.selectText, !editEquipe && { color: '#000' }]}>Nenhuma</Text></TouchableOpacity>
                {equipes.map((equipe) => (
                  <TouchableOpacity key={equipe.id} style={[styles.selectOption, { borderColor: equipe.cor }, editEquipe === equipe.id && { backgroundColor: equipe.cor }]} onPress={() => setEditEquipe(equipe.id)}>
                    <Text style={[styles.selectText, { color: editEquipe === equipe.id ? '#000' : equipe.cor }]}>{equipe.nome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}><Text style={styles.saveButtonText}>Salvar Alterações</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  
  zerarAllButton: { backgroundColor: '#E74C3C', flexDirection: 'row', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 },
  zerarAllText: { color: '#FFF', fontWeight: '900', fontSize: 16 },

  userCard: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  userInfo: { flex: 1 },
  userHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  perfilBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  perfilText: { fontSize: 10, fontWeight: 'bold' },
  userEmail: { color: '#888', fontSize: 13 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metaText: { color: '#666', fontSize: 12 },
  teamBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  teamText: { fontSize: 12, fontWeight: '600' },
  userStats: { flexDirection: 'row', gap: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { color: '#888', fontSize: 12 },
  userActions: { justifyContent: 'center', gap: 8 },
  actionButton: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, maxHeight: '90%' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  modalSubtitle: { color: '#888', fontSize: 14, marginBottom: 10 },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 8, marginTop: 16 },
  textInput: { backgroundColor: '#0c0c0c', borderRadius: 12, padding: 14, color: '#fff', borderWidth: 1, borderColor: '#333' },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10, padding: 15, backgroundColor: '#0c0c0c', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  switchLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  selectContainer: { flexDirection: 'row', gap: 8 },
  selectScroll: { flexDirection: 'row' },
  selectOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#333', marginRight: 8 },
  selectOptionActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  selectText: { color: '#888', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24, paddingBottom: 10 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#333', alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontWeight: '600' },
  saveButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FFD700', alignItems: 'center' },
  saveButtonText: { color: '#000', fontWeight: '600' },
});
