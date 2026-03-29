import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Modal, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { socket } from '../../src/services/socket';
import { useFocusEffect, useRouter } from 'expo-router';
// 🚨 Importação ATUALIZADA para o Expo 54
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function Salas() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'ADMIN' || user?.email === 'danielprofessormatematica@gmail.com';
  
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLimit, setNewRoomLimit] = useState('10');

  const [currentLobby, setCurrentLobby] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');

  // Estados do Modal de Desafio
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  useEffect(() => {
    if (!socket.connected) socket.connect();

    if (user) {
      socket.emit('register_player', { name: user.nome, user_id: user.id });
      socket.emit('get_lobbies', {});
    }

    socket.on('lobbies_list', (data) => { setLobbies(data); setLoading(false); setRefreshing(false); });
    
    // Quando entra na sala, carrega as mensagens e os desafios que já estão rolando
    socket.on('lobby_joined', (data) => { 
      setCurrentLobby(data); 
      setMessages(data.messages || []); 
      setShowCreateModal(false); 
    });
    
    socket.on('lobby_update', (data) => { setCurrentLobby(data); });
    socket.on('lobby_left', () => { setCurrentLobby(null); setMessages([]); socket.emit('get_lobbies', {}); });
    socket.on('lobby_message', (msg) => { setMessages((prev) => [...prev, msg]); });
    socket.on('lobby_message_updated', (updatedMsg) => {
      setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
    });

    socket.on('lobby_error', (err) => { 
      if (Platform.OS === 'web') window.alert(err.msg);
      else Alert.alert('Aviso', err.msg); 
    });

    // ==========================================
    // ⚔️ SISTEMA DE DESAFIOS DA SALA (ARENA)
    // ==========================================
    socket.on('lobby_challenge_created', (desafio) => {
      // Adiciona o desafio no estado da sala atual para renderizar os botões
      setCurrentLobby((prev: any) => {
        if (!prev) return prev;
        return { ...prev, desafios: { ...(prev.desafios || {}), [desafio.id]: desafio } };
      });
    });

    socket.on('lobby_challenge_started', (data) => {
      // Atualiza o status do desafio para 'ACEITO' e salva o room_id da partida
      setCurrentLobby((prev: any) => {
        if (!prev || !prev.desafios || !prev.desafios[data.challenge_id]) return prev;
        const updatedDesafios = { ...prev.desafios };
        updatedDesafios[data.challenge_id] = {
          ...updatedDesafios[data.challenge_id],
          status: 'ACEITO',
          room_id: data.room_id,
          acceptor_name: data.p2_name
        };
        return { ...prev, desafios: updatedDesafios };
      });
    });

    socket.on('lobby_challenge_cancelled', (data) => {
      // Remove o desafio da tela
      setCurrentLobby((prev: any) => {
        if (!prev || !prev.desafios) return prev;
        const updatedDesafios = { ...prev.desafios };
        delete updatedDesafios[data.challenge_id];
        return { ...prev, desafios: updatedDesafios };
      });
    });

    // Se EU for o Desafiante ou o Aceitante, o servidor manda o match_found pra mim
    socket.on('match_found', (data) => {
      if (data.game_type === 'tictactoe') router.push(`/jogos/TicTacToeMultiplayer?roomId=${data.room_id}`);
      else if (data.game_type === 'arcade') router.push(`/jogos/ArcadeMultiplayer?roomId=${data.room_id}`);
    });

    return () => {
      socket.off('lobbies_list'); socket.off('lobby_joined'); socket.off('lobby_update');
      socket.off('lobby_left'); socket.off('lobby_message'); socket.off('lobby_error'); 
      socket.off('lobby_message_updated'); socket.off('lobby_challenge_created');
      socket.off('lobby_challenge_started'); socket.off('lobby_challenge_cancelled');
      socket.off('match_found');
    };
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (socket.connected && !currentLobby) socket.emit('get_lobbies', {});
    }, [currentLobby])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (!socket.connected) socket.connect();
    socket.emit('get_lobbies', {});
    setTimeout(() => setRefreshing(false), 3000); 
  }, []);

  // ==========================================
  // EXPORTAR TXT (Usando a nova API do Expo 54)
  // ==========================================
  const handleExportTXT = async () => {
    if (!currentLobby || messages.length === 0) {
      if (Platform.OS === 'web') return window.alert('O chat está vazio.');
      return Alert.alert('Aviso', 'O chat está vazio.');
    }

    try {
      const chatText = messages.map(m => `[${m.time}] ${m.sender}: ${m.apagada ? '(Mensagem Apagada) ' + m.text : m.text}`).join('\n');
      const fileName = `Chat_${currentLobby.nome.replace(/\s+/g, '_')}.txt`;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([chatText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const meuArquivo = new File(Paths.cache, fileName);
        meuArquivo.write(chatText);
        await Sharing.shareAsync(meuArquivo.uri);
      }
    } catch (error) {
      console.error('Erro ao exportar TXT:', error);
      if (Platform.OS === 'web') window.alert('Erro ao exportar arquivo.');
      else Alert.alert('Erro', 'Não foi possível salvar o arquivo.');
    }
  };

  const handleOpenCreateModal = () => {
    setNewRoomName(`Sala de ${user?.nome?.split(' ')[0]}`);
    setNewRoomLimit('10');
    setShowCreateModal(true);
  };

  const handleConfirmCreateLobby = () => {
    if (newRoomName.trim() === '') {
      if (Platform.OS === 'web') return window.alert('Dê um nome para a sala!');
      return Alert.alert('Erro', 'Dê um nome para a sala!');
    }
    const limit = parseInt(newRoomLimit);
    if (isNaN(limit) || limit < 2 || limit > 50) {
      if (Platform.OS === 'web') return window.alert('O limite deve ser entre 2 e 50 pessoas.');
      return Alert.alert('Erro', 'O limite deve ser entre 2 e 50 pessoas.');
    }
    setLoading(true);
    socket.emit('create_lobby', { nome: newRoomName.trim(), tipo: 'Bate-papo', max_jogadores: limit });
  };

  const handleJoinLobby = (lobbyId: string, isGhost: boolean = false) => {
    socket.emit('join_lobby', { lobby_id: lobbyId, is_ghost: isGhost });
  };

  const handleLeaveLobby = () => {
    if (currentLobby) socket.emit('leave_lobby', { lobby_id: currentLobby.id });
  };

  const handleAdminDeleteLobby = () => {
    const confirmAction = () => socket.emit('admin_delete_lobby', { lobby_id: currentLobby.id });
    if (Platform.OS === 'web') {
      if (window.confirm('Encerrar Sala: Isso irá expulsar todos e salvar o log no banco de dados. Confirmar?')) confirmAction();
    } else {
      Alert.alert('Encerrar Sala', 'Isso irá expulsar todos e salvar o log no banco de dados. Confirmar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: confirmAction }
      ]);
    }
  };

  const handleLongPressMessage = (msg: any) => {
    if (msg.sender === 'SISTEMA' || msg.apagada) return;

    const isMe = msg.sender_id === user?.id;
    if (!isMe && !isAdmin) return;

    const confirmDelete = () => {
      socket.emit('delete_lobby_message', { lobby_id: currentLobby.id, message_id: msg.id, is_admin: isAdmin && !isMe });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Deseja apagar esta mensagem?')) confirmDelete();
    } else {
      Alert.alert('Apagar Mensagem', 'Deseja ocultar esta mensagem do chat?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: confirmDelete }
      ]);
    }
  };

  const handleSendMessage = () => {
    if (messageText.trim() === '' || !currentLobby) return;
    socket.emit('send_lobby_message', { lobby_id: currentLobby.id, text: messageText.trim() });
    setMessageText('');
  };

  // ==========================================
  // AÇÕES DE DESAFIO
  // ==========================================
  const handleLancarDesafio = (gameType: string) => {
    socket.emit('create_lobby_challenge', { 
      lobby_id: currentLobby.id, 
      game_type: gameType, 
      modo_operacao: 'misto' 
    });
    setShowChallengeModal(false);
  };

  const handleAceitarDesafio = (challengeId: string) => {
    socket.emit('accept_lobby_challenge', {
      lobby_id: currentLobby.id,
      challenge_id: challengeId
    });
  };

  const handleAssistirPartida = (roomId: string, gameType: string) => {
    socket.emit('spectate_match', { room_id: roomId });
    if (gameType === 'tictactoe') router.push(`/jogos/TicTacToeMultiplayer?roomId=${roomId}&spectator=true`);
    else if (gameType === 'arcade') router.push(`/jogos/ArcadeMultiplayer?roomId=${roomId}&spectator=true`);
  };

  if (!currentLobby) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="chatbubbles" size={28} color="#00BFFF" />
          <Text style={styles.title}>Salas</Text>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={handleOpenCreateModal}>
          <Ionicons name="add-circle" size={24} color="#0c0c0c" />
          <Text style={styles.createButtonText}>Criar Nova Sala</Text>
        </TouchableOpacity>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#00BFFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={lobbies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFFF" />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cafe-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>Nenhuma sala aberta.</Text>
                <Text style={{color: '#888', marginTop: 8}}>Arraste para baixo para atualizar</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isFull = item.jogadores_count >= item.max_jogadores;
              return (
                <View style={styles.lobbyCard}>
                  <View style={styles.lobbyInfo}>
                    <Text style={styles.lobbyName}>{item.nome}</Text>
                    <Text style={styles.lobbyHost}>Líder: {item.host_name}</Text>
                    <View style={styles.lobbyTags}>
                      <View style={styles.tag}><Text style={styles.tagText}>{item.tipo}</Text></View>
                      <View style={[styles.tag, { backgroundColor: isFull ? '#FF450030' : '#333' }]}>
                        <Ionicons name="people" size={12} color={isFull ? '#FF4500' : '#aaa'} />
                        <Text style={[styles.tagText, isFull && { color: '#FF4500' }]}>{item.jogadores_count}/{item.max_jogadores}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity style={[styles.joinButton, isFull && !isAdmin && { backgroundColor: '#555' }]} disabled={isFull && !isAdmin} onPress={() => handleJoinLobby(item.id, false)}>
                      <Text style={styles.joinButtonText}>{isFull && !isAdmin ? 'Cheia' : 'Entrar'}</Text>
                    </TouchableOpacity>

                    {isAdmin && (
                      <TouchableOpacity style={[styles.joinButton, { backgroundColor: '#8A2BE2' }]} onPress={() => handleJoinLobby(item.id, true)}>
                        <Ionicons name="eye-off" size={14} color="#fff" style={{marginRight: 4}} />
                        <Text style={[styles.joinButtonText, { color: '#fff', fontSize: 11 }]}>Espiar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        <Modal visible={showCreateModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configurar Sala</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}><Ionicons name="close" size={24} color="#888" /></TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Nome da Sala</Text>
              <TextInput style={styles.modalInput} value={newRoomName} onChangeText={setNewRoomName} placeholderTextColor="#666" />
              <Text style={styles.inputLabel}>Máximo de Pessoas</Text>
              <TextInput style={styles.modalInput} value={newRoomLimit} onChangeText={setNewRoomLimit} keyboardType="numeric" maxLength={2} />
              <TouchableOpacity style={styles.confirmCreateButton} onPress={handleConfirmCreateLobby}>
                <Text style={styles.confirmCreateText}>Abrir Sala</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // Pegando a lista de desafios da sala para renderizar no chat
  const desafiosAtivos = Object.values(currentLobby.desafios || {});

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        
        <View style={styles.roomHeader}>
          <TouchableOpacity onPress={handleLeaveLobby} style={styles.leaveButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.roomHeaderInfo}>
            <Text style={styles.roomTitle}>{currentLobby.nome}</Text>
            <Text style={styles.roomSubtitle}>{currentLobby.players_names?.length || 1} participante(s)</Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* BOTÃO DE LANÇAR DESAFIO (Arena) */}
            <TouchableOpacity style={[styles.voiceButton, { backgroundColor: '#FFD70030' }]} onPress={() => setShowChallengeModal(true)}>
               <Ionicons name="flash" size={20} color="#FFD700" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.voiceButton} onPress={handleExportTXT}>
               <Ionicons name="download" size={20} color="#00BFFF" />
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity style={styles.adminDeleteButton} onPress={handleAdminDeleteLobby}>
                <Ionicons name="trash" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

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

        <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
          {/* Renderiza as Mensagens Antigas */}
          {messages.map((item, index) => {
            const isSystem = item.sender === 'SISTEMA';
            const isMe = item.sender_id === user?.id && !isSystem;

            if (isSystem) return <View key={index} style={styles.systemMessage}><Text style={styles.systemMessageText}>{item.text}</Text></View>;

            if (item.apagada) {
              if (isAdmin) {
                return (
                  <View key={index} style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageOther, { opacity: 0.6 }]}>
                    {!isMe && <Text style={styles.messageSender}>{item.sender}</Text>}
                    <Text style={styles.messageText}>{item.text}</Text>
                    <Text style={[styles.messageTime, { color: '#FF4500', fontWeight: 'bold' }]}>Apagada ({item.time})</Text>
                  </View>
                );
              } else {
                return (
                  <View key={index} style={[styles.messageBubble, { alignSelf: isMe ? 'flex-end' : 'flex-start', backgroundColor: '#333' }]}>
                    <Text style={{ color: '#aaa', fontStyle: 'italic', fontSize: 13 }}>🚫 Esta mensagem foi apagada</Text>
                  </View>
                );
              }
            }

            return (
              <TouchableOpacity 
                key={index}
                activeOpacity={0.8}
                onLongPress={() => handleLongPressMessage(item)}
                style={[styles.messageBubble, isMe ? styles.messageMe : styles.messageOther]}
              >
                {!isMe && <Text style={styles.messageSender}>{item.sender}</Text>}
                <Text style={styles.messageText}>{item.text}</Text>
                <Text style={styles.messageTime}>{item.time}</Text>
              </TouchableOpacity>
            );
          })}

          {/* Renderiza os Desafios Ativos no Meio do Chat */}
          {desafiosAtivos.map((desafio: any) => {
            const isMeChallenger = desafio.challenger_sid === socket.id;
            const nomeJogo = desafio.game_type === 'tictactoe' ? 'Jogo da Velha' : 'Arcade Mode';

            if (desafio.status === 'ABERTO') {
              return (
                <View key={desafio.id} style={styles.challengeCard}>
                  <Text style={styles.challengeTitle}>⚔️ Desafio Lançado!</Text>
                  <Text style={styles.challengeText}>
                    <Text style={{fontWeight: 'bold', color: '#00BFFF'}}>{desafio.challenger_name}</Text> quer jogar <Text style={{fontWeight: 'bold', color: '#fff'}}>{nomeJogo}</Text>. Quem aceita?
                  </Text>
                  <TouchableOpacity 
                    style={[styles.challengeButton, isMeChallenger && { backgroundColor: '#555' }]} 
                    disabled={isMeChallenger}
                    onPress={() => handleAceitarDesafio(desafio.id)}
                  >
                    <Text style={styles.challengeButtonText}>{isMeChallenger ? 'Aguardando Oponente...' : 'Aceitar Batalha'}</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            if (desafio.status === 'ACEITO') {
              return (
                <View key={desafio.id} style={[styles.challengeCard, { borderColor: '#32CD32' }]}>
                  <Text style={[styles.challengeTitle, { color: '#32CD32' }]}>🔥 Partida em Andamento!</Text>
                  <Text style={styles.challengeText}>
                    <Text style={{color: '#00BFFF'}}>{desafio.challenger_name}</Text> ⚔️ <Text style={{color: '#FF4500'}}>{desafio.acceptor_name}</Text>
                  </Text>
                  <TouchableOpacity 
                    style={[styles.challengeButton, { backgroundColor: '#8A2BE2' }]} 
                    onPress={() => handleAssistirPartida(desafio.room_id, desafio.game_type)}
                  >
                    <Ionicons name="eye" size={16} color="#fff" style={{marginRight: 6}} />
                    <Text style={styles.challengeButtonText}>Assistir Partida</Text>
                  </TouchableOpacity>
                </View>
              );
            }
            return null;
          })}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput} placeholder="Digite uma mensagem..." placeholderTextColor="#666"
            value={messageText} onChangeText={setMessageText} onSubmitEditing={handleSendMessage}
          />
          <TouchableOpacity style={[styles.sendButton, messageText.trim() === '' && { opacity: 0.5 }]} onPress={handleSendMessage} disabled={messageText.trim() === ''}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Modal de Escolher o Jogo do Desafio */}
        <Modal visible={showChallengeModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lançar Desafio</Text>
                <TouchableOpacity onPress={() => setShowChallengeModal(false)}><Ionicons name="close" size={24} color="#888" /></TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Escolha o modo de jogo para batalhar contra a sala:</Text>
              
              <View style={{ gap: 12, marginTop: 10 }}>
                <TouchableOpacity style={styles.gameOptionButton} onPress={() => handleLancarDesafio('tictactoe')}>
                  <Ionicons name="grid-outline" size={24} color="#00BFFF" />
                  <Text style={styles.gameOptionText}>Jogo da Velha (Matemático)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.gameOptionButton, { borderColor: '#FF4500' }]} onPress={() => handleLancarDesafio('arcade')}>
                  <Ionicons name="rocket-outline" size={24} color="#FF4500" />
                  <Text style={[styles.gameOptionText, { color: '#FF4500' }]}>Arcade Mode</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  joinButton: { backgroundColor: '#32CD32', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  joinButtonText: { color: '#000', fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  inputLabel: { color: '#888', marginBottom: 8, fontSize: 14 },
  modalInput: { backgroundColor: '#0c0c0c', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  confirmCreateButton: { backgroundColor: '#00BFFF', padding: 14, borderRadius: 10, alignItems: 'center' },
  confirmCreateText: { color: '#0c0c0c', fontSize: 16, fontWeight: 'bold' },

  roomHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  leaveButton: { padding: 8, marginRight: 8 },
  roomHeaderInfo: { flex: 1 },
  roomTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  roomSubtitle: { color: '#00BFFF', fontSize: 12 },
  voiceButton: { backgroundColor: '#333', padding: 10, borderRadius: 20 },
  adminDeleteButton: { backgroundColor: '#FF4500', padding: 10, borderRadius: 20 },

  participantsBar: { backgroundColor: '#151520', paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  participantChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, marginRight: 8, gap: 6 },
  participantName: { color: '#ccc', fontSize: 12 },

  chatScroll: { flex: 1 },
  chatContent: { padding: 16, gap: 12, paddingBottom: 20 },
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

  // Estilos da Arena / Desafios
  challengeCard: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#FFD700', borderRadius: 16, padding: 16, marginVertical: 8, alignItems: 'center' },
  challengeTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  challengeText: { color: '#ccc', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  challengeButton: { backgroundColor: '#32CD32', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  challengeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  
  gameOptionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c0c0c', borderWidth: 1, borderColor: '#00BFFF', padding: 16, borderRadius: 12, gap: 12 },
  gameOptionText: { color: '#00BFFF', fontSize: 16, fontWeight: 'bold' }
});
