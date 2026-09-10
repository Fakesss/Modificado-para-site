import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as api from '../src/services/api';
import { CartelaMissoes as CartelaMissoesTipo } from '../src/types';
import CartelaMissoes from '../src/components/CartelaMissoes';

// =============================================================================
// CARTELA DE MISSÕES — tela do aluno (somente leitura). Mostra as estrelas que
// o professor já concedeu; quem dá/tira estrela é o professor, em
// admin/cartela_missoes.tsx.
// =============================================================================

export default function CartelaMissoesAluno() {
  const router = useRouter();
  const [cartela, setCartela] = useState<CartelaMissoesTipo | null>(null);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(useCallback(() => {
    api.getMinhaCartelaMissoes().then((c) => { setCartela(c); setCarregando(false); });
  }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFB300" />
        </TouchableOpacity>
        <Text style={styles.title}>Cartela de Missões</Text>
        <View style={{ width: 40 }} />
      </View>

      {carregando || !cartela ? (
        <ActivityIndicator size="large" color="#FFB300" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.explicacao}>
            Cada estrela é uma missão cumprida — quem concede é o seu professor. Complete a cartela toda!
          </Text>
          <CartelaMissoes estrelas={cartela.estrelas} total={cartela.total} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0b04' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1c2430' },
  backButton: { padding: 4 },
  title: { color: '#FFF', fontSize: 17, fontWeight: '900' },
  scroll: { padding: 18, paddingBottom: 50 },
  explicacao: { color: '#998', fontSize: 13, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
});
