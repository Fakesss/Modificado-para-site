import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Usuario, Turma, Equipe } from '../../src/types';

export default function AdminUsuarios() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [editPerfil, setEditPerfil] = useState('');
  const [editTurma, setEditTurma] = useState('');
  const [editEquipe, setEditEquipe] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usuariosData, turmasData, equipesData] = await Promise.all([
        api.getUsuarios(),
        api.getTurmas(),
        api.getEquipes(),
      ]);
      setUsuarios(usuariosData);
      setTurmas(turmasData);
      setEquipes(equipesData);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openEditModal = (user: Usuario) => {
    setSelectedUser(user);
    setEditPerfil(user.perfil);
    setEditTurma(user.turmaId || '');
    setEditEquipe(user.equipeId || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    try {
      await api.updateUsuario(selectedUser.id, {
        perfil: editPerfil,
        turmaId: editTurma || null,
        equipeId: editEquipe || null,
      });
      Alert.alert('Sucesso', 'Usuário atualizado!');
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao atualizar');
    }
  };

  const handleDelete = async (userId: string) => {
    Alert.alert(
      'Confirmar exclusão',
      'Deseja realmente desativar este usuário?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteUsuario(userId);
              loadData();
            } catch (error) {
              Alert.alert('Erro', 'Erro ao desativar usuário');
            }
          },
        },
      ]
    );
  };

  const getPerfilColor = (perfil: string) => {
    switch (perfil) {
      case 'ADMIN':
        return '#E74C3C';
      case 'ALUNO_LIDER':
        return '#FFD700';
      default:
        return '#4169E1';
    }
  };

  const getPerfilLabel = (perfil: string) => {
    switch (perfil) {
      case 'ADMIN':
        return 'Admin';
      case 'ALUNO_LIDER':
        return 'Líder';
      default:
        return 'Aluno';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Usuários</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {usuarios.map((user) => {
          const equipe = equipes.find((e) => e.id === user.equipeId);
          const turma = turmas.find((t) => t.id === user.turmaId);

          return (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.userHeader}>
                  <Text style={styles.userName}>{user.nome}</Text>
                  <View style={[styles.perfilBadge, { backgroundColor: getPerfilColor(user.perfil) + '30' }]}>
                    <Text style={[styles.perfilText, { color: getPerfilColor(user.perfil) }]}>
                      {getPerfilLabel(user.perfil)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={styles.userMeta}>
                  {turma && <Text style={styles.metaText}>{turma.nome}</Text>}
                  {equipe && (
                    <View style={[styles.teamBadge, { backgroundColor: equipe.cor + '30' }]}>
                      <Text style={[styles.teamText, { color: equipe.cor }]}>{equipe.nome}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.statText}>{user.pontosTotais} pts</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="flame" size={14} color="#FF6B35" />
                    <Text style={styles.statText}>{user.streakDias} dias</Text>
                  </View>
                </View>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(user)}>
                  <Ionicons name="create" size={20} color="#4169E1" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(user.id)}>
                  <Ionicons name="trash" size={20} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Usuário</Text>
            <Text style={styles.modalSubtitle}>{selectedUser?.nome}</Text>

            <Text style={styles.inputLabel}>Perfil</Text>
            <View style={styles.selectContainer}>
              {['ALUNO', 'ALUNO_LIDER', 'ADMIN'].map((perfil) => (
                <TouchableOpacity
                  key={perfil}
                  style={[
                    styles.selectOption,
                    editPerfil === perfil && { backgroundColor: getPerfilColor(perfil) },
                  ]}
                  onPress={() => setEditPerfil(perfil)}
                >
                  <Text
                    style={[
                      styles.selectText,
                      editPerfil === perfil && { color: '#000' },
                    ]}
                  >
                    {getPerfilLabel(perfil)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Turma</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              <TouchableOpacity
                style={[
                  styles.selectOption,
                  !editTurma && styles.selectOptionActive,
                ]}
                onPress={() => setEditTurma('')}
              >
                <Text style={[styles.selectText, !editTurma && { color: '#000' }]}>Nenhuma</Text>
              </TouchableOpacity>
              {turmas.map((turma) => (
                <TouchableOpacity
                  key={turma.id}
                  style={[
                    styles.selectOption,
                    editTurma === turma.id && styles.selectOptionActive,
                  ]}
                  onPress={() => setEditTurma(turma.id)}
                >
                  <Text
                    style={[styles.selectText, editTurma === turma.id && { color: '#000' }]}
                  >
                    {turma.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Equipe</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectScroll}>
              <TouchableOpacity
                style={[
                  styles.selectOption,
                  !editEquipe && styles.selectOptionActive,
                ]}
                onPress={() => setEditEquipe('')}
              >
                <Text style={[styles.selectText, !editEquipe && { color: '#000' }]}>Nenhuma</Text>
              </TouchableOpacity>
              {equipes.map((equipe) => (
                <TouchableOpacity
                  key={equipe.id}
                  style={[
                    styles.selectOption,
                    { borderColor: equipe.cor },
                    editEquipe === equipe.id && { backgroundColor: equipe.cor },
                  ]}
                  onPress={() => setEditEquipe(equipe.id)}
                >
                  <Text
                    style={[
                      styles.selectText,
                      { color: editEquipe === equipe.id ? '#000' : equipe.cor },
                    ]}
                  >
                    {equipe.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  perfilBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  perfilText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metaText: {
    color: '#666',
    fontSize: 12,
  },
  teamBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  teamText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#888',
    fontSize: 12,
  },
  userActions: {
    justifyContent: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    marginTop: 16,
  },
  selectContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  selectScroll: {
    flexDirection: 'row',
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 8,
  },
  selectOptionActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  selectText: {
    color: '#888',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontWeight: '600',
  },
});
