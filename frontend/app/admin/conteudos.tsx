import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';

export default function AdminGerenciarConteudos() {
  const router = useRouter();
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.getConteudos();
      setConteudos(data);
    } catch (error) {
      console.error('Error loading conteudos:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === 'web') {
      const confirmou = window.confirm('Deseja mover este conteúdo para a lixeira?');
      if (confirmou) {
        try {
          await api.deleteConteudo(id); // Chamada da API para deletar
          window.alert('Conteúdo movido para a lixeira!');
          loadData();
        } catch (error) { window.alert('Erro ao mover conteúdo'); }
      }
    } else {
      Alert.alert('Mover para Lixeira', 'Deseja mover este conteúdo para a lixeira?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Mover', style: 'destructive', onPress: async () => {
            try {
              await api.deleteConteudo(id);
              Alert.alert('Sucesso', 'Conteúdo movido para a lixeira');
              loadData();
            } catch (error) { Alert.alert('Erro', 'Erro ao mover conteúdo'); }
          },
        },
      ]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFD700" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Conteúdos</Text>
        <TouchableOpacity onPress={() => router.push('/admin/criar-conteudo')}>
          <Ionicons name="add-circle" size={28} color="#FFD700" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}>
        
        {conteudos.map((conteudo) => (
          <View key={conteudo.id} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons 
                name={conteudo.tipo === 'VIDEO' ? 'play' : conteudo.tipo === 'LINK' ? 'link' : 'document'} 
                size={28} 
                color={conteudo.tipo === 'VIDEO' ? '#4169E1' : conteudo.tipo === 'LINK' ? '#32CD32' : '#FFD700'} 
              />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{conteudo.titulo}</Text>
              <View style={styles.cardMeta}>
                <View style={styles.badge}><Text style={styles.badgeText}>{conteudo.tipo}</Text></View>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => router.push({ pathname: '/admin/criar-conteudo', params: { id: conteudo.id } })}>
                <Ionicons name="pencil" size={20} color="#FFD700" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(conteudo.id)}>
                <Ionicons name="trash" size={20} color="#E74C3C" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {conteudos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum conteúdo cadastrado</Text>
            <TouchableOpacity style={styles.createButton} onPress={() => router.push('/admin/criar-conteudo')}>
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.createButtonText}>Criar Primeiro Conteúdo</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardIcon: { width: 56, height: 56, backgroundColor: '#ffffff10', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', marginTop: 8 },
  badge: { backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  cardActions: { gap: 8 },
  actionButton: { padding: 8, backgroundColor: '#252540', borderRadius: 8 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16, marginBottom: 20 },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8 },
  createButtonText: { color: '#000', fontWeight: 'bold' },
});
