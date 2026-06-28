import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';
import ReinoView from '../../src/components/ReinoView';

export default function AdminReino() {
  const router = useRouter();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipeSelecionada, setEquipeSelecionada] = useState<Equipe | null>(null);

  useEffect(() => {
    api.getEquipes().then((data) => {
      setEquipes(data);
      if (data.length > 0) setEquipeSelecionada(data[0]);
      setLoading(false);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFD700" />
        </TouchableOpacity>
        <Text style={styles.title}>Reino (Admin)</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.adminBanner}>
        <Ionicons name="infinite" size={18} color="#FFD700" />
        <Text style={styles.adminBannerText}>MODO ADMIN: RECURSOS INFINITOS</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 50 }} />
      ) : equipes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>Nenhuma equipe cadastrada</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            {equipes.map((equipe) => {
              const ativa = equipeSelecionada?.id === equipe.id;
              return (
                <TouchableOpacity
                  key={equipe.id}
                  style={[styles.filterButton, ativa && { backgroundColor: equipe.cor || '#FFD700' }]}
                  onPress={() => setEquipeSelecionada(equipe)}
                >
                  <Text style={[styles.filterText, ativa && styles.filterTextActive]}>{equipe.nome}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {equipeSelecionada && (
            <ReinoView
              key={equipeSelecionada.id}
              equipeId={equipeSelecionada.id}
              equipeCor={equipeSelecionada.cor || '#FFD700'}
              equipeNome={equipeSelecionada.nome}
              isAdmin
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD70040',
  },
  adminBannerText: { color: '#FFD700', fontSize: 13, fontWeight: '600' },
  filterContainer: { maxHeight: 50, marginTop: 12 },
  filterContent: { paddingHorizontal: 16, gap: 10 },
  filterButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1a1a2e' },
  filterText: { color: '#888', fontWeight: '600' },
  filterTextActive: { color: '#000' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
