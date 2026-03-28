import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function HubJogos() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Ionicons name="game-controller" size={64} color="#FFD700" />
          <Text style={styles.title}>Sala de Jogos</Text>
          <Text style={styles.subtitle}>Escolha seu modo de treinamento</Text>
        </View>

        {/* BOTÃO DO JOGO DA VELHA */}
        <TouchableOpacity 
          style={[styles.gameCard, { borderColor: '#32CD32', borderWidth: 2 }]} 
          onPress={() => router.push('/tictactoe')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: '#32CD3220' }]}>
            <Ionicons name="grid" size={40} color="#32CD32" />
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
          <View style={[styles.iconContainer, { backgroundColor: '#4169E120' }]}>
            <Ionicons name="rocket" size={40} color="#4169E1" />
          </View>
          <View style={styles.gameInfo}>
            <Text style={styles.gameTitle} numberOfLines={1} ellipsizeMode="tail">
              Matemática Turbo
            </Text>
            <Text style={styles.gameDesc}>Atire lasers nas contas que caem do céu antes que elas destruam a base.</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  scrollContent: { padding: 20, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40, marginTop: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 12 },
  subtitle: { fontSize: 16, color: '#888', marginTop: 4 },
  
  gameCard: { 
    flexDirection: 'row', 
    backgroundColor: '#1a1a2e', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 20, 
    width: '100%', 
    alignItems: 'center'
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
  gameTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  gameDesc: { color: '#aaa', fontSize: 13, lineHeight: 18 }
});
