import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';

export default function AdminEquipes() {
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
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
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
                placeholderTextColor="#666"
              />

              <Text style={styles.label}>Cor Padrão (HEX)</Text>
              <TextInput
                style={styles.input}
                value={currentEdit.cor}
                onChangeText={(text) => updateEdit(equipe.id, 'cor', text)}
                placeholder="Ex: #FF0000"
                placeholderTextColor="#666"
                autoCapitalize="characters"
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSave(equipe.id)}
                disabled={savingId === equipe.id}
              >
                {savingId === equipe.id ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#000" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  content: { padding: 16 },
  subtitle: { color: '#888', marginBottom: 24, fontSize: 14 },
  card: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  colorPreview: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#fff' },
  teamId: { color: '#666', fontSize: 12 },
  label: { color: '#fff', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#0c0c0c', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333', marginBottom: 16, fontSize: 16 },
  saveButton: { backgroundColor: '#FFD700', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, gap: 8 },
  saveButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
