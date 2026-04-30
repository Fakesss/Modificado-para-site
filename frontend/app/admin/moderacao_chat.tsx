import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api';

export default function ModeracaoChat() {
  const router = useRouter();
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [users, msgs] = await Promise.all([
        api.getUsuarios(),
        api.adminGetAllMensagens()
      ]);
      
      const map: any = {};
      users.forEach((u: any) => { map[u.id] = u.nome; });
      setUserMap(map);
      setMensagens(msgs);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar os dados.");
    }
    setLoading(false);
  };

  useEffect(() => { carregarDados(); }, []);

  const apagarMensagem = async (id: string) => {
    Alert.alert("Atenção", "Deseja deletar o conteúdo desta mensagem para os alunos?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
          try {
            await api.adminApagarMensagem(id);
            carregarDados();
          } catch (e) { Alert.alert("Erro", "Falha ao apagar mensagem."); }
      }}
    ]);
  };

  const gerenciarBloqueio = async (u1: string, u2: string, bloquear: boolean) => {
    const acao = bloquear ? "BLOQUEAR" : "DESBLOQUEAR";
    Alert.alert("Moderação", `Deseja ${acao} a comunicação direta entre estes dois alunos?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", style: "default", onPress: async () => {
          try {
            if (bloquear) await api.adminBloquearConversa(u1, u2);
            else await api.adminDesbloquearConversa(u1, u2);
            Alert.alert("Sucesso", `Ação aplicada.`);
          } catch (e) { Alert.alert("Erro", "Falha na operação."); }
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Ionicons name="shield-checkmark" size={32} color="#E74C3C" />
        <Text style={styles.headerTitle}>Moderação de Chat</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E74C3C" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={mensagens}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 15 }}
          renderItem={({ item }) => {
            const remetente = userMap[item.remetenteId] || 'Usuário Deletado';
            const destinatario = userMap[item.destinatarioId] || 'Usuário Deletado';
            
            return (
              <View style={styles.msgCard}>
                <View style={styles.msgHeader}>
                  <Text style={styles.msgHeaderTexto}>De: <Text style={{ color: '#00FFFF' }}>{remetente}</Text></Text>
                  <Text style={styles.msgHeaderTexto}>Para: <Text style={{ color: '#FFD700' }}>{destinatario}</Text></Text>
                </View>
                
                <View style={styles.msgBody}>
                  <Text style={[styles.msgTexto, item.apagadaPorAdmin && { color: '#FF4444', fontStyle: 'italic' }]}>
                    {item.texto}
                  </Text>
                  <Text style={styles.msgData}>{new Date(item.criadoEm).toLocaleString('pt-BR')}</Text>
                </View>

                <View style={styles.actions}>
                  {!item.apagadaPorAdmin && (
                    <TouchableOpacity style={styles.btnAcao} onPress={() => apagarMensagem(item.id)}>
                      <Ionicons name="trash" size={16} color="#FFF" />
                      <Text style={styles.btnAcaoTexto}>Apagar Msg</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity style={[styles.btnAcao, { backgroundColor: '#8B0000' }]} onPress={() => gerenciarBloqueio(item.remetenteId, item.destinatarioId, true)}>
                    <Ionicons name="lock-closed" size={16} color="#FFF" />
                    <Text style={styles.btnAcaoTexto}>Bloquear Par</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.btnAcao, { backgroundColor: '#2E8B57' }]} onPress={() => gerenciarBloqueio(item.remetenteId, item.destinatarioId, false)}>
                    <Ionicons name="lock-open" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma mensagem encontrada na rede.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF', marginLeft: 10 },
  msgCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(231, 76, 60, 0.3)' },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 8, marginBottom: 8 },
  msgHeaderTexto: { color: '#AAA', fontSize: 13, fontWeight: 'bold' },
  msgBody: { marginBottom: 10 },
  msgTexto: { color: '#FFF', fontSize: 16 },
  msgData: { color: '#555', fontSize: 11, marginTop: 6, textAlign: 'right' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
  btnAcao: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E74C3C', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, gap: 5 },
  btnAcaoTexto: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 30, fontStyle: 'italic' }
});
