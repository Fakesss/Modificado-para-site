import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as api from '../src/services/api';
import { useTema, CoresTema } from '../src/context/ThemeContext';
import { CartelaMissoes as CartelaMissoesTipo } from '../src/types';
import CartelaMissoes from '../src/components/CartelaMissoes';

// =============================================================================
// CARTELA DE MISSÕES — tela do aluno (somente leitura). Mostra as estrelas que
// o professor já concedeu; quem dá/tira estrela é o professor, em
// admin/cartela_missoes.tsx.
// =============================================================================

type Estado = 'carregando' | 'ok' | 'erro';

export default function CartelaMissoesAluno() {
  const router = useRouter();
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const [cartela, setCartela] = useState<CartelaMissoesTipo | null>(null);
  const [estado, setEstado] = useState<Estado>('carregando');

  // A cartela vem do servidor. Se ele não responder (fora do ar, acordando ou
  // sem internet) a API devolve null — aí mostramos o aviso com "Tentar de
  // novo", nunca uma roda girando pra sempre.
  const carregar = useCallback(() => {
    setEstado('carregando');
    api.getMinhaCartelaMissoes()
      .then((c) => {
        if (c) { setCartela(c); setEstado('ok'); }
        else { setEstado('erro'); }
      })
      .catch(() => setEstado('erro'));
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={cores.ambar} />
        </TouchableOpacity>
        <Text style={styles.title}>Cartela de Missões</Text>
        <View style={{ width: 40 }} />
      </View>

      {estado === 'carregando' && (
        <ActivityIndicator size="large" color={cores.ambar} style={{ marginTop: 60 }} />
      )}

      {estado === 'erro' && (
        <View style={styles.aviso}>
          <Ionicons name="cloud-offline-outline" size={44} color={cores.textoFraco} />
          <Text style={styles.avisoTitulo}>Não consegui carregar sua cartela</Text>
          <Text style={styles.avisoTexto}>
            O servidor pode estar acordando. Espere alguns segundos e tente de novo.
          </Text>
          <TouchableOpacity style={styles.botao} onPress={carregar}>
            <Ionicons name="refresh" size={18} color={cores.sobreAcento} />
            <Text style={styles.botaoTexto}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}

      {estado === 'ok' && cartela && (
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

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: cores.borda, backgroundColor: cores.barra },
  backButton: { padding: 4 },
  title: { color: cores.texto, fontSize: 17, fontWeight: '900' },
  scroll: { padding: 18, paddingBottom: 50 },
  explicacao: { color: cores.textoFraco, fontSize: 13, textAlign: 'center', marginBottom: 18, lineHeight: 19 },
  aviso: { alignItems: 'center', paddingHorizontal: 32, marginTop: 70, gap: 10 },
  avisoTitulo: { color: cores.texto, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  avisoTexto: { color: cores.textoFraco, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  botao: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cores.ambar, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, marginTop: 8 },
  botaoTexto: { color: cores.sobreAcento, fontWeight: '900', fontSize: 14 },
});
