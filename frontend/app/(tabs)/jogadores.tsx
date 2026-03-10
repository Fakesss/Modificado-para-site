// app/(tabs)/jogadores.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { buscarUsuariosOnline } from '../../src/services/multiplayerApi';
import { useAuth } from '../../src/context/AuthContext';

export default function JogadoresOnline() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadOnline = async () => {
    setRefreshing(true);
    const data = await buscarUsuariosOnline();
    // Remove você mesmo da lista para não aparecer "desafiar a si mesmo"
    setOnlineUsers(data.filter((u: any) => u.id !== user?.id));
    setRefreshing(false);
  };

  useEffect(() => {
    loadOnline();
    // Atualiza a tela a cada 10 segundos automaticamente
    const interval = setInterval(loadOnline, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="radio" size={28} color="#32CD32" />
        <Text style={styles.title}>Lobby Multiplayer</Text>
      </View>
      <Text style={styles.subTitle}>{onlineUsers.length} jogadores online agora</Text>

      <ScrollView 
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOnline} tintColor="#32CD32" />}
      >
        {onlineUsers.map(jogador => (
          <View key={jogador.id} style={styles.card}>
            <View style={styles.info}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <View style={styles.onlineDot} />
                <Text style={styles.name}>{jogador.nome}</Text>
              </View>
              {/* No futuro podemos buscar o nome da turma/equipe. Por enquanto mostramos que o ID está lá pronto pro Matchmaking */}
              <Text style={styles.statusText}>Aguardando partida...</Text>
            </View>
            <View style={styles.btnDesafiarPlaceholder}>
              <Ionicons name="game-controller-outline" size={20} color="#666" />
            </View>
          </View>
        ))}

        {onlineUsers.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="moon-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>Não há outros jogadores online.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 10, paddingBottom: 5 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subTitle: { color: '#888', paddingHorizontal: 20, marginBottom: 20 },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1 },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#32CD32' },
  name: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusText: { color: '#666', fontSize: 12, marginTop: 4, marginLeft: 16 },
  btnDesafiarPlaceholder: { backgroundColor: '#333', padding: 10, borderRadius: 8 },
  empty: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', marginTop: 10 }
});
