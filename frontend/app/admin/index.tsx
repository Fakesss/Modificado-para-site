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
  Switch
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

  // ==========================================
  // ESTADOS DO MODAL DE PREMIAÇÃO DO ARCADE
  // ==========================================
  const [modalPremiacaoVisible, setModalPremiacaoVisible] = useState(false);
  const [pts1, setPts1] = useState('500');
  const [pts2, setPts2] = useState('300');
  const [pts3, setPts3] = useState('100');
  const [isAutoAtivo, setIsAutoAtivo] = useState(false);
  const [intervaloAuto, setIntervaloAuto] = useState<'semanal'|'mensal'>('semanal');

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

  // Funções simuladas para a Premiação do Arcade (Serão conectadas ao Python depois)
  const handlePremiarManualmente = async () => {
    Alert.alert('Sucesso!', `Você acaba de dar pontos aos 3 melhores do ranking Arcade!\n\n🥇 1º: +${pts1} pts\n🥈 2º: +${pts2} pts\n🥉 3º: +${pts3} pts`);
    setModalPremiacaoVisible(false);
  };

  const handleSalvarAuto = async () => {
    Alert.alert('Configuração Salva', `O sistema automático de premiação foi ${isAutoAtivo ? 'ATIVADO para rodar de forma ' + intervaloAuto.toUpperCase() : 'DESATIVADO'}.`);
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

        {/* Stats Grid */}
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

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={28} color="#9B59B6" />
            <Text style={styles.statValue}>{stats?.totalSubmissoes || 0}</Text>
            <Text style={styles.statLabel}>Submissões</Text>
          </View>
        </View>

        {/* Average Grade */}
        <View style={styles.averageCard}>
          <Ionicons name="analytics" size={32} color="#FFD700" />
          <View style={styles.averageInfo}>
            <Text style={styles.averageLabel}>Média Geral das Notas</Text>
            <Text style={styles.averageValue}>{stats?.mediaGeral?.toFixed(1) || '0.0'}</Text>
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

        {/* NOVO BOTÃO: PREMIAÇÃO DO ARCADE */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setModalPremiacaoVisible(true)}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFD700' + '30' }]}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
          </View>
          <View style={styles.menuInfo}>
            <Text style={styles.menuTitle}>Premiação do Arcade</Text>
            <Text style={styles.menuDescription}>Dar pontos e configurar robô automático</Text>
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

      {/* ========================================== */}
      {/* MODAL DE PREMIAÇÃO DO ARCADE               */}
      {/* ========================================== */}
      <Modal visible={modalPremiacaoVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
               <Ionicons name="trophy" size={32} color="#FFD700" />
               <View style={{ marginLeft: 12 }}>
                 <Text style={styles.modalTitle}>Premiação do Arcade</Text>
                 <Text style={styles.modalSubtitle}>Recompense os reis do Hall da Fama</Text>
               </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              
              {/* SESSÃO MANUAL */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabelModal}>DISTRIBUIÇÃO MANUAL</Text>
                <Text style={styles.sectionDescModal}>Dê pontos extras imediatamente para os 3 primeiros colocados do ranking atual.</Text>
                
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>🥇 1º Lugar:</Text>
                  <View style={styles.inputWrapper}>
                     <TextInput style={styles.inputPts} keyboardType="numeric" value={pts1} onChangeText={setPts1} />
                     <Text style={styles.inputPtsSuffix}>pts</Text>
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>🥈 2º Lugar:</Text>
                  <View style={styles.inputWrapper}>
                     <TextInput style={styles.inputPts} keyboardType="numeric" value={pts2} onChangeText={setPts2} />
                     <Text style={styles.inputPtsSuffix}>pts</Text>
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>🥉 3º Lugar:</Text>
                  <View style={styles.inputWrapper}>
                     <TextInput style={styles.inputPts} keyboardType="numeric" value={pts3} onChangeText={setPts3} />
                     <Text style={styles.inputPtsSuffix}>pts</Text>
                  </View>
                </View>
                
                <TouchableOpacity style={styles.btnPremiar} onPress={handlePremiarManualmente}>
                  <Ionicons name="send" size={18} color="#000" />
                  <Text style={styles.btnPremiarText}>PREMIAR AGORA</Text>
                </TouchableOpacity>
              </View>

              {/* SESSÃO AUTOMÁTICA */}
              <View style={styles.modalSection}>
                 <Text style={styles.sectionLabelModal}>SISTEMA AUTOMÁTICO</Text>
                 <Text style={styles.sectionDescModal}>Programe o servidor para limpar o ranking e dar os pontos aos ganhadores sozinho.</Text>
                 
                 <View style={styles.switchRow}>
                   <Text style={styles.switchLabel}>Ativar Robô Automático?</Text>
                   <Switch 
                      value={isAutoAtivo} 
                      onValueChange={setIsAutoAtivo} 
                      trackColor={{ false: '#333', true: '#FFD700' }} 
                      thumbColor={isAutoAtivo ? '#fff' : '#888'} 
                   />
                 </View>

                 {isAutoAtivo && (
                   <View style={styles.intervaloContainer}>
                     <TouchableOpacity style={[styles.btnIntervalo, intervaloAuto === 'semanal' && styles.btnIntervaloAtivo]} onPress={() => setIntervaloAuto('semanal')}>
                       <Text style={[styles.txtIntervalo, intervaloAuto === 'semanal' && styles.txtIntervaloAtivo]}>Toda Semana</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.btnIntervalo, intervaloAuto === 'mensal' && styles.btnIntervaloAtivo]} onPress={() => setIntervaloAuto('mensal')}>
                       <Text style={[styles.txtIntervalo, intervaloAuto === 'mensal' && styles.txtIntervaloAtivo]}>Todo Mês</Text>
                     </TouchableOpacity>
                   </View>
                 )}
                 
                 <TouchableOpacity style={styles.btnSalvarAuto} onPress={handleSalvarAuto}>
                    <Ionicons name="save-outline" size={18} color="#FFD700" />
                    <Text style={styles.btnSalvarAutoText}>SALVAR CONFIGURAÇÃO</Text>
                 </TouchableOpacity>
              </View>

            </ScrollView>

            <TouchableOpacity style={styles.btnFechar} onPress={() => setModalPremiacaoVisible(false)}>
              <Text style={styles.btnFecharText}>VOLTAR</Text>
            </TouchableOpacity>
            
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

  // ==========================================
  // ESTILOS DO MODAL DE PREMIAÇÃO
  // ==========================================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 15,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 2,
  },
  modalSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 15,
  },
  sectionLabelModal: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 5,
  },
  sectionDescModal: {
    color: '#888',
    fontSize: 13,
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputPts: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    minWidth: 60,
  },
  inputPtsSuffix: {
    color: '#888',
    fontSize: 14,
    marginLeft: 5,
    fontWeight: 'bold',
  },
  btnPremiar: {
    flexDirection: 'row',
    backgroundColor: '#FFD700',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  btnPremiarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  switchLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  intervaloContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  btnIntervalo: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  btnIntervaloAtivo: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: '#FFD700',
  },
  txtIntervalo: {
    color: '#888',
    fontWeight: 'bold',
  },
  txtIntervaloAtivo: {
    color: '#FFD700',
  },
  btnSalvarAuto: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: '#FFD700',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    gap: 8,
  },
  btnSalvarAutoText: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 15,
  },
  btnFechar: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  btnFecharText: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
