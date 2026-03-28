import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');
const BOARD_SIZE = width * 0.9;
const CELL_SIZE = BOARD_SIZE / 3.2;

// =========================================================================
// ⚙️ PAINEL DE CONTROLE DE REGRAS E DIFICULDADE (Editável pelo Admin)
// =========================================================================
const REGRAS = {
  vidasIniciais: 3,
  passarVezAoErrar: true, // Se colocar 'false', o jogador erra, perde vida, mas não perde a vez.
  perderMarcacaoAleatoria: false // Deixado preparado para o futuro como você pediu
};

const DIFICULDADE = {
  dinamicaAtivada: false, // Deixe 'false' por enquanto.
  vitoriasParaNivelHard: 10 // Quando ligarmos o backend, jogadores com 10+ vitórias pegarão contas cabulosas.
};
// =========================================================================

const BotaoTeclado = ({ valor, onPress, children, styleExtra }: any) => {
  const lastPress = useRef(0);
  return (
    <Pressable 
      style={({ pressed }) => [styles.tecla, styleExtra, pressed && { opacity: 0.5, transform: [{ scale: 0.92 }] }]}
      onPressIn={() => {
        const now = Date.now();
        if (now - lastPress.current > 150) {
          lastPress.current = now;
          onPress(valor);
        }
      }}
    >
      {children}
    </Pressable>
  );
};

export default function TicTacToe() {
  const router = useRouter();
  
  // Estados do Jogo
  const [tela, setTela] = useState<'menu' | 'jogando' | 'resultado'>('menu');
  const [modo, setModo] = useState<'bot' | 'multi'>('bot');
  
  // Estados da Partida
  const [board, setBoard] = useState<any[]>([]);
  const [vez, setVez] = useState<'X' | 'O'>('X');
  const [minhaPeca, setMinhaPeca] = useState<'X' | 'O'>('X');
  const [vidas, setVidas] = useState(REGRAS.vidasIniciais);
  const [celulaSelecionada, setCelulaSelecionada] = useState<number | null>(null);
  const [respostaInput, setRespostaInput] = useState('');
  
  // Resultados
  const [ganhador, setGanhador] = useState<'X' | 'O' | 'Empate' | null>(null);

  // Gerador de Operações Aleatórias
  const gerarOperacao = () => {
    // Por enquanto, apenas +, -, x (até 10x10)
    const ops = ['+', '-', 'x'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let n1=0, n2=0, res=0;

    // Placeholder da Dificuldade Dinâmica
    const isHard = DIFICULDADE.dinamicaAtivada ? false : false; // Será substituído por check no DB depois
    
    if (op === '+') { 
        n1 = Math.floor(Math.random() * (isHard ? 100 : 20)) + 1; 
        n2 = Math.floor(Math.random() * (isHard ? 100 : 20)) + 1; 
        res = n1 + n2; 
    }
    if (op === '-') { 
        n1 = Math.floor(Math.random() * (isHard ? 100 : 30)) + 10; 
        n2 = Math.floor(Math.random() * n1); 
        res = n1 - n2; 
    }
    if (op === 'x') { 
        n1 = Math.floor(Math.random() * 10) + 1; 
        n2 = Math.floor(Math.random() * 10) + 1; 
        res = n1 * n2; 
    }

    return { texto: `${n1} ${op} ${n2}`, resposta: res };
  };

  // Iniciar Partida
  const iniciarPartida = (modoEscolhido: 'bot' | 'multi') => {
    if (modoEscolhido === 'multi') {
      Alert.alert("Multiplayer em Breve", "Procurando oponentes... (Vamos conectar ao Backend no próximo passo!)");
      return; // Trava aqui por enquanto até mexermos no socket_manager.py
    }

    setModo(modoEscolhido);
    
    // Sorteio Aleatório de quem será X ou O (O X sempre começa o jogo por regra)
    const pecas = ['X', 'O'];
    const sorteada = pecas[Math.floor(Math.random() * 2)];
    setMinhaPeca(sorteada as 'X' | 'O');
    setVez('X');
    setVidas(REGRAS.vidasIniciais);
    setGanhador(null);

    // Preenche o tabuleiro com contas aleatórias
    const novoBoard = [];
    for(let i=0; i<9; i++) {
        const op = gerarOperacao();
        novoBoard.push({ id: i, ...op, marcadoPor: null });
    }
    setBoard(novoBoard);
    setTela('jogando');
  };

  // Checagem de Vitória Clássica
  const checkWin = (tabuleiroAtual: any[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linhas
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colunas
      [0, 4, 8], [2, 4, 6]             // Diagonais
    ];
    
    for (let line of lines) {
      const [a,b,c] = line;
      if (tabuleiroAtual[a].marcadoPor && 
          tabuleiroAtual[a].marcadoPor === tabuleiroAtual[b].marcadoPor && 
          tabuleiroAtual[a].marcadoPor === tabuleiroAtual[c].marcadoPor) {
        
        setGanhador(tabuleiroAtual[a].marcadoPor);
        setTimeout(() => setTela('resultado'), 1000);
        return true;
      }
    }
    
    if (tabuleiroAtual.every(c => c.marcadoPor !== null)) {
       setGanhador('Empate');
       setTimeout(() => setTela('resultado'), 1000);
       return true;
    }
    return false;
  };

  // Inteligência Artificial Simples do Bot Offline
  useEffect(() => {
    if (tela === 'jogando' && modo === 'bot' && vez !== minhaPeca && !ganhador) {
        const timerId = setTimeout(() => {
            const vazias = board.filter(c => !c.marcadoPor);
            if(vazias.length > 0) {
                const escolha = vazias[Math.floor(Math.random() * vazias.length)];
                const novoBoard = [...board];
                novoBoard[escolha.id].marcadoPor = vez;
                setBoard(novoBoard);
                
                if(!checkWin(novoBoard)) {
                    setVez(minhaPeca); // Devolve a vez
                }
            }
        }, 1500); // Demora 1.5s pra "pensar"
        return () => clearTimeout(timerId);
    }
  }, [vez, tela, ganhador]);

  // Ação de confirmar a resposta digitada
  const verificarResposta = () => {
    if (celulaSelecionada === null) return;
    
    const celula = board[celulaSelecionada];
    const novoBoard = [...board];

    if (parseInt(respostaInput) === celula.resposta) {
        // ACERTOU!
        novoBoard[celulaSelecionada].marcadoPor = minhaPeca;
        setBoard(novoBoard);
        
        if(!checkWin(novoBoard)) {
            setVez(vez === 'X' ? 'O' : 'X'); // Passa a vez para o Bot/Adversario
        }
    } else {
        // ERROU!
        const novasVidas = vidas - 1;
        setVidas(novasVidas);
        
        if (novasVidas <= 0) {
            setGanhador(minhaPeca === 'X' ? 'O' : 'X'); // Oponente ganha
            setTimeout(() => setTela('resultado'), 1000);
        } else {
            // Aplicar a regra customizável do Admin
            if (REGRAS.passarVezAoErrar) {
                setVez(vez === 'X' ? 'O' : 'X');
            } else {
                Alert.alert("Errou!", "Tente novamente!");
            }
        }
    }

    setCelulaSelecionada(null);
    setRespostaInput('');
  };

  // ==========================================
  // RENDERIZAÇÕES DAS TELAS
  // ==========================================
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
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#32CD32' }]} onPress={() => iniciarPartida('bot')}>
            <Ionicons name="hardware-chip" size={24} color="#000" />
            <Text style={styles.btnText}>TREINAR VS ROBÔ</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#4169E1' }]} onPress={() => iniciarPartida('multi')}>
            <Ionicons name="globe" size={24} color="#FFF" />
            <Text style={[styles.btnText, { color: '#FFF' }]}>JOGAR ONLINE</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (tela === 'resultado') {
    const isVitoria = ganhador === minhaPeca;
    const isEmpate = ganhador === 'Empate';
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultadoContainer}>
          <Text style={{ fontSize: 64 }}>{isEmpate ? '🤝' : (isVitoria ? '🏆' : '💀')}</Text>
          <Text style={styles.resultadoTitle}>
            {isEmpate ? 'Deu Velha!' : (isVitoria ? 'Você Venceu!' : 'Você Perdeu!')}
          </Text>
          <TouchableOpacity style={[styles.btnIniciar, { backgroundColor: '#FFD700', marginTop: 30 }]} onPress={() => setTela('menu')}>
            <Text style={styles.btnText}>VOLTAR AO MENU</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      <View style={styles.topInfo}>
        <View>
          <Text style={styles.infoLabel}>Sua Peça:</Text>
          <Text style={[styles.infoValue, { color: minhaPeca === 'X' ? '#FF4444' : '#32CD32' }]}>{minhaPeca}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.infoLabel}>Vez de:</Text>
          <Text style={styles.infoValue}>{vez === minhaPeca ? 'VOCÊ' : 'OPONENTE'}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.infoLabel}>Vidas:</Text>
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            {Array.from({ length: vidas }).map((_, i) => <Ionicons key={i} name="heart" size={18} color="#FF4444" />)}
          </View>
        </View>
      </View>

      {/* GRID DO JOGO DA VELHA */}
      <View style={styles.boardContainer}>
        {board.map((celula, index) => (
          <TouchableOpacity 
            key={index} 
            style={[
               styles.cell, 
               celula.marcadoPor && styles.cellMarked,
               celulaSelecionada === index && { borderColor: '#FFD700', borderWidth: 3 }
            ]}
            disabled={celula.marcadoPor !== null || vez !== minhaPeca}
            onPress={() => setCelulaSelecionada(index)}
          >
            {celula.marcadoPor ? (
              <Text style={[styles.cellMarkText, { color: celula.marcadoPor === 'X' ? '#FF4444' : '#32CD32' }]}>
                {celula.marcadoPor}
              </Text>
            ) : (
              <Text style={styles.cellOpText}>{celula.texto}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* PAINEL DE TECLADO PARA RESPOSTA (SÓ APARECE QUANDO CLICA NA CÉLULA) */}
      {celulaSelecionada !== null && (
        <View style={styles.bottomPanel}>
          <Text style={{ color: '#FFF', marginBottom: 10, fontSize: 16 }}>Quanto é: <Text style={{fontWeight: 'bold', color: '#FFD700'}}>{board[celulaSelecionada].texto}</Text>?</Text>
          
          <View style={styles.displayContainer}>
              <Text style={styles.displayText}>{respostaInput || ' '}</Text>
          </View>
          
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
      
      {/* Botão de Fechar Teclado caso desista de marcar a casa atual */}
      {celulaSelecionada !== null && (
          <TouchableOpacity style={{position: 'absolute', top: 120, right: 20}} onPress={() => {setCelulaSelecionada(null); setRespostaInput('');}}>
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
  
  topInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, backgroundColor: '#1a1a2e', padding: 15, borderRadius: 15 },
  infoLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  infoValue: { color: '#FFF', fontSize: 22, fontWeight: '900' },

  boardContainer: { width: BOARD_SIZE, height: BOARD_SIZE, flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'center', gap: 10, justifyContent: 'center' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#1a1a2e', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#333' },
  cellMarked: { backgroundColor: '#0c0c0c' },
  cellOpText: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
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
