import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { socket, getActiveMatchData } from '../src/services/socket'; // Ajuste o caminho se necessário
import { useAuth } from '../src/context/AuthContext';

const { width } = Dimensions.get('window');

export default function CaboDeGuerra() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Estados do Jogo
  const [matchData, setMatchData] = useState<any>(null);
  const [ropePosition, setRopePosition] = useState(0); // 0 é o centro
  const [currentOp, setCurrentOp] = useState<any>(null);
  const [answerPrompt, setAnswerPrompt] = useState('');
  const [gameOver, setGameOver] = useState(false);
  
  // Cores dinâmicas
  const isP1 = matchData?.is_p1;
  const myColor = isP1 ? '#3B82F6' : '#EF4444'; // Azul para P1, Vermelho para P2 (pode adaptar para a cor da equipe)
  const opponentColor = isP1 ? '#EF4444' : '#3B82F6';

  useEffect(() => {
    // Pega os dados da partida que foram salvos quando o convite foi aceito
    const data = getActiveMatchData();
    if (data) {
      setMatchData(data);
      if (data.initial_op) setCurrentOp(data.initial_op);
      if (data.rope_position !== undefined) setRopePosition(data.rope_position);
    }

    // --- LISTENERS DO SOCKET ---
    socket.on('tugofwar_state_update', (data) => {
      setRopePosition(data.rope_position);
    });

    socket.on('tugofwar_new_op', (data) => {
      setCurrentOp(data.new_op);
      setAnswerPrompt(''); // Limpa o teclado para a nova conta
    });

    socket.on('game_over', (data) => {
      setGameOver(true);
      const amIWinner = data.ganhador === socket.id;
      
      Alert.alert(
        amIWinner ? '🏆 VOCÊ VENCEU!' : '💀 VOCÊ PERDEU!',
        amIWinner ? 'Você puxou a corda com força total!' : 'Seu oponente foi mais rápido na matemática.',
        [{ text: 'Sair', onPress: () => router.replace('/salas') }]
      );
    });

    socket.on('opponent_disconnected', () => {
      if (!gameOver) {
        Alert.alert('Vitória!', 'Seu oponente fugiu da partida.', [
          { text: 'Voltar', onPress: () => router.replace('/salas') }
        ]);
      }
    });

    return () => {
      socket.off('tugofwar_state_update');
      socket.off('tugofwar_new_op');
      socket.off('game_over');
      socket.off('opponent_disconnected');
    };
  }, []);

  const handleLeaveMatch = () => {
    Alert.alert('Abandonar Batalha?', 'Se você sair agora, perderá a partida.', [
      { text: 'Cancelar', style: 'cancel' },
      { 
        text: 'Sair', 
        style: 'destructive', 
        onPress: () => {
          socket.emit('leave_match', { room_id: matchData?.room_id });
          router.replace('/salas');
        } 
      }
    ]);
  };

  const handleKeyPress = (value: string) => {
    if (gameOver) return;

    if (value === 'C') {
      setAnswerPrompt('');
      return;
    }

    if (value === 'OK') {
      if (answerPrompt !== '' && currentOp) {
        // Envia a resposta para o servidor validar
        socket.emit('tugofwar_answer', {
          room_id: matchData.room_id,
          resposta: answerPrompt
        });
        // Não limpamos o prompt aqui. Ele será limpo pelo evento 'tugofwar_new_op' se acertar,
        // ou você pode adicionar uma lógica para limpar se errar depois.
        setAnswerPrompt(''); 
      }
      return;
    }

    if (answerPrompt.length < 4) {
      setAnswerPrompt((prev) => prev + value);
    }
  };

  const renderButton = (value: string) => (
    <TouchableOpacity
      key={value}
      style={[
        styles.calcButton, 
        { backgroundColor: value === 'OK' ? '#32CD32' : value === 'C' ? '#EF4444' : '#2a2a3e' }
      ]}
      activeOpacity={0.7}
      onPress={() => handleKeyPress(value)}
    >
      <Text style={styles.calcButtonText}>{value}</Text>
    </TouchableOpacity>
  );

  const keypad = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', 'OK']
  ];

  if (!matchData || !currentOp) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00BFFF" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Preparando a Arena...</Text>
      </SafeAreaView>
    );
  }

  // Lógica para mover a corda visualmente. 
  // Multiplicamos a posição por um fator (ex: 15 pixels) para ficar visível.
  // Se eu sou o P1, posição positiva move pra minha direita (ou esquerda, dependendo do seu design).
  // Vamos assumir que P1 fica na esquerda (negativo) e P2 na direita (positivo) na tela.
  const visualRopeOffset = isP1 ? -(ropePosition * 12) : (ropePosition * 12);

  return (
    <SafeAreaView style={styles.container}>
      {/* CABEÇALHO */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeaveMatch} style={styles.leaveButton}>
          <Ionicons name="flag" size={24} color="#EF4444" />
        </TouchableOpacity>
        <Text style={styles.title}>Cabo de Guerra</Text>
        <View style={{ width: 24 }} /> {/* Espaçador */}
      </View>

      {/* PLACAR E OPONENTE */}
      <View style={styles.scoreBoard}>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, { color: myColor }]}>Você</Text>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerName, { color: opponentColor }]}>{matchData.opponentName}</Text>
        </View>
      </View>

      {/* ARENA DO CABO DE GUERRA */}
      <View style={styles.arenaContainer}>
        {/* Linha central imaginária */}
        <View style={styles.centerLine} />
        
        {/* A Corda e os personagens (simulados por ícones/blocos por enquanto) */}
        <View style={[styles.ropeSystem, { transform: [{ translateX: visualRopeOffset }] }]}>
          <Ionicons name="person" size={40} color={myColor} style={{ marginRight: -10 }} />
          <View style={styles.rope} />
          {/* O marcador central da corda */}
          <View style={styles.ropeMarker} />
          <View style={styles.rope} />
          <Ionicons name="person" size={40} color={opponentColor} style={{ marginLeft: -10 }} />
        </View>
      </View>

      {/* CALCULADORA DINÂMICA */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.calculatorSection}>
        
        {/* Display da Conta */}
        <View style={[styles.displayContainer, { borderColor: myColor }]}>
          <Text style={styles.questionText}>
            {currentOp.texto} = <Text style={{ color: myColor }}>{answerPrompt || '?'}</Text>
          </Text>
        </View>

        {/* Teclado */}
        <View style={styles.keypadContainer}>
          {keypad.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((btnValue) => renderButton(btnValue))}
            </View>
          ))}
        </View>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#0c0c0c', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  leaveButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  
  scoreBoard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#151520' },
  playerInfo: { flex: 1, alignItems: 'center' },
  playerName: { fontSize: 18, fontWeight: 'bold' },
  vsText: { color: '#888', fontSize: 16, fontWeight: 'bold', marginHorizontal: 15 },

  arenaContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e', overflow: 'hidden' },
  centerLine: { position: 'absolute', width: 2, height: '100%', backgroundColor: '#333', borderStyle: 'dashed' },
  ropeSystem: { flexDirection: 'row', alignItems: 'center' },
  rope: { width: width * 0.35, height: 6, backgroundColor: '#D2B48C', zIndex: -1 }, // Cor de corda
  ropeMarker: { width: 12, height: 20, backgroundColor: '#EF4444', borderRadius: 4 },

  calculatorSection: { padding: 20, backgroundColor: '#0c0c0c', borderTopWidth: 1, borderTopColor: '#222' },
  displayContainer: { backgroundColor: '#1a1a2e', padding: 20, borderRadius: 12, borderWidth: 2, alignItems: 'center', marginBottom: 20 },
  questionText: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  
  keypadContainer: { alignItems: 'center', gap: 10 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  calcButton: { flex: 1, aspectRatio: 1.2, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  calcButtonText: { color: '#FFFFFF', fontSize: 28, fontWeight: 'bold' },
});
