import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { socket } from '../../src/services/socket'; // O seu arquivo perfeito!

export default function Salas() {
  const { user } = useAuth();
  
  // Estados da Lista de Salas
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de Dentro da Sala
  const [currentLobby, setCurrentLobby] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  // Configuração Inicial e Comunicação com o Servidor (Render)
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    if (user) {
      socket.emit('register_player', { name: user.nome, user_id: user.id });
      socket.emit('get_lobbies', {});
    }

    // Ouvintes do Servidor
    socket.on('lobbies_list', (data) => {
      setLobbies(data);
      setLoading(false);
    });

    socket.on('lobby_joined', (data) => {
      setCurrentLobby(data);
      setMessages([]); 
    });

    socket.on('lobby_update', (data) => {
      setCurrentLobby(data);
    });

    socket.on('lobby_left', () => {
      setCurrentLobby(null);
      setMessages([]);
      socket.emit('get_lobbies', {}); 
    });

    socket.on('lobby_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on('lobby_error', (err) => {
      Alert.alert('Aviso', err.msg);
    });

    return () => {
      socket.off('lobbies_list');
      socket.off('lobby_joined');
      socket.off('lobby_update');
      socket.off('lobby_left');
      socket.off('lobby_message');
      socket.off('lobby_error');
    };
  }, [user]);

  // Ações do Usuário
  const handleCreateLobby = () => {
    socket.emit('create_lobby', {
      nome: `Sala de ${user?.nome?.split(' ')[0]}`,
      tipo: 'Bate-papo',
      max_jogadores: 10
    });
  };

  const handleJoinLobby = (lobbyId: string) => {
    socket.emit('join_lobby', { lobby_id: lobbyId });
  };

  const handleLeaveLobby = () => {
    if (currentLobby) {
      socket.emit('leave_lobby', { lobby_id: currentLobby.id });
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim() === '' || !currentLobby) return;
    
    socket.emit('send_lobby_message', {
      lobby_id: currentLobby.id,
      text: messageText.trim()
    });
    setMessageText('');
  };

  // ==========================================
  // TELA 1: LISTA DE SALAS (VISÃO DE FORA)
  // ==========================================
  if (!currentLobby) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="chatbubbles" size={28} color="#00BFFF" />
          <Text style={styles.title}>Salas</Text>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={handleCreateLobby}>
          <Ionicons name="add-circle" size={24} color="#0c0c0c" />
          <Text style={styles.createButtonText}>Criar Nova Sala</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator size="large" color="#00BFFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={lobbies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cafe-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>Nenhuma sala aberta.</Text>
                <Text style={styles.emptySubText}>Seja o primeiro a criar uma!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.lobbyCard}>
                <View style={styles.lobbyInfo}>
                  <Text style={styles.lobbyName}>{item.nome}</Text>
                  <Text style={styles.lobbyHost}>Líder: {item.host_name}</Text>
                  <View style={styles.lobbyTags}>
                    <View style={styles.tag}><Text style={styles.tagText}>{item.tipo}</Text></View>
                    <View style={[styles.tag, { backgroundColor: '#333' }]}>
                      <Ionicons name="people" size={12} color="#aaa" />
                      <Text style={styles.tagText}>{item.jogadores_count}/{item.max_jogadores}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[styles.joinButton, item.jogadores_count >= item.max_jogadores && { backgroundColor: '#555' }]} 
                  disabled={item.jogadores_count >= item.max_jogadores}
                  onPress={() => handleJoinLobby(item.id)}
                >
                  <Text style={styles.joinButtonText}>
                    {item.jogadores_count >= item.max_jogadores ? 'Cheia' : 'Entrar'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ==========================================
  // TELA 2: DENTRO DA SALA (CHAT DE TEXTO)
  // ==========================================
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        {/* Cabeçalho de Dentro da Sala */}
        <View style={styles.roomHeader}>
          <TouchableOpacity onPress={handleLeaveLobby} style={styles.leaveButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.roomHeaderInfo}>
            <Text style={styles.roomTitle}>{currentLobby.nome}</Text>
            <Text style={styles.roomSubtitle}>{currentLobby.players_names?.length || 1} participante(s)</Text>
          </View>
          {/* Botão de Voz preparado para a Fase 2 */}
          <TouchableOpacity style={styles.voiceButton}>
             <Ionicons name="mic-off" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Participantes na Sala */}
        <View style={styles.participantsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {currentLobby.players_names?.map((pName: string, index: number) => (
              <View key={index} style={styles.participantChip}>
                <Ionicons name="person-circle" size={16} color="#00BFFF" />
                <Text style={styles.participantName}>{pName}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Mensagens do Chat */}
        <FlatList
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.chatContent}
          renderItem={({ item }) => {
            const isSystem = item.sender === 'SISTEMA';
            const isMe = item.sender_id === user?.id && !isSystem;

            if (isSystem) {
              return (
                <View style={styles.systemMessage}>
                  <Text style={styles.systemMessageText}>{item.text}</Text>
                </View>
              );
            }

            return (
              <View style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageOther]}>
                {!isMe && <Text style={styles.messageSender}>{item.sender}</Text>}
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.messageTime}>{item.time}</Text>
              </View>
            );
          }}
        />

        {/* Digitar Mensagem */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Digite uma mensagem..."
            placeholderTextColor="#666"
            value={messageText}
            onChangeText={setMessageText}
            onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity 
            style={[styles.sendButton, messageText.trim() === '' && { opacity: 0.5 }]} 
            onPress={handleSendMessage}
            disabled={messageText.trim() === ''}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  
  createButton: { backgroundColor: '#00BFFF', marginHorizontal: 16, marginBottom: 16, padding: 14, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  createButtonText: { color: '#0c0c0c', fontSize: 16, fontWeight: 'bold' },
  
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  lobbyCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  lobbyInfo: { flex: 1 },
  lobbyName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  lobbyHost: { color: '#888', fontSize: 13, marginTop: 4 },
  lobbyTags: { flexDirection: 'row', marginTop: 8, gap: 8 },
  tag: { backgroundColor: '#00BFFF20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { color: '#bbb', fontSize: 11, fontWeight: '600' },
  
  joinButton: { backgroundColor: '#32CD32', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  joinButtonText: { color: '#000', fontWeight: 'bold' },
  
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySubText: { color: '#888', fontSize: 14, marginTop: 8 },

  roomHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  leaveButton: { padding: 8, marginRight: 8 },
  roomHeaderInfo: { flex: 1 },
  roomTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  roomSubtitle: { color: '#00BFFF', fontSize: 12 },
  voiceButton: { backgroundColor: '#333', padding: 10, borderRadius: 20 },

  participantsBar: { backgroundColor: '#151520', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  participantChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, gap: 6 },
  participantName: { color: '#ccc', fontSize: 12 },

  chatContent: { padding: 16, gap: 12 },
  systemMessage: { alignSelf: 'center', backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginVertical: 4 },
  systemMessageText: { color: '#aaa', fontSize: 11, fontStyle: 'italic' },
  
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  messageMe: { alignSelf: 'flex-end', backgroundColor: '#00BFFF', borderBottomRightRadius: 4 },
  messageOther: { alignSelf: 'flex-start', backgroundColor: '#2a2a3e', borderBottomLeftRadius: 4 },
  messageSender: { color: '#00BFFF', fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  messageText: { color: '#fff', fontSize: 15 },
  messageTime: { color: '#rgba(255,255,255,0.5)', fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },

  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#1a1a2e', alignItems: 'center', gap: 12 },
  textInput: { flex: 1, backgroundColor: '#2a2a3e', color: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  sendButton: { backgroundColor: '#00BFFF', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
