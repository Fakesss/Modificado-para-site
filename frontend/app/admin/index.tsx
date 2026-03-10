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
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

export default function AdminHome() {
  const { user, logout, isPreviewMode, exitPreviewMode } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      if (!isPreviewMode) {
        const data = await api.getRelatorioGeral();
        setStats(data);
      } else {
        // Mock data for preview mode
        setStats({
          totalUsuarios: 8,
          totalExercicios: 3,
          totalVideos: 5,
          totalSubmissoes: 12,
          mediaNotas: 7.5,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    if (isPreviewMode) {
      exitPreviewMode();
      router.replace('/login');
    } else {
      await logout();
      router.replace('/login');
    }
  };

  const navigateTo = (route: string) => {
    if (isPreviewMode) {
      Alert.alert(
        'Modo Visualização',
        'Você está no modo de visualização. As funcionalidades estão desabilitadas.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push(route as any);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Painel Administrativo</Text>
            {isPreviewMode && (
              <View style={styles.previewBadge}>
                <Ionicons name="eye" size={14} color="#FFD700" />
                <Text style={styles.previewText}>Modo Visualização</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Stats Grid - AGORA SÃO BOTÕES CLICÁVEIS */}
        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/usuarios')}>
            <Ionicons name="people" size={28} color="#4169E1" />
            <Text style={styles.statValue}>{stats?.totalUsuarios || 0}</Text>
            <Text style={styles.statLabel}>Usuários</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/conteudos')}>
            <Ionicons name="play-circle" size={28} color="#32CD32" />
            <Text style={styles.statValue}>{stats?.totalVideos || 0}</Text>
            <Text style={styles.statLabel}>Vídeos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/exercicios')}>
            <Ionicons name="document-text" size={28} color="#FFD700" />
            <Text style={styles.statValue}>{stats?.totalExercicios || 0}</Text>
            <Text style={styles.statLabel}>Exercícios</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/relatorios')}>
            <Ionicons name="checkmark-circle" size={28} color="#9B59B6" />
            <Text style={styles.statValue}>{stats?.totalSubmissoes || 0}</Text>
            <Text style={styles.statLabel}>Submissões</Text>
          </TouchableOpacity>
        </View>

        {/* Average Grade */}
        <View style={styles.averageCard}>
          <Ionicons name="analytics" size={32} color="#FFD700" />
          <View style={styles.averageInfo}>
            <Text style={styles.averageLabel}>Média Geral das Notas</Text>
            <Text style={styles.averageValue}>{stats?.mediaNotas?.toFixed(1) || '0.0'}</Text>
          </View>
        </View>

        {/* Menu Options */}
        <Text style={styles.sectionTitle}>Gerenciamento</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/usuarios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#4169E1' + '30' }]}>
            <Ionicons name="people" size={24} color="#4169E1" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Usuários</Text>
            <Text style={styles.menuDescription}>Gerenciar alunos, líderes e administradores</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/conteudos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#32CD32' + '30' }]}>
            <Ionicons name="play-circle" size={24} color="#32CD32" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Conteúdos</Text>
            <Text style={styles.menuDescription}>Gerenciar vídeos e materiais</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/exercicios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFD700' + '30' }]}>
            <Ionicons name="document-text" size={24} color="#FFD700" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Exercícios</Text>
            <Text style={styles.menuDescription}>Criar e gerenciar atividades</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/gerenciar-jogos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF69B4' + '30' }]}>
            <Ionicons name="game-controller" size={24} color="#FF69B4" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Jogos Personalizados</Text>
            <Text style={styles.menuDescription}>Criar missões e desafios específicos</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/relatorios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#9B59B6' + '30' }]}>
            <Ionicons name="bar-chart" size={24} color="#9B59B6" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Relatórios</Text>
            <Text style={styles.menuDescription}>Análises e habilidades BNCC</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/equipes')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF8C00' + '30' }]}>
            <Ionicons name="color-palette" size={24} color="#FF8C00" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Equipes</Text>
            <Text style={styles.menuDescription}>Alterar nomes e cores padrão</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/cor-admin')}>
          <View style={[styles.menuIcon, { backgroundColor: '#00CED1' + '30' }]}>
            <Ionicons name="color-wand" size={24} color="#00CED1" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Cor da Prévia</Text>
            <Text style={styles.menuDescription}>Escolher sua cor para "Ver como aluno"</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/lixeira')}>
          <View style={[styles.menuIcon, { backgroundColor: '#E74C3C' + '30' }]}>
            <Ionicons name="trash" size={24} color="#E74C3C" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Lixeira</Text>
            <Text style={styles.menuDescription}>Itens excluídos (7 dias para restaurar)</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        {/* Go to Student View */}
        <TouchableOpacity
          style={styles.studentViewButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="school" size={20} color="#FFD700" />
          <Text style={styles.studentViewText}>Ver como aluno</Text>
        </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700' + '30',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    gap: 4,
  },
  previewText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  averageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  averageInfo: {
    flex: 1,
  },
  averageLabel: {
    color: '#888',
    fontSize: 14,
  },
  averageValue: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuDescription: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  studentViewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700' + '20',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    gap: 8,
  },
  studentViewText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
});
