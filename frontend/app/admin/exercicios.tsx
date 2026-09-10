import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Exercicio } from '../../src/types';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

export default function AdminExercicios() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
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
    if (Platform.OS === 'web') {
      const confirmou = window.confirm('Deseja mover este exercício para a lixeira?');
      if (confirmou) {
        try {
          await api.deleteExercicio(exercicioId);
          window.alert('Exercício movido para a lixeira!');
          loadData();
        } catch (error) {
          window.alert('Erro ao mover exercício');
        }
      }
    } else {
      Alert.alert(
        'Mover para Lixeira',
        'Deseja mover este exercício para a lixeira?',
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
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={cores.dourado} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={cores.texto} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Exercícios</Text>
        <TouchableOpacity onPress={() => router.push('/admin/criar-exercicio')}>
          <Ionicons name="add-circle" size={28} color={cores.dourado} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.dourado} />
        }
      >
        {exercicios.map((exercicio) => (
          <View key={exercicio.id} style={styles.exercicioCard}>
            <View style={styles.exercicioIcon}>
              <Ionicons
                name={exercicio.modoCriacao === 'PDF' ? 'document' : 'list'}
                size={28}
                color={cores.sucesso}
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
                <View style={[styles.modoBadge, { backgroundColor: exercicio.modoCriacao === 'PDF' ? cores.roxo + '30' : cores.sucesso + '30' }]}>
                  <Text style={[styles.modoText, { color: exercicio.modoCriacao === 'PDF' ? cores.roxo : cores.sucesso }]}>
                    {exercicio.modoCriacao}
                  </Text>
                </View>
                {exercicio.habilidadesBNCC && exercicio.habilidadesBNCC.length > 0 && (
                  <View style={styles.tagsBadge}>
                    <Text style={styles.tagsText}>
                      {exercicio.habilidadesBNCC.length} tags BNCC
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.exercicioActions}>
              {/* BOTÃO EDITAR ADICIONADO AQUI */}
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={() => router.push({ pathname: '/admin/criar-exercicio', params: { id: exercicio.id } })}
              >
                <Ionicons name="pencil" size={20} color={cores.dourado} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(exercicio.id)}>
                <Ionicons name="trash" size={20} color={cores.erro} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {exercicios.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={cores.textoFraco} />
            <Text style={styles.emptyText}>Nenhum exercício cadastrado</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/admin/criar-exercicio')}
            >
              <Ionicons name="add" size={20} color={cores.sobreAcento} />
              <Text style={styles.createButtonText}>Criar Primeiro Exercício</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { color: cores.texto, fontSize: 18, fontWeight: 'bold' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  exercicioCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficie, borderRadius: 16, padding: 16, marginBottom: 12 },
  exercicioIcon: { width: 56, height: 56, backgroundColor: cores.sucesso + '30', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exercicioInfo: { flex: 1, marginLeft: 12 },
  exercicioTitle: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  exercicioDesc: { color: cores.textoFraco, fontSize: 13, marginTop: 4 },
  exercicioMeta: { flexDirection: 'row', marginTop: 8, gap: 8 },
  modoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  modoText: { fontSize: 10, fontWeight: 'bold' },
  tagsBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: cores.dourado + '30' },
  tagsText: { fontSize: 10, fontWeight: 'bold', color: cores.dourado },
  exercicioActions: { gap: 8 },
  actionButton: { padding: 8, backgroundColor: cores.superficieAlt, borderRadius: 8 }, // Adicionei fundo para facilitar o clique
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: cores.textoFraco, fontSize: 16, marginTop: 16, marginBottom: 20 },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.dourado, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8 },
  createButtonText: { color: cores.sobreAcento, fontWeight: 'bold' },
});
