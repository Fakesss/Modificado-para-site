import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as api from '../../src/services/api';

export default function Relatorios() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  const [turmas, setTurmas] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  
  const [filtroTipo, setFiltroTipo] = useState('GERAL'); 
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [bnccData, setBnccData] = useState<any[]>([]);

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearTipo, setClearTipo] = useState('TUDO');
  const [clearTargetId, setClearTargetId] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => { loadBaseData(); }, []);
  useEffect(() => { loadRelatorio(); }, [filtroTipo, selectedTurma, selectedEquipe]);

  useEffect(() => {
    if (filtroTipo === 'TURMA' && turmas.length > 0 && !selectedTurma) setSelectedTurma(turmas[0].id);
    if (filtroTipo === 'EQUIPE' && equipes.length > 0 && !selectedEquipe) setSelectedEquipe(equipes[0].id);
    if (filtroTipo === 'EQUIPE_TURMA') {
        if (turmas.length > 0 && !selectedTurma) setSelectedTurma(turmas[0].id);
        if (equipes.length > 0 && !selectedEquipe) setSelectedEquipe(equipes[0].id);
    }
  }, [filtroTipo, turmas, equipes]);

  const loadBaseData = async () => {
    try {
      const [t, e, u] = await Promise.all([api.getTurmas(), api.getEquipes(), api.getUsuarios()]);
      setTurmas(t); setEquipes(e); setUsuarios(u);
      if (t.length > 0) setSelectedTurma(t[0].id);
      if (e.length > 0) setSelectedEquipe(e[0].id);
    } catch (error) { console.error(error); }
  };

  const loadRelatorio = async () => {
    setLoading(true);
    try {
      const data = await api.getBNCCRelatorio(filtroTipo, selectedTurma, selectedEquipe);
      setBnccData(data);
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const baixarRelatorioTXT = async () => {
    if (bnccData.length === 0) return Alert.alert("Aviso", "Não há dados para exportar.");

    const maisErradas = [...bnccData].sort((a, b) => b.erros - a.erros);
    const maisAcertadas = [...bnccData].sort((a, b) => b.acertos - a.acertos);

    let txt = `=================================\n`;
    txt += `  RELATÓRIO DE DESEMPENHO BNCC   \n`;
    txt += `=================================\n\n`;
    txt += `Data da Exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    txt += `Filtro Utilizado: ${filtroTipo}\n\n`;

    txt += `--- TABELA: MAIS ERRADAS ---\n`;
    maisErradas.forEach((item, i) => {
        txt += `${i+1}º ${item.habilidade} -> Erros: ${item.erros} | Acertos: ${item.acertos} | Total Feito: ${item.total}\n`;
    });

    txt += `\n--- TABELA: MAIS ACERTADAS ---\n`;
    maisAcertadas.forEach((item, i) => {
        txt += `${i+1}º ${item.habilidade} -> Acertos: ${item.acertos} | Erros: ${item.erros} | Total Feito: ${item.total}\n`;
    });

    const fileName = `Relatorio_BNCC_${new Date().getTime()}.txt`;

    if (Platform.OS === 'web') {
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
    } else {
        try {
            // A MÁGICA DE PERMISSÃO: Substituímos documentDirectory por cacheDirectory
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
            await FileSystem.writeAsStringAsync(fileUri, txt, { encoding: FileSystem.EncodingType.UTF8 });
            
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Salvar Relatório' });
            } else {
                Alert.alert("Erro", "O compartilhamento não está disponível neste dispositivo.");
            }
        } catch (e) {
            console.log(e);
            Alert.alert("Erro", "Não foi possível compartilhar o arquivo TXT.");
        }
    }
  };

  const handleLimparDados = async () => {
    if (clearTipo !== 'TUDO' && !clearTargetId) return Alert.alert("Aviso", "Selecione a turma ou o usuário.");
    setIsClearing(true);
    try {
        await api.limparRelatorioBNCC(clearTipo, clearTargetId);
        Alert.alert("Sucesso", "O histórico foi arquivado e o relatório zerado para os critérios selecionados.");
        setShowClearModal(false);
        loadRelatorio(); 
    } catch (e) { Alert.alert("Erro", "Falha ao limpar relatório."); }
    finally { setIsClearing(false); }
  };

  const renderFiltros = () => (
    <View style={styles.filtrosContainer}>
      <Text style={styles.label}>Visualizar por:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
        {['GERAL', 'TURMA', 'EQUIPE', 'EQUIPE_TURMA'].map((f) => (
          <TouchableOpacity key={f} style={[styles.chip, filtroTipo === f && styles.chipActive]} onPress={() => setFiltroTipo(f)}>
            <Text style={[styles.chipText, filtroTipo === f && styles.chipTextActive]}>
              {f === 'EQUIPE_TURMA' ? 'Equipe por Turma' : f.charAt(0) + f.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {(filtroTipo === 'TURMA' || filtroTipo === 'EQUIPE_TURMA') && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {turmas.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.chip, selectedTurma === t.id && styles.chipActive]} onPress={() => setSelectedTurma(t.id)}>
              <Text style={[styles.chipText, selectedTurma === t.id && styles.chipTextActive]}>{t.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {(filtroTipo === 'EQUIPE' || filtroTipo === 'EQUIPE_TURMA') && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {equipes.map((e) => (
            <TouchableOpacity key={e.id} style={[styles.chip, selectedEquipe === e.id && styles.chipActive]} onPress={() => setSelectedEquipe(e.id)}>
              <View style={[styles.colorDot, { backgroundColor: e.cor }]} />
              <Text style={[styles.chipText, selectedEquipe === e.id && styles.chipTextActive]}>{e.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      <View style={styles.acoesRow}>
          <TouchableOpacity style={styles.acaoBtn} onPress={baixarRelatorioTXT}>
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={styles.acaoText}>Baixar Relatório (TXT)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.acaoBtn, {backgroundColor: '#FF450020', borderColor: '#FF4500'}]} onPress={() => setShowClearModal(true)}>
              <Ionicons name="trash-bin" size={18} color="#FF4500" />
              <Text style={[styles.acaoText, {color: '#FF4500'}]}>Zerar Dados</Text>
          </TouchableOpacity>
      </View>
    </View>
  );

  const maisErradas = [...bnccData].sort((a, b) => b.erros - a.erros).filter(i => i.erros > 0).slice(0, 10);
  const maisAcertadas = [...bnccData].sort((a, b) => b.acertos - a.acertos).filter(i => i.acertos > 0).slice(0, 10);

  const renderGraficoBarra = (item: any) => {
      const pctAcerto = (item.acertos / item.total) * 100;
      const pctErro = (item.erros / item.total) * 100;
      return (
          <View style={styles.graficoContainer}>
              <View style={styles.graficoBarraBackground}>
                  {pctAcerto > 0 && <View style={[styles.graficoFillAcerto, { width: `${pctAcerto}%` }]} />}
                  {pctErro > 0 && <View style={[styles.graficoFillErro, { width: `${pctErro}%` }]} />}
              </View>
              <View style={styles.graficoLegendRow}>
                  <Text style={{color: '#32CD32', fontSize: 11, fontWeight: 'bold'}}>{item.acertos} Acertos</Text>
                  <Text style={{color: '#888', fontSize: 11}}>{item.total} Total</Text>
                  <Text style={{color: '#FF4500', fontSize: 11, fontWeight: 'bold'}}>{item.erros} Erros</Text>
              </View>
          </View>
      );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Relatórios e Gráficos</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderFiltros()}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>⚠️ Gráfico: Mais Erradas</Text>
          {maisErradas.length > 0 ? maisErradas.map((item, index) => (
            <View key={`err-${item.habilidade}`} style={styles.card}>
              <View style={styles.cardHeader}>
                  <View style={styles.rankBadge}><Text style={styles.rankText}>{index + 1}º</Text></View>
                  <Text style={styles.bnccTitle}>{item.habilidade}</Text>
              </View>
              {renderGraficoBarra(item)}
            </View>
          )) : <Text style={styles.emptyText}>Nenhum erro registrado neste filtro.</Text>}

          <Text style={[styles.sectionTitle, { marginTop: 24, color: '#32CD32' }]}>🏆 Gráfico: Mais Acertadas</Text>
          {maisAcertadas.length > 0 ? maisAcertadas.map((item, index) => (
            <View key={`ac-${item.habilidade}`} style={styles.card}>
              <View style={styles.cardHeader}>
                  <View style={[styles.rankBadge, { backgroundColor: '#32CD3220' }]}><Text style={[styles.rankText, { color: '#32CD32' }]}>{index + 1}º</Text></View>
                  <Text style={styles.bnccTitle}>{item.habilidade}</Text>
              </View>
              {renderGraficoBarra(item)}
            </View>
          )) : <Text style={styles.emptyText}>Nenhum acerto registrado neste filtro.</Text>}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      <Modal visible={showClearModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Ionicons name="warning" size={40} color="#FF4500" style={{marginBottom: 10}} />
                <Text style={styles.modalTitle}>Zerar Relatório</Text>
                <Text style={styles.modalSub}>Isso ocultará os dados antigos dos gráficos. Os pontos dos alunos serão mantidos.</Text>
                
                <Text style={[styles.label, {width: '100%', marginTop: 10}]}>Apagar histórico de:</Text>
                <View style={styles.modalTabs}>
                    {['TUDO', 'TURMA', 'USUARIO'].map(t => (
                        <TouchableOpacity key={t} style={[styles.modalTab, clearTipo === t && styles.modalTabActive]} onPress={() => {setClearTipo(t); setClearTargetId('');}}>
                            <Text style={{color: clearTipo === t ? '#000' : '#888', fontSize: 12, fontWeight: 'bold'}}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {clearTipo === 'TURMA' && (
                    <ScrollView horizontal style={styles.chipsScroll} showsHorizontalScrollIndicator={false}>
                        {turmas.map(t => (
                            <TouchableOpacity key={t.id} style={[styles.chip, clearTargetId === t.id && styles.chipActive]} onPress={() => setClearTargetId(t.id)}>
                                <Text style={[styles.chipText, clearTargetId === t.id && styles.chipTextActive]}>{t.nome}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {clearTipo === 'USUARIO' && (
                    <ScrollView horizontal style={styles.chipsScroll} showsHorizontalScrollIndicator={false}>
                        {usuarios.map(u => (
                            <TouchableOpacity key={u.id} style={[styles.chip, clearTargetId === u.id && styles.chipActive]} onPress={() => setClearTargetId(u.id)}>
                                <Text style={[styles.chipText, clearTargetId === u.id && styles.chipTextActive]}>{u.nome.split(' ')[0]}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                <View style={{flexDirection: 'row', gap: 10, marginTop: 20}}>
                    <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setShowClearModal(false)}>
                        <Text style={{color: '#fff', fontWeight: 'bold'}}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalBtnConfirm} onPress={handleLimparDados} disabled={isClearing}>
                        {isClearing ? <ActivityIndicator color="#fff" /> : <Text style={{color: '#fff', fontWeight: 'bold'}}>Confirmar Limpeza</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#151520' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  filtrosContainer: { padding: 16, backgroundColor: '#151520', borderBottomWidth: 1, borderBottomColor: '#222' },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  chipsScroll: { marginBottom: 8, maxHeight: 40 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  chipText: { color: '#aaa', fontWeight: 'bold' },
  chipTextActive: { color: '#000' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  
  acoesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, gap: 10 },
  acaoBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', gap: 8 },
  acaoText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  content: { padding: 16 },
  sectionTitle: { color: '#FF4500', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  
  card: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF450020', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { color: '#FF4500', fontWeight: 'bold', fontSize: 14 },
  bnccTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  
  graficoContainer: { width: '100%' },
  graficoBarraBackground: { flexDirection: 'row', height: 16, width: '100%', backgroundColor: '#333', borderRadius: 8, overflow: 'hidden', marginBottom: 8 },
  graficoFillAcerto: { height: '100%', backgroundColor: '#32CD32' },
  graficoFillErro: { height: '100%', backgroundColor: '#FF4500' },
  graficoLegendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  
  emptyText: { color: '#666', fontStyle: 'italic', marginBottom: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#151520', width: '100%', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  modalSub: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  modalTabs: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 4, width: '100%', marginBottom: 15 },
  modalTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  modalTabActive: { backgroundColor: '#FFD700' },
  modalBtnCancel: { flex: 1, padding: 14, backgroundColor: '#333', borderRadius: 10, alignItems: 'center' },
  modalBtnConfirm: { flex: 1, padding: 14, backgroundColor: '#FF4500', borderRadius: 10, alignItems: 'center' }
});
