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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';

interface TrashItem {
  id: string;
  tipo: 'CONTEUDO' | 'EXERCICIO';
  titulo: string;
  subtipo: string;
  deleted_at: string;
  dias_restantes: number;
}

export default function Lixeira() {
  const router = useRouter();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    action: 'restore' | 'delete' | null;
    item: TrashItem | null;
  }>({ visible: false, action: null, item: null });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await api.getLixeira();
      setItems(data);
    } catch (error) {
      console.error('Error loading trash items:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lixeira');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const showConfirmation = (action: 'restore' | 'delete', item: TrashItem) => {
    setConfirmModal({ visible: true, action, item });
  };

  const handleConfirm = async () => {
    const { action, item } = confirmModal;
    if (!action || !item) return;

    setConfirmModal({ visible: false, action: null, item: null });
    setActionLoading(item.id);

    try {
      if (action === 'restore') {
        await api.restaurarItem(item.id, item.tipo);
        Alert.alert('Sucesso', `${item.tipo === 'CONTEUDO' ? 'Conteúdo' : 'Exercício'} restaurado com sucesso!`);
      } else {
        await api.deletePermanente(item.id, item.tipo);
        Alert.alert('Sucesso', `${item.tipo === 'CONTEUDO' ? 'Conteúdo' : 'Exercício'} excluído permanentemente!`);
      }
      await loadItems();
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Ocorreu um erro');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLimparExpirados = async () => {
    Alert.alert(
      'Limpar Itens Expirados',
      'Isso irá excluir permanentemente todos os itens que estão na lixeira há mais de 7 dias. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await api.limparItensExpirados();
              Alert.alert(
                'Sucesso',
                `Removidos: ${result.conteudos_removidos} conteúdos e ${result.exercicios_removidos} exercícios`
              );
              await loadItems();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível limpar os itens expirados');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getIcon = (item: TrashItem) => {
    if (item.tipo === 'EXERCICIO') {
      return 'document-text';
    }
    if (item.subtipo === 'VIDEO') {
      return 'play-circle';
    }
    return 'document';
  };

  const getColor = (item: TrashItem) => {
    if (item.tipo === 'EXERCICIO') {
      return '#FFD700';
    }
    if (item.subtipo === 'VIDEO') {
      return '#32CD32';
    }
    return '#4169E1';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lixeira</Text>
        <TouchableOpacity
          style={styles.cleanButton}
          onPress={handleLimparExpirados}
          disabled={items.length === 0}
        >
          <Ionicons name="trash-bin" size={20} color={items.length > 0 ? '#E74C3C' : '#666'} />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#FFD700" />
        <Text style={styles.infoText}>
          Itens na lixeira são excluídos permanentemente após 7 dias
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E74C3C" />
        }
      >
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trash-outline" size={64} color="#444" />
            <Text style={styles.emptyTitle}>Lixeira vazia</Text>
            <Text style={styles.emptySubtitle}>
              Itens excluídos aparecerão aqui
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.itemCount}>{items.length} item(ns) na lixeira</Text>
            {items.map((item) => (
              <View key={`${item.tipo}-${item.id}`} style={styles.itemCard}>
                <View style={[styles.itemIcon, { backgroundColor: getColor(item) + '30' }]}>
                  <Ionicons name={getIcon(item)} size={24} color={getColor(item)} />
                </View>
                
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.titulo}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {item.tipo === 'CONTEUDO' ? 'Conteúdo' : 'Exercício'} • {item.subtipo || 'N/A'}
                  </Text>
                  <View style={styles.itemDateRow}>
                    <Ionicons name="time-outline" size={12} color="#888" />
                    <Text style={styles.itemDate}>
                      Excluído: {formatDate(item.deleted_at)}
                    </Text>
                  </View>
                  <View style={[
                    styles.daysRemaining,
                    item.dias_restantes <= 2 && styles.daysRemainingUrgent
                  ]}>
                    <Ionicons 
                      name={item.dias_restantes <= 2 ? 'warning' : 'timer-outline'} 
                      size={14} 
                      color={item.dias_restantes <= 2 ? '#E74C3C' : '#FFD700'} 
                    />
                    <Text style={[
                      styles.daysRemainingText,
                      item.dias_restantes <= 2 && styles.daysRemainingTextUrgent
                    ]}>
                      {item.dias_restantes} dia(s) restante(s)
                    </Text>
                  </View>
                </View>

                <View style={styles.itemActions}>
                  {actionLoading === item.id ? (
                    <ActivityIndicator size="small" color="#FFD700" />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.restoreButton}
                        onPress={() => showConfirmation('restore', item)}
                      >
                        <Ionicons name="refresh" size={20} color="#32CD32" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => showConfirmation('delete', item)}
                      >
                        <Ionicons name="close-circle" size={20} color="#E74C3C" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmModal({ visible: false, action: null, item: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.modalIcon,
              { backgroundColor: confirmModal.action === 'restore' ? '#32CD3230' : '#E74C3C30' }
            ]}>
              <Ionicons
                name={confirmModal.action === 'restore' ? 'refresh' : 'trash'}
                size={32}
                color={confirmModal.action === 'restore' ? '#32CD32' : '#E74C3C'}
              />
            </View>
            
            <Text style={styles.modalTitle}>
              {confirmModal.action === 'restore' ? 'Restaurar Item' : 'Excluir Permanentemente'}
            </Text>
            
            <Text style={styles.modalMessage}>
              {confirmModal.action === 'restore'
                ? `Deseja restaurar "${confirmModal.item?.titulo}"? O item voltará para a lista principal.`
                : `Tem certeza que deseja excluir permanentemente "${confirmModal.item?.titulo}"? Esta ação não pode ser desfeita.`}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setConfirmModal({ visible: false, action: null, item: null })}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  { backgroundColor: confirmModal.action === 'restore' ? '#32CD32' : '#E74C3C' }
                ]}
                onPress={handleConfirm}
              >
                <Text style={styles.modalConfirmText}>
                  {confirmModal.action === 'restore' ? 'Restaurar' : 'Excluir'}
                </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  cleanButton: {
    padding: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70015',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: '#FFD700',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  itemCount: {
    color: '#888',
    fontSize: 14,
    marginBottom: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  itemDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  itemDate: {
    color: '#666',
    fontSize: 11,
  },
  daysRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  daysRemainingUrgent: {
    backgroundColor: '#E74C3C20',
  },
  daysRemainingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '600',
  },
  daysRemainingTextUrgent: {
    color: '#E74C3C',
  },
  itemActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 8,
  },
  restoreButton: {
    padding: 8,
    backgroundColor: '#32CD3220',
    borderRadius: 8,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#E74C3C20',
    borderRadius: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#333',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
