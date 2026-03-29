import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';

export default function Relatorios() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  const [turmas, setTurmas] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  
  // Nossos super filtros: GERAL, TURMA, EQUIPE, EQUIPE_TURMA
  const [filtroTipo, setFiltroTipo] = useState('GERAL'); 
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  
  const [bnccData, setBnccData] = useState<any[]>([]);

  useEffect(() => {
    loadBaseData();
  }, []);

  // Assim que os filtros mudam, ele atualiza a tabela
  useEffect(() => {
    loadRelatorio();
  }, [filtroTipo, selectedTurma, selectedEquipe]);

  // Garante que algo esteja selecionado ao clicar na aba
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
      const [t, e] = await Promise.all([api.getTurmas(), api.getEquipes()]);
      setTurmas(t);
      setEquipes(e);
      if (t.length > 0) setSelectedTurma(t[0].id);
      if (e.length > 0) setSelectedEquipe(e[0].id);
    } catch (error) {
      console.error(error);
    }
  };

  const loadRelatorio = async () => {
    setLoading(true);
    try {
      const data = await api.getBNCCRelatorio(filtroTipo, selectedTurma, selectedEquipe);
      setBnccData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderFiltros = () => {
    return (
      <View style={styles.filtrosContainer}>
        <Text style={styles.label}>Visualizar por:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {['GERAL', 'TURMA', 'EQUIPE', 'EQUIPE_TURMA'].map((f) => (
            <TouchableOpacity 
              key={f} 
              style={[styles.chip, filtroTipo === f && styles.chipActive]}
              onPress={() => setFiltroTipo(f)}
            >
              <Text style={[styles.chipText, filtroTipo === f && styles.chipTextActive]}>
                {f === 'EQUIPE_TURMA' ? 'Equipe por Turma' : f.charAt(0) + f.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {(filtroTipo === 'TURMA' || filtroTipo === 'EQUIPE_TURMA') && (
          <>
            <Text style={styles.label}>Qual Turma?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {turmas.map((t) => (
                <TouchableOpacity 
                  key={t.id} 
                  style={[styles.chip, selectedTurma === t.id && styles.chipActive]}
                  onPress={() => setSelectedTurma(t.id)}
                >
                  <Text style={[styles.chipText, selectedTurma === t.id && styles.chipTextActive]}>{t.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {(filtroTipo === 'EQUIPE' || filtroTipo === 'EQUIPE_TURMA') && (
          <>
            <Text style={styles.label}>Qual Equipe?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {equipes.map((e) => (
                <TouchableOpacity 
                  key={e.id} 
                  style={[styles.chip, selectedEquipe === e.id && styles.chipActive]}
                  onPress={() => setSelectedEquipe(e.id)}
                >
                  <View style={[styles.colorDot, { backgroundColor: e.cor }]} />
                  <Text style={[styles.chipText, selectedEquipe === e.id && styles.chipTextActive]}>{e.nome}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    );
  };

  // Separa as Top 10 Erros e Top 10 Acertos (com base nos totais)
  const maisErradas = [...bnccData].sort((a, b) => b.erros - a.erros).filter(item => item.erros > 0).slice(0, 10);
  const maisAcertadas = [...bnccData].sort((a, b) => b.acertos - a.acertos).filter(item => item.acertos > 0).slice(0, 10);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relatório da BNCC</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderFiltros()}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>⚠️ Mais Erradas</Text>
          {maisErradas.length > 0 ? maisErradas.map((item, index) => (
            <View key={`err-${item.habilidade}`} style={styles.card}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}º</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.bnccTitle}>{item.habilidade}</Text>
                <Text style={styles.bnccStats}>Erros: {item.erros} | Acertos: {item.acertos} | Total: {item.total}</Text>
              </View>
              <View style={styles.errorBar}>
                <View style={[styles.errorFill, { width: `${(item.erros / item.total) * 100}%` }]} />
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>Nenhum erro registrado neste filtro.</Text>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 24, color: '#32CD32' }]}>🏆 Mais Acertadas</Text>
          {maisAcertadas.length > 0 ? maisAcertadas.map((item, index) => (
            <View key={`ac-${item.habilidade}`} style={styles.card}>
              <View style={[styles.rankBadge, { backgroundColor: '#32CD3220' }]}>
                <Text style={[styles.rankText, { color: '#32CD32' }]}>{index + 1}º</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.bnccTitle}>{item.habilidade}</Text>
                <Text style={styles.bnccStats}>Acertos: {item.acertos} | Erros: {item.erros} | Total: {item.total}</Text>
              </View>
              <View style={[styles.errorBar, { backgroundColor: '#222' }]}>
                <View style={[styles.errorFill, { backgroundColor: '#32CD32', width: `${(item.acertos / item.total) * 100}%` }]} />
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>Nenhum acerto registrado neste filtro.</Text>
          )}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#151520' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  filtrosContainer: { padding: 16, backgroundColor: '#151520', borderBottomWidth: 1, borderBottomColor: '#222' },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  chipsScroll: { marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#333' },
  chipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  chipText: { color: '#aaa', fontWeight: 'bold' },
  chipTextActive: { color: '#000' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  
  content: { padding: 16 },
  sectionTitle: { color: '#FF4500', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  card: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  rankBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF450020', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankText: { color: '#FF4500', fontWeight: 'bold', fontSize: 16 },
  cardInfo: { flex: 1 },
  bnccTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  bnccStats: { color: '#888', fontSize: 12 },
  errorBar: { width: 60, height: 6, backgroundColor: '#333', borderRadius: 3, marginLeft: 12, overflow: 'hidden' },
  errorFill: { height: '100%', backgroundColor: '#FF4500' },
  emptyText: { color: '#666', fontStyle: 'italic', marginBottom: 20 }
});
