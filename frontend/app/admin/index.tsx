import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

export default function AdminHome() {
  const { user, logout, isPreviewMode, exitPreviewMode } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const data = !isPreviewMode ? await api.getRelatorioGeral() : { totalUsuarios: 8, totalExercicios: 3, totalVideos: 5, totalSubmissoes: 12, mediaNotas: 7.5 };
      setStats(data || {});
    } catch (e) { setStats({}); } 
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };
  const nav = (r: string) => { if (isPreviewMode) return Alert.alert('Modo Visualização', 'Funcionalidade restrita.'); router.push(r as any); };
  const handleLogout = async () => { if (isPreviewMode) { exitPreviewMode(); router.replace('/login'); } else { await logout(); router.replace('/login'); } };

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#FFD700" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Painel Administrativo</Text>
            {isPreviewMode && (<View style={styles.previewBadge}><Ionicons name="eye" size={14} color="#FFD700" /><Text style={styles.previewText}>Modo Visualização</Text></View>)}
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}><Ionicons name="log-out-outline" size={24} color="#888" /></TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Ionicons name="people" size={28} color="#4169E1" /><Text style={styles.statValue}>{stats?.totalUsuarios || 0}</Text><Text style={styles.statLabel}>Usuários</Text></View>
          <View style={styles.statCard}><Ionicons name="play-circle" size={28} color="#32CD32" /><Text style={styles.statValue}>{stats?.totalVideos || 0}</Text><Text style={styles.statLabel}>Vídeos</Text></View>
          <View style={styles.statCard}><Ionicons name="document-text" size={28} color="#FFD700" /><Text style={styles.statValue}>{stats?.totalExercicios || 0}</Text><Text style={styles.statLabel}>Exercícios</Text></View>
          <View style={styles.statCard}><Ionicons name="checkmark-circle" size={28} color="#9B59B6" /><Text style={styles.statValue}>{stats?.totalSubmissoes || 0}</Text><Text style={styles.statLabel}>Submissões</Text></View>
        </View>

        <View style={styles.averageCard}>
          <Ionicons name="analytics" size={32} color="#FFD700" />
          <View style={styles.averageInfo}><Text style={styles.averageLabel}>Média Geral das Notas</Text><Text style={styles.averageValue}>{stats?.mediaNotas?.toFixed(1) || '0.0'}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Gerenciamento</Text>
        
        {/* 🚨 BOTÃO NOVO: TURMAS */}
        <TouchableOpacity style={styles.menuItem} onPress={() => nav('/admin/turmas')}>
          <View style={[styles.menuIcon, { backgroundColor: '#32CD32' + '30' }]}><Ionicons name="library" size={24} color="#32CD32" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Turmas e Séries</Text><Text style={styles.menuDescription}>Criar e gerenciar anos escolares</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => nav('/admin/equipes')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF8C00' + '30' }]}><Ionicons name="shield" size={24} color="#FF8C00" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Equipes</Text><Text style={styles.menuDescription}>Alterar nomes, cores e criar times</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => nav('/admin/usuarios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#4169E1' + '30' }]}><Ionicons name="people" size={24} color="#4169E1" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Usuários</Text><Text style={styles.menuDescription}>Gerenciar alunos e líderes</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => nav('/admin/conteudos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#32CD32' + '30' }]}><Ionicons name="play-circle" size={24} color="#32CD32" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Conteúdos</Text><Text style={styles.menuDescription}>Gerenciar vídeos e materiais</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => nav('/admin/exercicios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFD700' + '30' }]}><Ionicons name="document-text" size={24} color="#FFD700" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Exercícios</Text><Text style={styles.menuDescription}>Criar e gerenciar atividades</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => nav('/admin/gerenciar-jogos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF69B4' + '30' }]}><Ionicons name="game-controller" size={24} color="#FF69B4" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Jogos Personalizados</Text><Text style={styles.menuDescription}>Criar missões e desafios</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        {/* Botão de Ver como Aluno */}
        <TouchableOpacity style={styles.studentViewButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="school" size={20} color="#FFD700" />
          <Text style={styles.studentViewText}>Ver como aluno</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  previewBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70030', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8, gap: 4 },
  previewText: { color: '#FFD700', fontSize: 12, fontWeight: '600' },
  logoutButton: { padding: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statCard: { width: '47%', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  averageCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 24, gap: 16 },
  averageInfo: { flex: 1 },
  averageLabel: { color: '#888', fontSize: 14 },
  averageValue: { color: '#FFD700', fontSize: 32, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  menuIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuInfo: { flex: 1 },
  menuTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  menuDescription: { color: '#888', fontSize: 13, marginTop: 2 },
  studentViewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD70020', borderRadius: 12, paddingVertical: 14, marginTop: 16, gap: 8 },
  studentViewText: { color: '#FFD700', fontSize: 16, fontWeight: '600' },
});
