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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';

export default function AdminConteudos() {
  const router = useRouter();
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedConteudo, setSelectedConteudo] = useState<Conteudo | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTipo, setFormTipo] = useState('VIDEO');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getConteudos();
      setConteudos(data);
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setEditMode(false);
    setSelectedConteudo(null);
    setFormTitulo('');
    setFormDescricao('');
    setFormUrl('');
    setFormTipo('VIDEO');
    setModalVisible(true);
  };

  const openEditModal = (conteudo: Conteudo) => {
    setEditMode(true);
    setSelectedConteudo(conteudo);
    setFormTitulo(conteudo.titulo);
    setFormDescricao(conteudo.descricao || '');
    setFormUrl(conteudo.urlVideo || '');
    setFormTipo(conteudo.tipo);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formTitulo.trim()) {
      Alert.alert('Erro', 'Título é obrigatório');
      return;
    }

    try {
      if (editMode && selectedConteudo) {
        await api.updateConteudo(selectedConteudo.id, {
          titulo: formTitulo,
          descricao: formDescricao,
          urlVideo: formUrl,
          tipo: formTipo,
        });
        Alert.alert('Sucesso', 'Conteúdo atualizado!');
      } else {
        await api.createConteudo({
          titulo: formTitulo,
          descricao: formDescricao,
          urlVideo: formUrl,
          tipo: formTipo,
          abaCategoria: 'videos',
        });
        Alert.alert('Sucesso', 'Conteúdo criado!');
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handleDelete = async (conteudoId: string) => {
    Alert.alert(
      'Mover para Lixeira',
      'Deseja mover este conteúdo para a lixeira? Você terá 7 dias para restaurá-lo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Mover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteConteudo(conteudoId);
              Alert.alert('Sucesso', 'Conteúdo movido para a lixeira');
              loadData();
            } catch (error) {
              Alert.alert('Erro', 'Erro ao mover conteúdo');
            }
          },
        },
      ]
    );
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
        <Text style={styles.headerTitle}>Gerenciar Conteúdos</Text>
        <TouchableOpacity onPress={openCreateModal}>
          <Ionicons name="add-circle" size={28} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {conteudos.map((conteudo) => (
          <View key={conteudo.id} style={styles.conteudoCard}>
            <View style={styles.conteudoIcon}>
              <Ionicons
                name={conteudo.tipo === 'VIDEO' ? 'play-circle' : 'document'}
                size={28}
                color="#4169E1"
              />
            </View>
            <View style={styles.conteudoInfo}>
              <Text style={styles.conteudoTitle}>{conteudo.titulo}</Text>
              {conteudo.descricao && (
                <Text style={styles.conteudoDesc} numberOfLines={2}>
                  {conteudo.descricao}
                </Text>
              )}
              <View style={styles.conteudoMeta}>
                <View style={[styles.tipoBadge, { backgroundColor: conteudo.tipo === 'VIDEO' ? '#4169E130' : '#32CD3230' }]}>
                  <Text style={[styles.tipoText, { color: conteudo.tipo === 'VIDEO' ? '#4169E1' : '#32CD32' }]}>
                    {conteudo.tipo}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.conteudoActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => openEditModal(conteudo)}>
                <Ionicons name="create" size={20} color="#4169E1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(conteudo.id)}>
                <Ionicons name="trash" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {conteudos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum conteúdo cadastrado</Text>
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editMode ? 'Editar Conteúdo' : 'Novo Conteúdo'}</Text>

            <Text style={styles.inputLabel}>Título</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Título do conteúdo"
              placeholderTextColor="#666"
              value={formTitulo}
              onChangeText={setFormTitulo}
            />

            <Text style={styles.inputLabel}>Descrição</Text>
            <TextInput
              style={[styles.textInput, { height: 80 }]}
              placeholder="Descrição (opcional)"
              placeholderTextColor="#666"
              value={formDescricao}
              onChangeText={setFormDescricao}
              multiline
            />

            <Text style={styles.inputLabel}>URL do Vídeo (YouTube)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="https://www.youtube.com/watch?v=..."
              placeholderTextColor="#666"
              value={formUrl}
              onChangeText={setFormUrl}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Tipo</Text>
            <View style={styles.selectContainer}>
              {['VIDEO', 'LINK', 'MATERIAL'].map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.selectOption,
                    formTipo === tipo && styles.selectOptionActive,
                  ]}
                  onPress={() => setFormTipo(tipo)}
                >
                  <Text
                    style={[styles.selectText, formTipo === tipo && { color: '#000' }]}
                  >
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
  conteudoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  conteudoIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#4169E1' + '30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conteudoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  conteudoDesc: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  conteudoMeta: {
    flexDirection: 'row',
    marginTop: 8,
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tipoText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  conteudoActions: {
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
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
    marginBottom: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  selectContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
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
