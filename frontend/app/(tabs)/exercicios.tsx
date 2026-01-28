import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Exercicio } from '../../src/types';

export default function Exercicios() {
  const router = useRouter();
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [submissoes, setSubmissoes] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const exerciciosData = await api.getExercicios();
      setExercicios(exerciciosData);
      
      // Load submissions for each exercise
      const submissoesData: Record<string, any> = {};
      for (const ex of exerciciosData) {
        try {
          const sub = await api.getSubmissao(ex.id);
          if (sub) submissoesData[ex.id] = sub;
        } catch (error) {
          // No submission yet
        }
      }
      setSubmissoes(submissoesData);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getExerciseStatus = (exercicioId: string) => {
    const sub = submissoes[exercicioId];
    if (!sub) return { status: 'new', label: 'Novo', color: '#888' };
    if (sub.nota >= 7) return { status: 'great', label: `Nota: ${sub.nota}`, color: '#32CD32' };
    if (sub.nota >= 5) return { status: 'ok', label: `Nota: ${sub.nota}`, color: '#FFD700' };
    return { status: 'retry', label: `Nota: ${sub.nota}`, color: '#E74C3C' };
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
        <Ionicons name="document-text" size={28} color="#32CD32" />
        <Text style={styles.title}>Atividades</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {exercicios.map((exercicio) => {
          const exerciseStatus = getExerciseStatus(exercicio.id);
          const sub = submissoes[exercicio.id];
          
          return (
            <TouchableOpacity
              key={exercicio.id}
              style={styles.exerciseCard}
              onPress={() => router.push(`/exercicio/${exercicio.id}`)}
            >
              <View style={styles.exerciseIcon}>
                <Ionicons
                  name={exercicio.modoCriacao === 'PDF' ? 'document' : 'list'}
                  size={28}
                  color="#32CD32"
                />
              </View>
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseTitle}>{exercicio.titulo}</Text>
                {exercicio.descricao && (
                  <Text style={styles.exerciseDescription} numberOfLines={2}>
                    {exercicio.descricao}
                  </Text>
                )}
                <View style={styles.exerciseMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: exerciseStatus.color + '30' }]}>
                    <Ionicons
                      name={exerciseStatus.status === 'new' ? 'ellipse' : 'checkmark-circle'}
                      size={14}
                      color={exerciseStatus.color}
                    />
                    <Text style={[styles.statusText, { color: exerciseStatus.color }]}>
                      {exerciseStatus.label}
                    </Text>
                  </View>
                  {sub?.pontosGerados > 0 && (
                    <View style={styles.pointsBadge}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.pointsText}>+{sub.pontosGerados} pts</Text>
                    </View>
                  )}
                </View>
                {exercicio.habilidadesBNCC.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {exercicio.habilidadesBNCC.slice(0, 3).map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
          );
        })}

        {exercicios.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhuma atividade disponível</Text>
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
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  exerciseIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#32CD32' + '30',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseInfo: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseDescription: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FFD700' + '30',
    gap: 4,
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 4,
  },
  tag: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    color: '#888',
    fontSize: 10,
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
});
