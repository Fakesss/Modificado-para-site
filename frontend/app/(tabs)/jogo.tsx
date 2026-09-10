import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTema, CoresTema } from '../../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HubJogos() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Ionicons name="game-controller" size={64} color={cores.dourado} />
          <Text style={styles.title}>Sala de Jogos</Text>
          <Text style={styles.subtitle}>Escolha seu modo de treinamento</Text>
        </View>

        {/* BOTÃO DO EQUAÇÕES ESPACIAIS */}
        <TouchableOpacity
          style={styles.gameCard}
          onPress={() => router.push('/sky_equations')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: cores.ciano + '20' }]}>
            <Ionicons name="rocket" size={40} color={cores.ciano} />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Equações Espaciais
            </Text>
            <Text style={styles.gameDesc}>Pilote sua nave e resolva equações para destruir os inimigos e as naves-mãe. Sobreviva!</Text>
          </View>
        </TouchableOpacity>

        {/* BOTÃO DO JOGO DA VELHA */}
        <TouchableOpacity 
          style={styles.gameCard} 
          onPress={() => router.push('/tictactoe')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: cores.sucesso + '20' }]}>
            <Ionicons name="grid" size={40} color={cores.sucesso} />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Jogo da Velha
            </Text>
            <Text style={styles.gameDesc}>Modo Clássico 3x3. Resolva a operação para marcar seu X ou O. Jogue offline ou online!</Text>
          </View>
        </TouchableOpacity>

        {/* BOTÃO DO MATEMÁTICA TURBO */}
        <TouchableOpacity 
          style={styles.gameCard} 
          onPress={() => router.push('/arcade')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: cores.azul + '20' }]}>
            <Ionicons name="rocket" size={40} color={cores.azul} />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Matemática Turbo
            </Text>
            <Text style={styles.gameDesc}>Atire lasers nas contas que caem do céu antes que elas destruam a base.</Text>
          </View>
        </TouchableOpacity>

        {/* BOTÃO DO CABO DE GUERRA OFFLINE */}
        <TouchableOpacity
          style={styles.gameCard}
          onPress={() => router.push('/cabo_de_guerra_offline')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: cores.laranja + '20' }]}>
            <Ionicons name="people" size={40} color={cores.laranja} />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Cabo de Guerra (Treino)
            </Text>
            <Text style={styles.gameDesc}>Jogue offline contra um Robô Inteligente que se adapta à sua velocidade!</Text>
          </View>
        </TouchableOpacity>

        {/* BOTÃO DA TRILHA DA TABUADA */}
        <TouchableOpacity
          style={styles.gameCard}
          onPress={() => router.push('/tabuada' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: cores.ambar + '20' }]}>
            <Ionicons name="trail-sign" size={40} color={cores.ambar} />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Trilha da Tabuada
            </Text>
            <Text style={styles.gameDesc}>Flash cards com repetição espaçada: treine a tabuada e acompanhe sua evolução real.</Text>
          </View>
        </TouchableOpacity>

        {/* BOTÃO DO SUDOKU */}
        <TouchableOpacity
          style={styles.gameCard}
          onPress={() => router.push('/sudoku' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: cores.roxo + '20' }]}>
            <Ionicons name="grid-outline" size={40} color={cores.roxo} />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Sudoku
            </Text>
            <Text style={styles.gameDesc}>Clássico jogo de lógica com números, em 5 níveis de dificuldade.</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  scrollContent: { padding: 20, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  title: { fontSize: 32, fontWeight: '900', color: cores.texto, marginTop: 12 },
  subtitle: { fontSize: 16, color: cores.textoFraco, marginTop: 4 },
  
  gameCard: { 
    flexDirection: 'row', 
    backgroundColor: cores.superficie, 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 20, 
    width: '100%', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.borda
  },
  iconContainer: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  gameInfo: { flex: 1 },
  gameTitle: { color: cores.texto, fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  gameDesc: { color: cores.textoFraco, fontSize: 13, lineHeight: 18 }
});
