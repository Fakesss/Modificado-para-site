import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

export default function AdminEquipes() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, { nome: string; cor: string }>>({});

  useEffect(() => {
    loadEquipes();
  }, []);

  const loadEquipes = async () => {
    try {
      const data = await api.getEquipes();
      setEquipes(data);
      
      const initialEdits: Record<string, { nome: string; cor: string }> = {};
      data.forEach((eq: Equipe) => {
        initialEdits[eq.id] = { nome: eq.nome, cor: eq.cor || '#FFFFFF' };
      });
      setEdits(initialEdits);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as equipes.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (id: string) => {
    const dadosEditados = edits[id];
    if (!dadosEditados.nome || !dadosEditados.cor) {
      Alert.alert('Aviso', 'Nome e Cor são obrigatórios.');
      return;
    }

    setSavingId(id); // 🟢 Liga a bolinha do botão
    try {
      await api.updateEquipe(id, { nome: dadosEditados.nome, cor: dadosEditados.cor });
      Alert.alert('Sucesso', 'Equipe atualizada com sucesso!');
      await loadEquipes(); 
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar a equipe. Verifique sua conexão.');
    } finally {
      setSavingId(null); // 🔴 FIX: Desliga a bolinha do botão corretamente!
    }
  };

  const updateEdit = (id: string, field: 'nome' | 'cor', value: string) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={cores.dourado} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={cores.dourado} />
        </TouchableOpacity>
        <Text style={styles.title}>Gerenciar Equipes</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Altere o nome e a cor padrão (HEX) de cada equipe.</Text>
        
        {equipes.map((equipe) => {
          const currentEdit = edits[equipe.id] || { nome: equipe.nome, cor: equipe.cor };
          
          return (
            <View key={equipe.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.colorPreview, { backgroundColor: currentEdit.cor }]} />
                <Text style={styles.teamId}>ID: {equipe.id}</Text>
              </View>

              <Text style={styles.label}>Nome da Equipe</Text>
              <TextInput
                style={styles.input}
                value={currentEdit.nome}
                onChangeText={(text) => updateEdit(equipe.id, 'nome', text)}
                placeholder="Ex: Equipe Alfa"
                placeholderTextColor={cores.textoFraco}
              />

              <Text style={styles.label}>Cor Padrão (HEX)</Text>
              <TextInput
                style={styles.input}
                value={currentEdit.cor}
                onChangeText={(text) => updateEdit(equipe.id, 'cor', text)}
                placeholder="Ex: #FF0000"
                placeholderTextColor={cores.textoFraco}
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSave(equipe.id)}
                disabled={savingId === equipe.id}
              >
                {savingId === equipe.id ? (
                  <ActivityIndicator color={cores.sobreAcento} />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color={cores.sobreAcento} />
                    <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: cores.borda },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: cores.texto },
  content: { padding: 16 },
  subtitle: { color: cores.textoFraco, marginBottom: 24, fontSize: 14 },
  card: { backgroundColor: cores.superficie, padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: cores.borda },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  colorPreview: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: cores.borda },
  teamId: { color: cores.textoFraco, fontSize: 12 },
  label: { color: cores.texto, fontSize: 14, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: cores.fundo, color: cores.texto, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: cores.borda, marginBottom: 16, fontSize: 16 },
  saveButton: { backgroundColor: cores.dourado, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, gap: 8 },
  saveButtonText: { color: cores.sobreAcento, fontWeight: 'bold', fontSize: 16 },
});
