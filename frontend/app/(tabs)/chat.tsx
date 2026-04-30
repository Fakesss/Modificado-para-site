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
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Opções de ordenação: 'padrao' (Recentes), 'equipe', 'serie'
  const [sortMode, setSortMode] = useState<'padrao' | 'equipe' | 'serie'>('padrao');

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      if (view === 'lista') {
        try {
          const [users, turmas, equipes, summary] = await Promise.all([
            api.getUsuarios(), api.getTurmas(), api.getEquipes(), api.getInboxSummary()
          ]);
          if (!isMounted) return;

          // Filtra apenas os dados necessários para a UI, ignorando dados invisíveis que mudam o tempo todo (como o "último acesso")
          const mapped = users.filter((u:any) => u.id !== user?.id).map((u:any) => {
            const turma = turmas.find((t:any) => t.id === u.turmaId);
            const equipe = equipes.find((e:any) => e.id === u.equipeId);
            const inb = summary[u.id] || { unreadCount: 0, lastMessageTime: null };
            
            return {
              id: u.id,
              nome: u.nome,
              perfil: u.perfil,
              turmaNome: turma ? turma.nome : '',
              equipeNome: equipe ? equipe.nome : '',
              equipeCor: equipe ? equipe.cor : '#555',
              unreadCount: inb.unreadCount,
              lastMessageTime: inb.lastMessageTime
            };
          });

          // MÁGICA ANTITRAVAMENTO: Só atualiza a tela se um dado REAL mudar, evitando que o scroll pule
          setUsuarios(prev => JSON.stringify(prev) !== JSON.stringify(mapped) ? mapped : prev);
        } catch(e) {}
        
        if (isMounted) setLoading(false);

      } else if (view === 'conversa' && contatoAtual) {
        try {
          const msgs = await api.getConversaPrivada(contatoAtual.id);
          
          // MÁGICA ANTITRAVAMENTO: Só atualiza a tela se uma mensagem nova chegar
          if (isMounted) {
              setMensagens(prev => JSON.stringify(prev) !== JSON.stringify(msgs) ? msgs : prev);
          }
        } catch(e) {}
      }
    };

    fetchData();
    // Robô atualiza em segundo plano a cada 3 segundos suavemente
    const interval = setInterval(fetchData, 3000); 
    
    return () => { 
        isMounted = false; 
        clearInterval(interval); 
    };
  }, [view, contatoAtual, user?.id]);

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
      const msgs = await api.getConversaPrivada(contatoAtual.id);
      setMensagens(msgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (error: any) {
      Alert.alert("Erro", error.response?.data?.detail || "Não foi possível enviar a mensagem.");
    }
  };

  // ==========================================
  // MOTOR DE ORDENAÇÃO E FILTROS DA LISTA
  // ==========================================
  const renderSortedUsuarios = () => {
    let sorted = [...usuarios];

    // 1. Base Alfabética
    sorted.sort((a, b) => a.nome.localeCompare(b.nome));

    // 2. Aplica modo escolhido pelo usuário
    if (sortMode === 'equipe') {
        sorted.sort((a, b) => a.equipeNome.localeCompare(b.equipeNome));
    } else if (sortMode === 'serie') {
        sorted.sort((a, b) => a.turmaNome.localeCompare(b.turmaNome));
    } else {
        // Padrão: Mais recentes primeiro
        sorted.sort((a, b) => {
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            return timeB - timeA;
        });
    }

    // 3. REGRA MESTRA: Mensagens Não lidas cravadas no topo sempre!
    sorted.sort((a, b) => {
        const aUnread = a.unreadCount > 0 ? 1 : 0;
        const bUnread = b.unreadCount > 0 ? 1 : 0;
        return bUnread - aUnread; 
    });

    return sorted;
  };

  if (view === 'lista') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Ionicons name="chatbubbles" size={32} color="#00FFFF" />
          <Text style={styles.headerTitle}>Mensagens</Text>
        </View>

        {/* BARRA DE FILTROS DE ORGANIZAÇÃO */}
        <View style={styles.filterRow}>
            <Text style={{color: '#888', marginRight: 10, fontSize: 12, fontWeight: 'bold'}}>ORDENAR:</Text>
            <TouchableOpacity onPress={()=>setSortMode('padrao')} style={[styles.filterBtn, sortMode==='padrao' && styles.filterBtnActive]}>
                <Text style={[styles.filterText, sortMode==='padrao' && styles.filterTextActive]}>Conversas</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setSortMode('equipe')} style={[styles.filterBtn, sortMode==='equipe' && styles.filterBtnActive]}>
                <Text style={[styles.filterText, sortMode==='equipe' && styles.filterTextActive]}>Equipe</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>setSortMode('serie')} style={[styles.filterBtn, sortMode==='serie' && styles.filterBtnActive]}>
                <Text style={[styles.filterText, sortMode==='serie' && styles.filterTextActive]}>Série</Text>
            </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#00FFFF" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={renderSortedUsuarios()}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.userCard} onPress={() => abrirConversa(item)}>
                
                {/* AVATAR COM ESCUDO E COR DA EQUIPE */}
                <View style={[styles.avatar, { backgroundColor: item.equipeCor + '20', borderColor: item.equipeCor }]}>
                  <Ionicons name="shield" size={20} color={item.equipeCor} />
                </View>

                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.userName} numberOfLines={1}>
                      {item.nome} {item.perfil === 'ADMIN' && '👑'}
                      {item.turmaNome ? <Text style={styles.userGrade}> • {item.turmaNome}</Text> : null}
                  </Text>
                  
                  {item.equipeNome ? (
                     <Text style={[styles.userStatus, { color: item.equipeCor }]}>{item.equipeNome}</Text>
                  ) : (
                     <Text style={styles.userStatus}>{item.perfil === 'ADMIN' ? 'Professor' : 'Sem Equipe'}</Text>
                  )}
                </View>

                {/* PONTINHO VERMELHO INDIVIDUAL */}
                {item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={24} color="#555" />
                )}
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
          <View style={[styles.avatarSmall, { backgroundColor: contatoAtual?.equipeCor + '20', borderColor: contatoAtual?.equipeCor, marginLeft: 5, marginRight: 12 }]}>
              <Ionicons name="shield" size={16} color={contatoAtual?.equipeCor || '#fff'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.chatHeaderName}>{contatoAtual?.nome}</Text>
            <Text style={styles.chatHeaderSub}>{contatoAtual?.equipeNome || (contatoAtual?.perfil === 'ADMIN' ? 'Professor' : 'Aluno')}</Text>
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
                  <Text style={styles.msgTime}>{new Date(item.criadoEm).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
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
  
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#111' },
  filterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#222', marginRight: 8, borderWidth: 1, borderColor: '#333' },
  filterBtnActive: { backgroundColor: 'rgba(0, 255, 255, 0.1)', borderColor: '#00FFFF' },
  filterText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  filterTextActive: { color: '#00FFFF' },

  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1 },
  avatarSmall: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  userGrade: { color: '#AAA', fontSize: 13, fontWeight: 'normal' },
  userStatus: { color: '#888', fontSize: 12, marginTop: 3, fontWeight: 'bold' },
  
  unreadBadge: { backgroundColor: '#FF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, minWidth: 24, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  emptyText: { color: '#666', textAlign: 'center', marginTop: 30, fontStyle: 'italic' },
  
  chatHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  chatHeaderName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  chatHeaderSub: { color: '#00FFFF', fontSize: 12 },
  
  msgWrapper: { width: '100%', marginBottom: 10, flexDirection: 'row' },
  msgWrapperRight: { justifyContent: 'flex-end' },
  msgWrapperLeft: { justifyContent: 'flex-start' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, position: 'relative' },
  msgBubbleMe: { backgroundColor: '#4169E1', borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: '#222', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#333' },
  msgText: { color: '#FFF', fontSize: 15, marginBottom: 12 },
  msgTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, position: 'absolute', bottom: 5, right: 10 },
  
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#1a1a2e', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#0c0c0c', color: '#FFF', borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12, maxHeight: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00FFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2 }
});
