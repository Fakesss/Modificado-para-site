import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';

export default function CorAdmin() {
  const router = useRouter();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [customColor, setCustomColor] = useState('#FFD700');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      // Puxa as equipes do banco
      const data = await api.getEquipes();
      setEquipes(data);

      // Verifica se o Admin já tem uma cor salva no celular
      const savedColor = await AsyncStorage.getItem('adminPreviewColor');
      if (savedColor) {
        setCustomColor(savedColor);
      }
    } catch (error) {
      console.log('Erro ao carregar dados', error);
    } finally {
      setLoading(false);
    }
  };

  const salvarCor = async (cor: string) => {
    try {
      await AsyncStorage.setItem('adminPreviewColor', cor);
      setCustomColor(cor);
      Alert.alert('Sucesso', 'Sua cor de visualização foi atualizada! Volte e clique em "Ver como aluno".');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar sua cor.');
    }
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
        <Text style={styles.title}>Cor da Prévia (Admin)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Escolha como o aplicativo deve ficar quando você clicar em "Ver como aluno".
        </Text>

        {/* Cor Atual do Admin */}
        <View style={[styles.card, { borderColor: customColor }]}>
          <Text style={styles.label}>Sua Cor Atual</Text>
          <View style={styles.currentView}>
            <View style={[styles.colorPreviewLarge, { backgroundColor: customColor }]} />
            <Text style={styles.hexText}>{customColor}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Opção 1: Usar cor de uma Equipe</Text>
        {equipes.map((equipe) => (
          <TouchableOpacity 
            key={equipe.id} 
            style={styles.teamButton}
            onPress={() => salvarCor(equipe.cor || '#FFFFFF')}
          >
            <View style={[styles.colorPreview, { backgroundColor: equipe.cor || '#FFFFFF' }]} />
            <Text style={styles.teamButtonText}>Usar cor da {equipe.nome}</Text>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Opção 2: Cor Exclusiva (HEX)</Text>
        <View style={styles.customInputContainer}>
          <TextInput
            style={styles.input}
            value={customColor}
            onChangeText={setCustomColor}
            placeholder="#FFFFFF"
            placeholderTextColor="#666"
            autoCapitalize="characters"
            maxLength={7}
          />
          <TouchableOpacity 
            style={styles.saveCustomButton}
            onPress={() => salvarCor(customColor)}
          >
            <Text style={styles.saveCustomButtonText}>Salvar Cor</Text>
          </TouchableOpacity>
        </View>

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
  subtitle: { color: '#888', marginBottom: 20, fontSize: 14 },
  card: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1 },
  label: { color: '#fff', fontSize: 14, marginBottom: 12, fontWeight: 'bold' },
  currentView: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorPreviewLarge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  hexText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  teamButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  colorPreview: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#fff', marginRight: 12 },
  teamButtonText: { color: '#fff', fontSize: 16 },
  customInputContainer: { flexDirection: 'row', gap: 12 },
  input: { flex: 1, backgroundColor: '#1a1a2e', color: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333', fontSize: 16 },
  saveCustomButton: { backgroundColor: '#FFD700', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  saveCustomButtonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
