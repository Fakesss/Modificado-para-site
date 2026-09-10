import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api';
import { Usuario, Turma, CartelaMissoes as CartelaMissoesTipo } from '../../src/types';
import CartelaMissoes from '../../src/components/CartelaMissoes';

// =============================================================================
// CARTELA DE MISSÕES — visão do professor: escolhe um aluno na lista e dá (ou
// tira, pra corrigir engano) estrelas uma a uma. O aluno só enxerga o
// resultado (tela cartela_missoes.tsx, somente leitura) — quem decide aqui é
// sempre o professor.
// =============================================================================

export default function AdminCartelaMissoes() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [busca, setBusca] = useState('');
  const [carregandoLista, setCarregandoLista] = useState(true);

  const [alunoSelecionado, setAlunoSelecionado] = useState<Usuario | null>(null);
  const [cartela, setCartela] = useState<CartelaMissoesTipo | null>(null);
  const [carregandoCartela, setCarregandoCartela] = useState(false);
  const [ajustando, setAjustando] = useState(false);

  useEffect(() => {
    Promise.all([api.getUsuarios(), api.getTurmas()]).then(([u, t]) => {
      setUsuarios(Array.isArray(u) ? u : []);
      setTurmas(Array.isArray(t) ? t : []);
      setCarregandoLista(false);
    });
  }, []);

  const alunos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios
      .filter((u) => u.perfil !== 'ADMIN')
      .filter((u) => !termo || (u.nome || '').toLowerCase().includes(termo))
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [usuarios, busca]);

  const nomeTurma = (turmaId?: string) => turmas.find((t) => t.id === turmaId)?.nome;

  const abrirAluno = async (aluno: Usuario) => {
    setAlunoSelecionado(aluno);
    setCarregandoCartela(true);
    const c = await api.getCartelaMissoesAluno(aluno.id!);
    setCartela(c);
    setCarregandoCartela(false);
  };

  const ajustar = async (delta: 1 | -1) => {
    if (!alunoSelecionado || ajustando) return;
    setAjustando(true);
    try {
      const atualizada = await api.ajustarCartelaMissoes(alunoSelecionado.id!, delta);
      setCartela(atualizada);
    } catch {}
    setAjustando(false);
  };

  // ---------- Detalhe de um aluno ----------
  if (alunoSelecionado) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { setAlunoSelecionado(null); setCartela(null); }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFB300" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{alunoSelecionado.nome}</Text>
          <View style={{ width: 40 }} />
        </View>

        {carregandoCartela || !cartela ? (
          <ActivityIndicator size="large" color="#FFB300" style={{ marginTop: 60 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <CartelaMissoes estrelas={cartela.estrelas} total={cartela.total} />

            <View style={styles.controles}>
              <TouchableOpacity
                style={[styles.btnAjuste, styles.btnTirar, cartela.estrelas <= 0 && styles.btnDesativado]}
                disabled={cartela.estrelas <= 0 || ajustando}
                onPress={() => ajustar(-1)}
              >
                <Ionicons name="remove-circle-outline" size={20} color="#FF7055" />
                <Text style={styles.btnTirarTexto}>TIRAR ESTRELA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnAjuste, styles.btnDar, cartela.estrelas >= cartela.total && styles.btnDesativado]}
                disabled={cartela.estrelas >= cartela.total || ajustando}
                onPress={() => ajustar(1)}
              >
                {ajustando ? <ActivityIndicator size="small" color="#1a1200" /> : (
                  <>
                    <Ionicons name="star" size={20} color="#1a1200" />
                    <Text style={styles.btnDarTexto}>DAR ESTRELA</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ---------- Lista de alunos ----------
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFB300" />
        </TouchableOpacity>
        <Text style={styles.title}>Cartela de Missões</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.buscaBox}>
        <Ionicons name="search" size={16} color="#776" />
        <TextInput
          style={styles.buscaInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar aluno..."
          placeholderTextColor="#556"
        />
      </View>

      {carregandoLista ? (
        <ActivityIndicator size="large" color="#FFB300" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {alunos.map((aluno) => (
            <TouchableOpacity key={aluno.id} style={styles.alunoCard} onPress={() => abrirAluno(aluno)} activeOpacity={0.8}>
              <View style={styles.alunoAvatar}><Ionicons name="person" size={20} color="#FFB300" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alunoNome}>{aluno.nome}</Text>
                {nomeTurma(aluno.turmaId) ? <Text style={styles.alunoTurma}>{nomeTurma(aluno.turmaId)}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#556" />
            </TouchableOpacity>
          ))}
          {alunos.length === 0 && (
            <Text style={styles.vazioTexto}>Nenhum aluno encontrado.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b04' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1c2430' },
  backButton: { padding: 4 },
  title: { color: '#FFF', fontSize: 17, fontWeight: '900', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { padding: 18, paddingBottom: 50 },

  buscaBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1a1608', borderRadius: 12, borderWidth: 1, borderColor: '#332a10', marginHorizontal: 18, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10 },
  buscaInput: { flex: 1, color: '#FFF', fontSize: 14 },

  alunoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1a1608', borderRadius: 14, borderWidth: 1, borderColor: '#332a10', padding: 14, marginBottom: 10 },
  alunoAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0d0b04', alignItems: 'center', justifyContent: 'center' },
  alunoNome: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  alunoTurma: { color: '#887', fontSize: 12, marginTop: 2 },
  vazioTexto: { color: '#667', fontSize: 13, textAlign: 'center', marginTop: 30 },

  controles: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnAjuste: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14 },
  btnDar: { backgroundColor: '#FFB300' },
  btnDarTexto: { color: '#1a1200', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  btnTirar: { borderWidth: 2, borderColor: '#FF7055' },
  btnTirarTexto: { color: '#FF7055', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  btnDesativado: { opacity: 0.4 },
});
