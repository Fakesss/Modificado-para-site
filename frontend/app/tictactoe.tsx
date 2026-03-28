import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Alert, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

// IMPORTA A CONEXÃO E A MEMÓRIA GLOBAL DO JOGO
import { socket, activeMatchData, setActiveMatchData } from '../src/services/socket';

const { width } = Dimensions.get('window');
const BOARD_SIZE = width * 0.9;
const CELL_SIZE = BOARD_SIZE / 3.2;

const REGRAS_BOT = { vidasIniciais: 3, passarVezAoErrar: true };

const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => {
  const lastPress = useRef(0);
  return (
    <Pressable 
      style={({ pressed }) => [styles.tecla, styleExtra, pressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]}
      onPressIn={() => {
        const now = Date.now();
        if (now - lastPress.current > 150) { lastPress.current = now; onPress(valor); }
      }}
    >
      {children}
    </Pressable>
  );
};

export default function TicTacToe() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const { user } = useAuth();
  
  const [tela, setTela] = useState<'menu' | 'procurando' | 'jogando' | 'resultado'>('menu');
  const [modo, setModo] = useState<'bot' | 'multi' | 'espectador'>('bot');
  
  const [board, setBoard] = useState<any[]>([]);
  const [vez, setVez] = useState<'X' | 'O'>('X');
  const [minhaPeca, setMinhaPeca] = useState<'X' | 'O' | null>('X');
  const [vidas, setVidas] = useState(3);
  const [vidasOponente, setVidasOponente] = useState(3);
  const [oponenteNome, setOponenteNome] = useState('Oponente');
  const [player1Name, setPlayer1Name] = useState(''); // Usado no modo espectador
  const [celulaSelecionada, setCelulaSelecionada] = useState<number | null>(null);
  const [respostaInput, setRespostaInput] = useState('');
  const [ganhador, setGanhador] = useState<'X' | 'O' | 'Empate' | null>(null);

  const roomIdRef = useRef<string>('');

  // ==========================================
  // O CÉREBRO DO JOGO ONLINE & ESPECTADOR
  // ==========================================
  useEffect(() => {
    socket.emit('update_status', { status: 'JOGANDO_ONLINE' });

    // Se o usuário entrou aqui porque clicou em "Assistir" na aba Online
    if (params.spectate) {
        setModo('espectador');
        setTela('jogando');
        socket.emit('spectate_match', { room_id: params.spectate });
    } 
    // Se o usuário entrou aqui porque ACEITOU ou foi PAREADO no menu global
    else if (activeMatchData) {
        setupMultiplayerMatch(activeMatchData);
    }

    // OUVINTES DO JOGO
    const onBoardUpdate = (data: any) => {
        setBoard(data.board);
        setVez(data.turn);
        
        // Se eu for espectador, as vidas são fixas nos IDs
        if (modo === 'espectador') {
            const sids = Object.keys(data.vidas);
            setVidas(data.vidas[sids[0]]);
            setVidasOponente(data.vidas[sids[1]]);
        } else {
            const mySid = socket.id;
            setVidas(data.vidas[mySid]);
            const oppSid = Object.keys(data.vidas).find(sid => sid !== mySid);
            if(oppSid) setVidasOponente(data.vidas[oppSid]);
        }
    };

    const onGameOver = (data: any) => {
        setBoard(data.board);
        setGanhador(data.ganhador);
        setTimeout(() => setTela('resultado'), 1000);
    };

    const onOpponentDisconnected = () => {
        Alert.alert("Fim de Jogo", "Um dos jogadores abandonou a partida.");
        setGanhador(modo === 'espectador' ? 'Empate' : minhaPeca);
        setTimeout(() => setTela('resultado'), 1000);
    };

    const onMatchFound = (data: any) => setupMultiplayerMatch(data);

    const onSpectatorJoined = (data: any) => {
        setBoard(data.board);
        setVez(data.turn);
        const sids = Object.keys(data.names);
        setPlayer1Name(data.names[sids[0]]);
        setOponenteNome(data.names[sids[1]]);
        setVidas(data.vidas[sids[0]]);
        setVidasOponente(data.vidas[sids[1]]);
    };

    socket.on('match_found', onMatchFound);
    socket.on('board_update', onBoardUpdate);
    socket.on('game_over', onGameOver);
    socket.on('opponent_disconnected', onOpponentDisconnected);
    socket.on('match_ended', onOpponentDisconnected); // Para o espectador
    socket.on('spectator_joined', onSpectatorJoined);

    return () => {
        socket.off('match_found', onMatchFound);
        socket.off('board_update', onBoardUpdate);
        socket.off('game_over', onGameOver);
        socket.off('opponent_disconnected', onOpponentDisconnected);
        socket.off('match_ended', onOpponentDisconnected);
        socket.off('spectator_joined', onSpectatorJoined);
        socket.emit('update_status', { status: 'MENU' });
    };
  }, [params.spectate]);

  const setupMultiplayerMatch = (data: any) => {
      setModo('multi');
      roomIdRef.current = data.room_id;
      setOponenteNome(data.opponentName);
      setMinhaPeca(data.mySymbol);
      setBoard(data.board);
      setVez(data.turn);
      setVidas(3);
      setVidasOponente(3);
      setTela('jogando');
  };

  const iniciarMultiplayerRandom = () => {
      setModo('multi');
      setTela('procurando');
      socket.emit('find_match', { name: user?.nome || 'Jogador', user_id: user?.id });
  };

  const abandonarPartida = () => {
      Alert.alert("Sair", modo === 'espectador' ? "Deseja parar de assistir?" : "Deseja abandonar a partida? Você perderá o jogo.", [
          { text: "Não", style: "cancel" },
          { text: "Sim", style: "destructive", onPress: () => {
              if (modo === 'espectador') socket.emit('leave_spectator', { room_id: params.spectate });
              else socket.emit('leave_match', { room_id: roomIdRef.current });
              
              setActiveMatchData(null);
              router.back();
          }}
      ]);
  };

  // ==========================================
  // OFFLINE BOT LÓGICA MANTIDA INTACTA
  // ==========================================
  const gerarOperacaoBot = () => {
    const ops = ['+', '-', 'x'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let n1=0, n2=0, res=0;
    if (op === '+') { n1 = Math.floor(Math.random() * 20) + 1; n2 = Math.floor(Math.random() * 20) + 1; res = n1 + n2; }
    if (op === '-') { n1 = Math.floor(Math.random() * 30) + 10; n2 = Math.floor(Math.random() * n1); res = n1 - n2; }
    if (op === 'x') { n1 = Math.floor(Math.random() * 10) + 1; n2 = Math.floor(Math.random() * 10) + 1; res = n1 * n2; }
    return { texto: `${n1} ${op} ${n2}`, resposta: res, marcadoPor: null };
  };

  const checkWinBot = (tabuleiroAtual: any[]) => {
    const lines = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
    for (let line of lines) {
      const [a,b,c] = line;
      if (tabuleiroAtual[a].marcadoPor && tabuleiroAtual[a].marcadoPor === tabuleiroAtual[b].marcadoPor && tabuleiroAtual[a].marcadoPor === tabuleiroAtual[c].marcadoPor) {
        setGanhador(tabuleiroAtual[a].marcadoPor); setTimeout(() => setTela('resultado'), 1000); return true;
      }
    }
    if (tabuleiroAtual.every(c => c.marcadoPor !== null)) {
       setGanhador('Empate'); setTimeout(() => setTela('resultado'), 1000); return true;
    }
    return false;
  };

  const iniciarBot = () => {
    socket.emit('update_status', { status: 'JOGANDO_OFFLINE' });
    setModo('bot'); setOponenteNome('Robô'); setVidas(REGRAS_BOT.vidasIniciais); setVidasOponente(REGRAS_BOT.vidasIniciais);
    const pecas = ['X', 'O'];
    const sorteada = pecas[Math.floor(Math.random() * 2)];
    setMinhaPeca(sorteada as 'X' | 'O'); setVez('X'); setGanhador(null);
    const novoBoard = []; for(let i=0; i<9; i++) { novoBoard.push({ id: i, ...gerarOperacaoBot() }); }
    setBoard(novoBoard); setTela('jogando');
  };

  useEffect(() => {
    if (tela === 'jogando' && modo === 'bot' && vez !== minhaPeca && !ganhador) {
        const timerId = setTimeout(() => {
            const vazias = board.filter((c:any) => !c.marcadoPor);
            if(vazias.length > 0) {
                const escolha = vazias[Math.floor(Math.random() * vazias.length)];
                const novoBoard = [...board]; novoBoard[escolha.id].marcadoPor = vez;
                setBoard(novoBoard);
                if(!checkWinBot(novoBoard)) setVez(minhaPeca as 'X' | 'O');
            }
        }, 1500);
        return () => clearTimeout(timerId);
    }
  }, [vez, tela, ganhador, modo]);

  // ==========================================
  // ENVIAR RESPOSTA PARA O JUIZ
  // ==========================================
  const verificarResposta = () => {
    if (celulaSelecionada === null || !respostaInput) return;
    
    if (modo === 'multi') {
        socket.emit('make_move', { room_id: roomIdRef.current, cellIndex: celulaSelecionada, resposta: respostaInput });
        setCelulaSelecionada(null); setRespostaInput('');
        return;
    }

    const celula = board[celulaSelecionada];
    const novoBoard = [...board];

    if (parseInt(respostaInput) === celula.resposta) {
        novoBoard[celulaSelecionada].marcadoPor = minhaPeca;
        setBoard(novoBoard);
        if(!checkWinBot(novoBoard)) setVez(vez === 'X' ? 'O' : 'X');
    } else {
        const novasVidas = vidas - 1;
        setVidas(novasVidas);
        if (novasVidas <= 0) {
            setGanhador(minhaPeca === 'X' ? 'O' : 'X'); setTimeout(() => setTela('resultado'), 1000);
        } else {
            if (REGRAS_BOT.passarVezAoErrar) setVez(vez === 'X' ? 'O' : 'X');
            else Alert.alert("Errou!", "Tente novamente!");
        }
    }
    setCelulaSelecionada(null); setRespostaInput('');
  };

  if (tela === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>
          <Ionicons name="grid" size={64} color="#32CD32" style={{ marginTop: 20 }} />
          <Text style={styles.title}>Jogo da Velha</Text>
          <Text style={styles.subtitle}>Matemática Tática</Text>
        </View>
        <View style={styles.menuButtons}>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#32CD32' }]} onPress={iniciarBot}>
            <Ionicons name="hardware-chip" size={24} color="#000" />
            <Text style={styles.btnText}>TREINAR VS ROBÔ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#4169E1' }]} onPress={iniciarMultiplayerRandom}>
            <Ionicons name="globe" size={24} color="#FFF" />
            <Text style={[styles.btnText, { color: '#FFF' }]}>ENCONTRAR OPONENTE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (tela === 'procurando') {
      return (
          <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
              <ActivityIndicator size="large" color="#4169E1" style={{ marginBottom: 20, transform: [{scale: 1.5}] }} />
              <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>Procurando adversário...</Text>
              <Text style={{ color: '#888', fontSize: 14, marginTop: 10 }}>Aguardando outro jogador entrar na fila.</Text>
              <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#E74C3C', marginTop: 40, width: '80%' }]} onPress={() => { socket.emit('cancel_matchmaking'); setTela('menu'); }}>
                 <Text style={[styles.btnText, { color: '#FFF' }]}>CANCELAR</Text>
              </TouchableOpacity>
          </SafeAreaView>
      )
  }

  if (tela === 'resultado') {
    const isVitoria = ganhador === minhaPeca;
    const isEmpate = ganhador === 'Empate';
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={{ fontSize: 64 }}>{isEmpate ? '🤝' : (isVitoria ? '🏆' : '💀')}</Text>
          <Text style={styles.resultadoTitle}>{isEmpate ? 'Deu Velha!' : (isVitoria ? 'Você Venceu!' : (modo === 'espectador' ? 'Fim de Jogo' : 'Você Perdeu!'))}</Text>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#FFD700', marginTop: 30 }]} onPress={() => {
              setActiveMatchData(null);
              router.back();
          }}>
            <Text style={styles.btnText}>VOLTAR AO MENU</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* MODO ESPECTADOR BANNER */}
      {modo === 'espectador' && (
         <View style={{backgroundColor: '#E74C3C', padding: 5, alignItems: 'center', borderRadius: 8, marginBottom: 10}}>
             <Text style={{color: '#FFF', fontWeight: 'bold'}}>👁 ASSISTINDO AO VIVO</Text>
         </View>
      )}

      <View style={styles.topInfo}>
        <View>
          <Text style={styles.infoLabel}>{modo === 'espectador' ? player1Name.toUpperCase() : `VOCÊ (${minhaPeca})`}</Text>
          <View style={{ flexDirection: 'row', marginTop: 5 }}>{Array.from({ length: vidas }).map((_, i) => <Ionicons key={`v1_${i}`} name="heart" size={16} color="#FF4444" />)}</View>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.infoLabel}>VEZ ATUAL</Text>
          <Text style={[styles.infoValue, { color: vez === minhaPeca ? '#FFD700' : '#888' }]}>
              {modo === 'espectador' ? `Jogador ${vez}` : (vez === minhaPeca ? 'SUA VEZ' : 'OPONENTE')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.infoLabel}>{oponenteNome.toUpperCase()} {modo !== 'espectador' && `(${minhaPeca === 'X' ? 'O' : 'X'})`}</Text>
          <View style={{ flexDirection: 'row', marginTop: 5 }}>{Array.from({ length: vidasOponente }).map((_, i) => <Ionicons key={`v2_${i}`} name="heart" size={16} color="#4169E1" />)}</View>
        </View>
      </View>

      <TouchableOpacity style={{ alignSelf: 'flex-end', marginBottom: 10, marginRight: 10 }} onPress={abandonarPartida}>
          <Text style={{ color: '#E74C3C', fontWeight: 'bold' }}>{modo === 'espectador' ? 'Parar de Assistir' : 'Desistir da Partida'}</Text>
      </TouchableOpacity>

      {/* GRID */}
      <View style={styles.boardContainer}>
        {board.map((celula, index) => (
          <TouchableOpacity 
            key={index} 
            style={[ styles.cell, celula.marcadoPor && styles.cellMarked, celulaSelecionada === index && { borderColor: '#FFD700', borderWidth: 3 } ]}
            disabled={celula.marcadoPor !== null || vez !== minhaPeca || modo === 'espectador'}
            onPress={() => setCelulaSelecionada(index)}
          >
            {celula.marcadoPor ? (
              <Text style={[styles.cellMarkText, { color: celula.marcadoPor === 'X' ? '#FF4444' : '#32CD32' }]}>{celula.marcadoPor}</Text>
            ) : (
              <Text style={styles.cellOpText}>{celula.texto}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* TECLADO */}
      {celulaSelecionada !== null && modo !== 'espectador' && (
        <View style={styles.bottomPanel}>
          <Text style={{ color: '#FFF', marginBottom: 10, fontSize: 16 }}>Quanto é: <Text style={{fontWeight: 'bold', color: '#FFD700'}}>{board[celulaSelecionada].texto}</Text>?</Text>
          <View style={styles.displayContainer}><Text style={styles.displayText}>{respostaInput || ' '}</Text></View>
          <View style={styles.tecladoContainer}>
            {[['7','8','9'], ['4','5','6'], ['1','2','3']].map((row, i) => (
               <View key={i} style={styles.tecladoRow}>
                 {row.map(num => <BotaoTeclado key={num} valor={num} onPress={(v:string) => setRespostaInput(r => r + v)}><Text style={styles.teclaText}>{num}</Text></BotaoTeclado>)}
               </View>
            ))}
            <View style={styles.tecladoRow}>
              <BotaoTeclado valor="apagar" onPress={() => setRespostaInput(r => r.slice(0, -1))} styleExtra={styles.teclaApagar}><Ionicons name="close" size={24} color="#fff" /></BotaoTeclado>
              <BotaoTeclado valor="0" onPress={(v:string) => setRespostaInput(r => r + v)}><Text style={styles.teclaText}>0</Text></BotaoTeclado>
              <BotaoTeclado valor="enviar" onPress={verificarResposta} styleExtra={styles.teclaEnviar}><Ionicons name="checkmark" size={28} color="#fff" /></BotaoTeclado>
            </View>
          </View>
        </View>
      )}
      
      {celulaSelecionada !== null && (
          <TouchableOpacity style={{position: 'absolute', top: 150, right: 20}} onPress={() => {setCelulaSelecionada(null); setRespostaInput('');}}>
              <Ionicons name="close-circle" size={40} color="#FF4444" />
          </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c', padding: 20 },
  header: { alignItems: 'center', marginTop: 20 },
  title: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 10 },
  subtitle: { fontSize: 16, color: '#888', marginTop: 4 },
  menuButtons: { flex: 1, justifyContent: 'center', gap: 20 },
  btnIniciar: { flexDirection: 'row', padding: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', elevation: 4 },
  btnText: { color: '#000', fontSize: 18, fontWeight: '900' },
  topInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, backgroundColor: '#1a1a2e', padding: 15, borderRadius: 15 },
  infoLabel: { color: '#888', fontSize: 10, fontWeight: 'bold' },
  infoValue: { color: '#FFF', fontSize: 18, fontWeight: '900', marginTop: 2 },
  boardContainer: { width: BOARD_SIZE, height: BOARD_SIZE, flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', gap: 10, justifyContent: 'center' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#1a1a2e', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#333' },
  cellMarked: { backgroundColor: '#0c0c0c' },
  cellOpText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  cellMarkText: { fontSize: 60, fontWeight: '900' },
  bottomPanel: { position: 'absolute', bottom: 0, width: width, backgroundColor: '#1a1a2e', padding: 20, alignItems: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  displayContainer: { backgroundColor: '#0c0c0c', width: '100%', height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  displayText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  tecladoContainer: { width: '100%', gap: 8 },
  tecladoRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  tecla: { backgroundColor: '#333', flex: 1, height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  teclaText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  teclaApagar: { backgroundColor: '#E74C3C' },
  teclaEnviar: { backgroundColor: '#32CD32' },
  resultadoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resultadoTitle: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 20 }
});
