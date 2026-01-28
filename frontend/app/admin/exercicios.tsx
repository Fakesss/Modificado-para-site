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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Exercicio } from '../../src/types';

export default function AdminExercicios() {
  const router = useRouter();
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getExercicios();
      setExercicios(data);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = async (exercicioId: string) => {
    Alert.alert(
      'Mover para Lixeira',
      'Deseja mover este exercício para a lixeira? Você terá 7 dias para restaurá-lo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Mover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteExercicio(exercicioId);
              Alert.alert('Sucesso', 'Exercício movido para a lixeira');
              loadData();
            } catch (error) {
              Alert.alert('Erro', 'Erro ao mover exercício');
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
        <Text style={styles.headerTitle}>Gerenciar Exercícios</Text>
        <TouchableOpacity onPress={() => router.push('/admin/criar-exercicio')}>
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
        {exercicios.map((exercicio) => (
          <View key={exercicio.id} style={styles.exercicioCard}>
            <View style={styles.exercicioIcon}>
              <Ionicons
                name={exercicio.modoCriacao === 'PDF' ? 'document' : 'list'}
                size={28}
                color="#32CD32"
              />
            </View>
            <View style={styles.exercicioInfo}>
              <Text style={styles.exercicioTitle}>{exercicio.titulo}</Text>
              {exercicio.descricao && (
                <Text style={styles.exercicioDesc} numberOfLines={2}>
                  {exercicio.descricao}
                </Text>
              )}
              <View style={styles.exercicioMeta}>
                <View style={[styles.modoBadge, { backgroundColor: exercicio.modoCriacao === 'PDF' ? '#9B59B630' : '#32CD3230' }]}>
                  <Text style={[styles.modoText, { color: exercicio.modoCriacao === 'PDF' ? '#9B59B6' : '#32CD32' }]}>
                    {exercicio.modoCriacao}
                  </Text>
                </View>
                {exercicio.habilidadesBNCC.length > 0 && (
                  <View style={styles.tagsBadge}>
                    <Text style={styles.tagsText}>
                      {exercicio.habilidadesBNCC.length} tags BNCC
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.exercicioActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(exercicio.id)}>
                <Ionicons name="trash" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {exercicios.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum exercício cadastrado</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/admin/criar-exercicio')}
            >
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.createButtonText}>Criar Primeiro Exercício</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  exercicioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  exercicioIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#32CD32' + '30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercicioInfo: {
    flex: 1,
    marginLeft: 12,
  },
  exercicioTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exercicioDesc: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  exercicioMeta: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  modoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modoText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  tagsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#FFD70030',
  },
  tagsText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  exercicioActions: {
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
    marginBottom: 20,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});
