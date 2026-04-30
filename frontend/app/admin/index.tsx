import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal, TextInput, Switch } from 'react-native';
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

  const [modalPremiacaoVisible, setModalPremiacaoVisible] = useState(false);
  const [pts1, setPts1] = useState('500');
  const [pts2, setPts2] = useState('300');
  const [pts3, setPts3] = useState('100');
  
  const [isAutoAtivo, setIsAutoAtivo] = useState(false);
  const [intervaloAuto, setIntervaloAuto] = useState<'semanal'|'mensal'>('semanal');
  const [diaSemana, setDiaSemana] = useState('Sexta-feira');
  const [diaMes, setDiaMes] = useState('15');

  const top3 = [
    { nome: 'Ana C.', pontos: 15420 },
    { nome: 'Pedro', pontos: 12300 },
    { nome: 'Lucas', pontos: 9800 }
  ];

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      if (!isPreviewMode) {
        const data = await api.getRelatorioGeral();
        setStats(data);
      } else {
        setStats({ totalUsuarios: 8, totalExercicios: 3, totalVideos: 5, totalSubmissoes: 12, mediaNotas: 7.5 });
      }
    } catch (error) {} finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadStats(); setRefreshing(false); };

  const handleLogout = async () => {
    if (isPreviewMode) { exitPreviewMode(); router.replace('/login'); } 
    else { await logout(); router.replace('/login'); }
  };

  const navigateTo = (route: string) => {
    if (isPreviewMode) { Alert.alert('Modo Visualização', 'As funcionalidades estão desabilitadas.', [{ text: 'OK' }]); return; }
    router.push(route as any);
  };

  const handlePremiarManualmente = () => {
    Alert.alert('Sucesso!', `Pontos enviados!\n\n🥇 ${top3[0].nome}: +${pts1} pts\n🥈 ${top3[1].nome}: +${pts2} pts\n🥉 ${top3[2].nome}: +${pts3} pts`);
    setModalPremiacaoVisible(false);
  };

  const handleSalvarAuto = () => {
    const freq = intervaloAuto === 'semanal' ? `toda ${diaSemana}` : `todo dia ${diaMes} do mês`;
    Alert.alert('Configuração Salva', `O sistema automático de premiação foi ${isAutoAtivo ? 'ATIVADO para rodar ' + freq : 'DESATIVADO'}.`);
  };

  const handleZerarRanking = () => {
    Alert.alert(
      "Aviso de Segurança!",
      "Você tem CERTEZA que deseja apagar a pontuação de TODOS os jogadores no Arcade? Essa ação não poderá ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sim, Zerar Tudo", style: "destructive", onPress: () => {
          Alert.alert("Sucesso", "O ranking do Arcade foi completamente zerado.");
          setModalPremiacaoVisible(false);
        }}
      ]
    );
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Painel Administrativo</Text>
            {isPreviewMode && (<View style={styles.previewBadge}><Ionicons name="eye" size={14} color="#FFD700" /><Text style={styles.previewText}>Modo Visualização</Text></View>)}
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}><Ionicons name="log-out-outline" size={24} color="#888" /></TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/usuarios')}><Ionicons name="people" size={28} color="#4169E1" /><Text style={styles.statValue}>{stats?.totalUsuarios || 0}</Text><Text style={styles.statLabel}>Usuários</Text></TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/conteudos')}><Ionicons name="play-circle" size={28} color="#32CD32" /><Text style={styles.statValue}>{stats?.totalVideos || 0}</Text><Text style={styles.statLabel}>Vídeos</Text></TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigateTo('/admin/exercicios')}><Ionicons name="document-text" size={28} color="#FFD700" /><Text style={styles.statValue}>{stats?.totalExercicios || 0}</Text><Text style={styles.statLabel}>Exercícios</Text></TouchableOpacity>
          <View style={styles.statCard}><Ionicons name="checkmark-circle" size={28} color="#9B59B6" /><Text style={styles.statValue}>{stats?.totalSubmissoes || 0}</Text><Text style={styles.statLabel}>Submissões</Text></View>
        </View>

        <View style={styles.averageCard}>
          <Ionicons name="analytics" size={32} color="#FFD700" />
          <View style={styles.averageInfo}>
            <Text style={styles.averageLabel}>Média Geral das Notas</Text>
            <Text style={styles.averageValue}>{stats?.mediaGeral?.toFixed(1) || '0.0'}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Gerenciamento</Text>
        
        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/usuarios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#4169E130' }]}><Ionicons name="people" size={24} color="#4169E1" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Usuários</Text><Text style={styles.menuDescription}>Gerenciar alunos e ocultar contas</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        {/* ======================================= */}
        {/* NOVO BOTÃO: MODERAÇÃO DO CHAT AQUI      */}
        {/* ======================================= */}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/moderacao_chat')}>
          <View style={[styles.menuIcon, { backgroundColor: '#E74C3C30' }]}><Ionicons name="shield-checkmark" size={24} color="#E74C3C" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Moderação de Chat</Text><Text style={styles.menuDescription}>Visualizar mensagens e bloquear conversas</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/conteudos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#32CD3230' }]}><Ionicons name="play-circle" size={24} color="#32CD32" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Conteúdos</Text><Text style={styles.menuDescription}>Gerenciar vídeos e materiais</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/exercicios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFD70030' }]}><Ionicons name="document-text" size={24} color="#FFD700" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Exercícios</Text><Text style={styles.menuDescription}>Criar e gerenciar atividades</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/gerenciar-jogos')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF69B430' }]}><Ionicons name="game-controller" size={24} color="#FF69B4" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Jogos Personalizados</Text><Text style={styles.menuDescription}>Criar missões e desafios específicos</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => setModalPremiacaoVisible(true)}>
          <View style={[styles.menuIcon, { backgroundColor: '#FFD70030' }]}><Ionicons name="trophy" size={24} color="#FFD700" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Premiação do Arcade</Text><Text style={styles.menuDescription}>Dar pontos e configurar robô automático</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/relatorios')}>
          <View style={[styles.menuIcon, { backgroundColor: '#9B59B630' }]}><Ionicons name="bar-chart" size={24} color="#9B59B6" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Relatórios</Text><Text style={styles.menuDescription}>Análises e habilidades BNCC</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/equipes')}>
          <View style={[styles.menuIcon, { backgroundColor: '#FF8C0030' }]}><Ionicons name="color-palette" size={24} color="#FF8C00" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Equipes</Text><Text style={styles.menuDescription}>Alterar nomes e cores padrão</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/cor-admin')}>
          <View style={[styles.menuIcon, { backgroundColor: '#00CED130' }]}><Ionicons name="color-wand" size={24} color="#00CED1" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Cor da Prévia</Text><Text style={styles.menuDescription}>Escolher sua cor para "Ver como aluno"</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigateTo('/admin/lixeira')}>
          <View style={[styles.menuIcon, { backgroundColor: '#E74C3C30' }]}><Ionicons name="trash" size={24} color="#E74C3C" /></View>
          <View style={styles.menuInfo}><Text style={styles.menuTitle}>Lixeira</Text><Text style={styles.menuDescription}>Itens excluídos (7 dias para restaurar)</Text></View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.studentViewButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="school" size={20} color="#FFD700" />
          <Text style={styles.studentViewText}>Ver como aluno</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalPremiacaoVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
               <Ionicons name="trophy" size={32} color="#FFD700" />
               <View style={{ marginLeft: 12 }}>
                 <Text style={styles.modalTitle}>Premiação do Arcade</Text>
                 <Text style={styles.modalSubtitle}>Configure os prêmios do Hall da Fama</Text>
               </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              
              <View style={styles.modalSection}>
                <Text style={styles.sectionLabelModal}>VALOR DO PRÊMIO</Text>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>🥇 1º Lugar:</Text>
                  <View style={styles.inputWrapper}><TextInput style={styles.inputPts} keyboardType="numeric" value={pts1} onChangeText={setPts1} /><Text style={styles.inputPtsSuffix}>pts</Text></View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>🥈 2º Lugar:</Text>
                  <View style={styles.inputWrapper}><TextInput style={styles.inputPts} keyboardType="numeric" value={pts2} onChangeText={setPts2} /><Text style={styles.inputPtsSuffix}>pts</Text></View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>🥉 3º Lugar:</Text>
                  <View style={styles.inputWrapper}><TextInput style={styles.inputPts} keyboardType="numeric" value={pts3} onChangeText={setPts3} /><Text style={styles.inputPtsSuffix}>pts</Text></View>
                </View>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionLabelModal}>PAGAMENTO MANUAL</Text>
                <Text style={styles.sectionDescModal}>Envie os pontos agora mesmo para os jogadores que estão no topo hoje.</Text>
                
                <View style={styles.top3Box}>
                  <Text style={styles.top3Item}><Text style={{color:'#FFD700'}}>🥇 1º {top3[0].nome}</Text> • {top3[0].pontos} pts</Text>
                  <Text style={styles.top3Item}><Text style={{color:'#C0C0C0'}}>🥈 2º {top3[1].nome}</Text> • {top3[1].pontos} pts</Text>
                  <Text style={styles.top3Item}><Text style={{color:'#CD7F32'}}>🥉 3º {top3[2].nome}</Text> • {top3[2].pontos} pts</Text>
                </View>
                
                <TouchableOpacity style={styles.btnPremiar} onPress={handlePremiarManualmente}>
                  <Ionicons name="send" size={18} color="#000" />
                  <Text style={styles.btnPremiarText}>ENVIAR PONTOS AGORA</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalSection}>
                 <Text style={styles.sectionLabelModal}>SISTEMA AUTOMÁTICO</Text>
                 <Text style={styles.sectionDescModal}>O servidor enviará os pontos sozinho para quem estiver no Top 3 no dia marcado.</Text>
                 
                 <View style={styles.switchRow}>
                   <Text style={styles.switchLabel}>Ativar Robô Automático?</Text>
                   <Switch value={isAutoAtivo} onValueChange={setIsAutoAtivo} trackColor={{ false: '#333', true: '#FFD700' }} thumbColor={isAutoAtivo ? '#fff' : '#888'} />
                 </View>

                 {isAutoAtivo && (
                   <View>
                     <View style={styles.intervaloContainer}>
                       <TouchableOpacity style={[styles.btnIntervalo, intervaloAuto === 'semanal' && styles.btnIntervaloAtivo]} onPress={() => setIntervaloAuto('semanal')}>
                         <Text style={[styles.txtIntervalo, intervaloAuto === 'semanal' && styles.txtIntervaloAtivo]}>Toda Semana</Text>
                       </TouchableOpacity>
                       <TouchableOpacity style={[styles.btnIntervalo, intervaloAuto === 'mensal' && styles.btnIntervaloAtivo]} onPress={() => setIntervaloAuto('mensal')}>
                         <Text style={[styles.txtIntervalo, intervaloAuto === 'mensal' && styles.txtIntervaloAtivo]}>Todo Mês</Text>
                       </TouchableOpacity>
                     </View>

                     {intervaloAuto === 'semanal' ? (
                       <View style={styles.diaRow}>
                         <Text style={styles.diaLabel}>Dia do pagamento:</Text>
                         <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                           {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map(dia => (
                             <TouchableOpacity key={dia} style={[styles.chipDia, diaSemana === dia && styles.chipDiaAtivo]} onPress={() => setDiaSemana(dia)}>
                               <Text style={[styles.txtDia, diaSemana === dia && {color: '#000'}]}>{dia}</Text>
                             </TouchableOpacity>
                           ))}
                         </ScrollView>
                       </View>
                     ) : (
                       <View style={styles.diaRow}>
                         <Text style={styles.diaLabel}>Dia do mês (1 a 31):</Text>
                         <TextInput style={styles.inputDiaMes} keyboardType="numeric" value={diaMes} onChangeText={setDiaMes} maxLength={2} />
                       </View>
                     )}
                   </View>
                 )}
                 
                 <TouchableOpacity style={styles.btnSalvarAuto} onPress={handleSalvarAuto}>
                    <Ionicons name="save-outline" size={18} color="#FFD700" />
                    <Text style={styles.btnSalvarAutoText}>SALVAR CONFIGURAÇÃO</Text>
                 </TouchableOpacity>
              </View>

              <View style={[styles.modalSection, { backgroundColor: 'rgba(231, 76, 60, 0.1)', borderColor: '#E74C3C50', borderWidth: 1 }]}>
                 <Text style={[styles.sectionLabelModal, { color: '#E74C3C' }]}>ZONA DE PERIGO</Text>
                 <Text style={styles.sectionDescModal}>Zerar a pontuação de todos os jogadores do Arcade de forma permanente.</Text>
                 <TouchableOpacity style={[styles.btnPremiar, { backgroundColor: '#E74C3C' }]} onPress={handleZerarRanking}>
                    <Ionicons name="trash-outline" size={18} color="#FFF" />
                    <Text style={[styles.btnPremiarText, { color: '#FFF' }]}>ZERAR RANKING DO ARCADE</Text>
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1a1a2e', borderRadius: 24, padding: 24, maxHeight: '85%', borderWidth: 1, borderColor: '#FFD70040' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 15 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  modalSubtitle: { color: '#888', fontSize: 14, marginTop: 2 },
  modalSection: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 16, marginBottom: 15 },
  sectionLabelModal: { color: '#FFF', fontWeight: 'bold', fontSize: 14, letterSpacing: 1, marginBottom: 5 },
  sectionDescModal: { color: '#888', fontSize: 13, marginBottom: 15 },
  
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  inputLabel: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center' },
  inputPts: { color: '#FFD700', fontSize: 20, fontWeight: '900', textAlign: 'right', minWidth: 60 },
  inputPtsSuffix: { color: '#888', fontSize: 14, marginLeft: 5, fontWeight: 'bold' },
  
  top3Box: { backgroundColor: '#0c0c0c', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  top3Item: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },

  btnPremiar: { flexDirection: 'row', backgroundColor: '#FFD700', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPremiarText: { color: '#000', fontWeight: '900', fontSize: 16 },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 15, marginBottom: 10 },
  switchLabel: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  intervaloContainer: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btnIntervalo: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  btnIntervaloAtivo: { backgroundColor: 'rgba(255, 215, 0, 0.15)', borderColor: '#FFD700' },
  txtIntervalo: { color: '#888', fontWeight: 'bold' },
  txtIntervaloAtivo: { color: '#FFD700' },
  
  diaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 12, marginBottom: 10 },
  diaLabel: { color: '#FFF', fontSize: 14, marginRight: 10 },
  chipDia: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#333', marginRight: 8 },
  chipDiaAtivo: { backgroundColor: '#FFD700' },
  txtDia: { color: '#AAA', fontSize: 13, fontWeight: 'bold' },
  inputDiaMes: { backgroundColor: '#333', color: '#FFD700', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 8, minWidth: 50, textAlign: 'center' },

  btnSalvarAuto: { flexDirection: 'row', borderWidth: 2, borderColor: '#FFD700', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 5, gap: 8 },
  btnSalvarAutoText: { color: '#FFD700', fontWeight: '900', fontSize: 15 },
  btnFechar: { padding: 15, alignItems: 'center', marginTop: 10 },
  btnFecharText: { color: '#888', fontWeight: 'bold', fontSize: 16 }
});
