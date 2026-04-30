import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

export default function ChatScreen() {
  const { user } = useAuth();
  const [view, setView] = useState<'lista' | 'conversa'>('lista');
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [contatoAtual, setContatoAtual] = useState<any>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const carregarUsuarios = async () => {
    setLoading(true);
    try {
      const users = await api.getUsuarios();
      setUsuarios(users.filter((u: any) => u.id !== user?.id));
    } catch (e) {}
    setLoading(false);
  };

  const carregarConversa = async (otherUserId: string) => {
    try {
      const msgs = await api.getConversaPrivada(otherUserId);
      setMensagens(msgs);
    } catch (e) {}
  };

  useEffect(() => {
    if (view === 'lista') {
      carregarUsuarios();
      if (pollingRef.current) clearInterval(pollingRef.current);
    } else if (view === 'conversa' && contatoAtual) {
      carregarConversa(contatoAtual.id);
      pollingRef.current = setInterval(() => {
        carregarConversa(contatoAtual.id);
      }, 5000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [view, contatoAtual]);

  const abrirConversa = (contato: any) => {
    setContatoAtual(contato);
    setView('conversa');
  };

  const voltarLista = () => {
    setView('lista');
    setContatoAtual(null);
    setMensagens([]);
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || !contatoAtual) return;
    const txt = texto.trim();
    setTexto('');
    try {
      await api.enviarMensagemPrivada(contatoAtual.id, txt);
      await carregarConversa(contatoAtual.id);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (error: any) {
      Alert.alert("Erro", error.response?.data?.detail || "Não foi possível enviar a mensagem.");
    }
  };

  if (view === 'lista') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Ionicons name="chatbubbles" size={32} color="#00FFFF" />
          <Text style={styles.headerTitle}>Mensagens</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="large" color="#00FFFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={usuarios}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userCard} onPress={() => abrirConversa(item)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{item.nome} {item.perfil === 'ADMIN' && '👑'}</Text>
                  <Text style={styles.userStatus}>{item.perfil === 'ADMIN' ? 'Professor' : 'Aluno'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#555" />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Nenhum usuário encontrado.</Text>}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={voltarLista} style={{ padding: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.chatHeaderName}>{contatoAtual?.nome}</Text>
            <Text style={styles.chatHeaderSub}>{contatoAtual?.perfil === 'ADMIN' ? 'Professor' : 'Aluno'}</Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={mensagens}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.remetenteId === user?.id;
            return (
              <View style={[styles.msgWrapper, isMe ? styles.msgWrapperRight : styles.msgWrapperLeft]}>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  <Text style={[styles.msgText, item.apagadaPorAdmin && { fontStyle: 'italic', color: '#FF4444' }]}>
                    {item.texto}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma mensagem. Diga olá!</Text>}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#888"
            value={texto}
            onChangeText={setTexto}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={enviarMensagem}>
            <Ionicons name="send" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginLeft: 10 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00FFFF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#000', fontWeight: '900', fontSize: 18 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  userStatus: { color: '#888', fontSize: 13, marginTop: 2 },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 30, fontStyle: 'italic' },
  
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  chatHeaderName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  chatHeaderSub: { color: '#00FFFF', fontSize: 12 },
  
  msgWrapper: { width: '100%', marginBottom: 10, flexDirection: 'row' },
  msgWrapperRight: { justifyContent: 'flex-end' },
  msgWrapperLeft: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  msgBubbleMe: { backgroundColor: '#4169E1', borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#333', borderBottomLeftRadius: 4 },
  msgText: { color: '#FFF', fontSize: 15 },
  
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#1a1a2e', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#0c0c0c', color: '#FFF', borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00FFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 }
});
