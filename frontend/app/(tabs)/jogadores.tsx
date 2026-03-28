import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { socket } from '../../src/services/socket';

export default function JogadoresOnline() {
  const { user } = useAuth();
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [activeMatches, setActiveMatches] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [abaAtual, setAbaAtual] = useState<'jogadores' | 'partidas'>('jogadores');
  const [aceitaConvites, setAceitaConvites] = useState(true);

  // Como o Socket é global (no _layout), nós só "espiamos" a lista que ele já está recebendo
  useEffect(() => {
    socket.emit('update_status', { status: 'MENU' });

    const atualizaJogadores = (data: any[]) => {
      // Pega todos, menos o próprio usuário, e garante que as opções do "Não Perturbe" dele estejam certas
      const eu = data.find(u => u.user_id === user?.id);
      if (eu) setAceitaConvites(eu.aceita_convites);
      setOnlineUsers(data.filter((u: any) => u.user_id !== user?.id));
    };

    socket.on('online_users_list', atualizaJogadores);
    socket.on('active_matches_list', setActiveMatches);

    // Pede ativamente a lista de partidas a cada 5 segundos para a aba de espectadores
    const interval = setInterval(() => socket.emit('get_active_matches'), 5000);

    return () => {
      socket.off('online_users_list', atualizaJogadores);
      socket.off('active_matches_list');
      clearInterval(interval);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    socket.emit('get_active_matches'); // Força a atualização manual
    setTimeout(() => setRefreshing(false), 1000);
  };

  const toggleNaoPerturbe = (valor: boolean) => {
    setAceitaConvites(valor);
    socket.emit('toggle_invites', { accepts: valor });
  };

  const convidarJogador = (sid: string, nome: string) => {
    Alert.alert(
      "Desafiar Jogador",
      `Deseja convidar ${nome} para qual jogo?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Jogo da Velha", onPress: () => socket.emit('send_invite', { target_sid: sid, game_type: 'tictactoe' }) }
      ]
    );
  };

  const assistirPartida = (roomId: string) => {
    router.push(`/tictactoe?spectate=${roomId}`);
  };

  const getStatusColor = (status: string) => {
    if (status === 'JOGANDO_ONLINE' || status === 'JOGANDO_OFFLINE') return '#FF4444'; // Ocupado (Vermelho)
    if (status === 'EXERCICIO') return '#FFD700'; // Estudando (Amarelo)
    return '#32CD32'; // Livre no Menu (Verde)
  };

  const getStatusText = (status: string) => {
    if (status === 'JOGANDO_ONLINE') return 'Em Partida Online';
    if (status === 'JOGANDO_OFFLINE') return 'Treinando (Offline)';
    if (status === 'EXERCICIO') return 'Resolvendo Atividades';
    return 'Livre no Menu';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="radio" size={28} color="#32CD32" />
        <Text style={styles.title}>Lobby Global</Text>
      </View>

      {/* MODO NÃO PERTURBE */}
      <View style={styles.dndContainer}>
        <View>
          <Text style={{color: '#FFF', fontWeight: 'bold'}}>Receber Convites</Text>
          <Text style={{color: '#888', fontSize: 12}}>Outros podem te desafiar</Text>
        </View>
        <Switch 
          value={aceitaConvites} 
          onValueChange={toggleNaoPerturbe} 
          trackColor={{ false: "#333", true: "#32CD32" }}
          thumbColor={aceitaConvites ? "#FFF" : "#888"}
        />
      </View>

      {/* NAVEGAÇÃO ENTRE ABAS */}
      <View style={styles.tabSelector}>
        <TouchableOpacity style={[styles.tabBtn, abaAtual === 'jogadores' && styles.tabActive]} onPress={() => setAbaAtual('jogadores')}>
          <Text style={[styles.tabText, abaAtual === 'jogadores' && styles.tabTextActive]}>Jogadores ({onlineUsers.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, abaAtual === 'partidas' && styles.tabActive]} onPress={() => setAbaAtual('partidas')}>
          <Text style={[styles.tabText, abaAtual === 'partidas' && styles.tabTextActive]}>Partidas Ao Vivo ({activeMatches.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#32CD32" />}>
        
        {/* ABA: JOGADORES */}
        {abaAtual === 'jogadores' && onlineUsers.map(jogador => (
          <View key={jogador.sid} style={styles.card}>
            <View style={styles.info}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <View style={[styles.onlineDot, { backgroundColor: getStatusColor(jogador.status) }]} />
                <Text style={styles.name}>{jogador.name}</Text>
              </View>
              <Text style={styles.statusText}>{getStatusText(jogador.status)}</Text>
            </View>

            {jogador.aceita_convites ? (
              <TouchableOpacity style={styles.btnAcao} onPress={() => convidarJogador(jogador.sid, jogador.name)}>
                <Ionicons name="game-controller" size={20} color="#FFF" />
                <Text style={styles.btnAcaoText}>Desafiar</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.btnAcao, { backgroundColor: '#333' }]}>
                <Ionicons name="moon-outline" size={16} color="#888" />
              </View>
            )}
          </View>
        ))}

        {/* ABA: PARTIDAS PARA ASSISTIR */}
        {abaAtual === 'partidas' && activeMatches.map(match => (
          <View key={match.room_id} style={styles.card}>
            <View style={styles.info}>
              <Text style={{color: '#FFD700', fontSize: 12, fontWeight: 'bold', marginBottom: 4}}>JOGO DA VELHA</Text>
              <Text style={styles.name}>{match.player1} <Text style={{color: '#FF4444'}}>vs</Text> {match.player2}</Text>
              <Text style={styles.statusText}>👁 {match.spectators_count} assistindo</Text>
            </View>
            <TouchableOpacity style={[styles.btnAcao, { backgroundColor: '#4169E1' }]} onPress={() => assistirPartida(match.room_id)}>
              <Ionicons name="eye" size={20} color="#FFF" />
              <Text style={styles.btnAcaoText}>Assistir</Text>
            </TouchableOpacity>
          </View>
        ))}

        {((abaAtual === 'jogadores' && onlineUsers.length === 0) || (abaAtual === 'partidas' && activeMatches.length === 0)) && (
          <View style={styles.empty}>
            <Ionicons name={abaAtual === 'jogadores' ? "people-outline" : "tv-outline"} size={48} color="#444" />
            <Text style={styles.emptyText}>{abaAtual === 'jogadores' ? 'Não há outros jogadores online.' : 'Nenhuma partida rolando no momento.'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 10, paddingBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  
  dndContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', marginHorizontal: 20, padding: 15, borderRadius: 12, marginBottom: 15 },

  tabSelector: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 4, marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#333' },
  tabText: { color: '#888', fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },

  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flex: 1 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  name: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  statusText: { color: '#888', fontSize: 12, marginTop: 4 },
  
  btnAcao: { backgroundColor: '#32CD32', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  btnAcaoText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  
  empty: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', marginTop: 10 }
});
