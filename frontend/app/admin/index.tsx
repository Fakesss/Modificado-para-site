import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert
} from 'react-native';
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
      const data = !isPreviewMode ? await api.getRelatorioGeral() : { totalUsuarios: 8, totalExercicios: 3 };
      setStats(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const navigateTo = (route: string) => {
    if (isPreviewMode) return Alert.alert('Modo Visualização', 'Funcionalidade restrita.');
    router.push(route as any);
  };

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator size="large" color="#FFD700" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadStats} tintColor="#FFD700" />}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Painel Administrativo</Text>
          <TouchableOpacity onPress={() => { isPreviewMode ? exitPreviewMode() : logout(); router.replace('/login'); }}>
            <Ionicons name="log-out-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Ionicons name="people" size={28} color="#4169E1" /><Text style={styles.statVal}>{stats?.totalUsuarios || 0}</Text><Text style={styles.statLbl}>Usuários</Text></View>
          <View style={styles.statCard}><Ionicons name="game-controller" size={28} color="#FF69B4" /><Text style={styles.statVal}>Jogos</Text><Text style={styles.statLbl}>Ativos</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Gerenciamento</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/usuarios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#4169E130' }]}><Ionicons name="people" size={24} color="#4169E1" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Usuários</Text><Text style={styles.menuDesc}>Alunos e Líderes</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/exercicios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFD70030' }]}><Ionicons name="document-text" size={24} color="#FFD700" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Exercícios</Text><Text style={styles.menuDesc}>Atividades</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/gerenciar-jogos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF69B430' }]}><Ionicons name="game-controller" size={24} color="#FF69B4" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Jogos Personalizados</Text><Text style={styles.menuDesc}>Missões e Desafios</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        {/* 🚨 NOVO BOTÃO DE CONFIGURAÇÃO */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/configuracoes')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF444430' }]}><Ionicons name="settings" size={24} color="#FF4444" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Configurações</Text><Text style={styles.menuDesc}>Vidas Padrão do Arcade</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.studentBtn} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="school" size={20} color="#FFD700" />
          <Text style={{color:'#FFD700', fontWeight:'bold'}}>Ver como Aluno</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 5 },
  statLbl: { fontSize: 12, color: '#888' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  menuIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuInfo: { flex: 1 },
  menuTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  menuDesc: { color: '#888', fontSize: 13 },
  studentBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD70020', borderRadius: 12, padding: 14, marginTop: 10, gap: 8 }
});
