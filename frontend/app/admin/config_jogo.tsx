import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as api from '../../src/services/api';
import { ConfiguracaoJogo } from '../../src/types';

const FAMILIAS_POWERUP: { id: string; nome: string }[] = [
  { id: 'DAMAGE', nome: 'Dano da Nave' },
  { id: 'FIRE_RATE', nome: 'Cadência de Tiro' },
  { id: 'TRIPLE_SHOT', nome: 'Tiro Triplo' },
  { id: 'HULL_UPGRADE', nome: 'Casco Reforçado' },
  { id: 'MISSILE', nome: 'Míssil Teleguiado' },
  { id: 'LASER', nome: 'Raio Laser' },
  { id: 'PULSAR', nome: 'Aura Pulsar' },
  { id: 'CHAIN', nome: 'Raio Cadeia' },
  { id: 'ELECTRIC', nome: 'Balas Elétricas' },
  { id: 'MINE', nome: 'Mina de Proximidade' },
  { id: 'FORCE_SHIELD', nome: 'Escudo de Força' },
  { id: 'DRONE', nome: 'Drones' },
  { id: 'TIME_FREEZE', nome: 'Congela Tempo' },
  { id: 'X_RAY', nome: 'Raio-X Matemático' },
];

const TIPOS_INIMIGO: { id: string; nome: string }[] = [
  { id: 'METEOR', nome: 'Meteoro' },
  { id: 'FLANKER', nome: 'Flanqueador' },
  { id: 'SHIELD_TANK', nome: 'Blindado' },
  { id: 'SWARMLING', nome: 'Enxame' },
  { id: 'SQUAD', nome: 'Esquadrão' },
  { id: 'SPAWNER', nome: 'Gerador' },
  { id: 'GHOST', nome: 'Fantasma Matemático' },
];

export default function AdminConfigJogo() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfiguracaoJogo | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    api.getConfiguracaoJogo('math_blaster').then((c) => { setConfig(c); setLoading(false); });
  }, []);

  const togglePowerup = (id: string) => {
    if (!config) return;
    const habilitados = config.powerupsHabilitados.includes(id)
      ? config.powerupsHabilitados.filter(p => p !== id)
      : [...config.powerupsHabilitados, id];
    setConfig({ ...config, powerupsHabilitados: habilitados });
  };

  const setSpawnChance = (tipo: string, valor: string) => {
    if (!config) return;
    const num = valor === '' ? 0 : Math.max(0, Math.min(300, parseInt(valor) || 0));
    setConfig({ ...config, spawnChancePorInimigo: { ...config.spawnChancePorInimigo, [tipo]: num } });
  };

  const salvar = async () => {
    if (!config) return;
    setSalvando(true);
    await api.salvarConfiguracaoJogo(config);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  };

  if (loading || !config) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.title}>Painel de Partida (Equações Espaciais)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.secaoTitulo}>TAXA DE DROP DE POWERUPS</Text>
        <Text style={styles.secaoDesc}>Controla a frequência com que powerups aparecem na partida.</Text>
        <View style={styles.sliderRow}>
          <Ionicons name="gift-outline" size={20} color="#FFD700" />
          <Slider
            style={{ flex: 1, height: 40, marginHorizontal: 10 }}
            minimumValue={0.25}
            maximumValue={3}
            step={0.05}
            value={config.dropRateMultiplier}
            onValueChange={(val) => setConfig({ ...config, dropRateMultiplier: val })}
            minimumTrackTintColor="#FFD700"
            maximumTrackTintColor="#333"
            thumbTintColor="#FFD700"
          />
          <Text style={styles.sliderValor}>x{config.dropRateMultiplier.toFixed(2)}</Text>
        </View>

        <Text style={styles.secaoTitulo}>POWERUPS HABILITADOS</Text>
        <Text style={styles.secaoDesc}>Desmarque famílias que não devem aparecer nesta partida.</Text>
        <View style={styles.gridCheckbox}>
          {FAMILIAS_POWERUP.map((fam) => {
            const ativo = config.powerupsHabilitados.includes(fam.id);
            return (
              <TouchableOpacity key={fam.id} style={styles.linhaCheckbox} onPress={() => togglePowerup(fam.id)}>
                <Ionicons name={ativo ? 'checkbox' : 'square-outline'} size={20} color={ativo ? '#FFD700' : '#666'} />
                <Text style={[styles.checkboxLabel, !ativo && { color: '#666' }]}>{fam.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.secaoTitulo}>CHANCE DE SPAWN POR INIMIGO</Text>
        <Text style={styles.secaoDesc}>100 = frequência padrão do jogo. 0 = nunca aparece. 200 = o dobro da frequência normal.</Text>
        {TIPOS_INIMIGO.map((tipo) => (
          <View key={tipo.id} style={styles.linhaSpawn}>
            <Text style={styles.linhaSpawnNome}>{tipo.nome}</Text>
            <View style={styles.spawnInputBox}>
              <TextInput
                style={styles.spawnInput}
                keyboardType="numeric"
                value={String(config.spawnChancePorInimigo[tipo.id] ?? 100)}
                onChangeText={(v) => setSpawnChance(tipo.id, v)}
              />
              <Text style={styles.spawnInputPct}>%</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.btnSalvar} onPress={salvar} disabled={salvando}>
          {salvando ? <ActivityIndicator size="small" color="#000" /> : (
            <Text style={styles.btnSalvarText}>{salvo ? 'SALVO!' : 'SALVAR CONFIGURAÇÃO'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  backButton: { padding: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  secaoTitulo: { color: '#FFD700', fontSize: 15, fontWeight: '900', letterSpacing: 1, marginTop: 24, marginBottom: 4 },
  secaoDesc: { color: '#888', fontSize: 12, marginBottom: 12 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  sliderValor: { color: '#FFD700', fontWeight: 'bold', fontSize: 13, minWidth: 50, textAlign: 'right' },
  gridCheckbox: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 6 },
  linhaCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10 },
  checkboxLabel: { color: '#EEE', fontSize: 13 },
  linhaSpawn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  linhaSpawnNome: { color: '#EEE', fontSize: 13, fontWeight: '600' },
  spawnInputBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  spawnInput: { backgroundColor: '#0c0c0c', color: '#FFD700', borderWidth: 1, borderColor: '#444', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, width: 60, textAlign: 'center', fontWeight: 'bold' },
  spawnInputPct: { color: '#888', fontSize: 12 },
  btnSalvar: { backgroundColor: '#FFD700', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 30 },
  btnSalvarText: { color: '#000', fontWeight: '900', fontSize: 14 },
});
