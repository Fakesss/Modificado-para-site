import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

export default function AdminGerenciarConteudos() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
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
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={cores.dourado} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={cores.texto} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Gerenciar Conteúdos</Text>
        <TouchableOpacity onPress={() => router.push('/admin/criar-conteudo')}>
          <Ionicons name="add-circle" size={28} color={cores.dourado} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cores.dourado} />}>
        
        {conteudos.map((conteudo) => (
          <View key={conteudo.id} style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons 
                name={conteudo.tipo === 'VIDEO' ? 'play' : conteudo.tipo === 'LINK' ? 'link' : 'document'} 
                size={28} 
                color={conteudo.tipo === 'VIDEO' ? cores.azul : conteudo.tipo === 'LINK' ? cores.sucesso : cores.dourado} 
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
                <Ionicons name="pencil" size={20} color={cores.dourado} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(conteudo.id)}>
                <Ionicons name="trash" size={20} color={cores.erro} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {conteudos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={cores.textoFraco} />
            <Text style={styles.emptyText}>Nenhum conteúdo cadastrado</Text>
            <TouchableOpacity style={styles.createButton} onPress={() => router.push('/admin/criar-conteudo')}>
              <Ionicons name="add" size={20} color={cores.sobreAcento} />
              <Text style={styles.createButtonText}>Criar Primeiro Conteúdo</Text>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficie, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardIcon: { width: 56, height: 56, backgroundColor: cores.textoFraco + '18', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardTitle: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', marginTop: 8 },
  badge: { backgroundColor: cores.borda, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: cores.texto },
  cardActions: { gap: 8 },
  actionButton: { padding: 8, backgroundColor: cores.superficieAlt, borderRadius: 8 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: cores.textoFraco, fontSize: 16, marginTop: 16, marginBottom: 20 },
  createButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.dourado, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8 },
  createButtonText: { color: cores.sobreAcento, fontWeight: 'bold' },
});
