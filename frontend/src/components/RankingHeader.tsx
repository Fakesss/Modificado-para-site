import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RankingItem } from '../types';

interface Props {
  ranking: RankingItem[];
  loading?: boolean;
}

// Placeholder for empty positions
const EMPTY_ITEM = { id: 'empty', nome: '-', cor: '#333', pontosTotais: 0, posicao: 0 };

export default function RankingHeader({ ranking, loading }: Props) {
  // Sort by position
  const sortedRanking = [...ranking].sort((a, b) => a.posicao - b.posicao);
  
  // Get first 3 or use placeholders
  const first = sortedRanking[0] || { ...EMPTY_ITEM, posicao: 1 };
  const second = sortedRanking[1] || { ...EMPTY_ITEM, posicao: 2 };
  const third = sortedRanking[2] || { ...EMPTY_ITEM, posicao: 3 };
  
  // Display order: 2nd, 1st, 3rd
  const displayOrder = [second, first, third];

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Carregando ranking...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ranking das Equipes</Text>
      <View style={styles.podiumContainer}>
        {displayOrder.map((item, index) => {
          const isFirst = item.posicao === 1;
          const isEmpty = item.id === 'empty';
          
          // 🚨 AQUI ESTÁ A MÁGICA DA ALTURA: Aumentamos as alturas para nada vazar!
          const podiumHeight = isFirst ? 110 : item.posicao === 2 ? 95 : 80;
          
          return (
            <View key={`${item.id}-${index}`} style={styles.podiumItem}>
              <View style={[styles.badge, { backgroundColor: item.cor }]}>
                <Text style={styles.badgeText} numberOfLines={2} adjustsFontSizeToFit>
                  {item.nome}
                </Text>
              </View>
              <View style={[styles.podium, { height: podiumHeight, backgroundColor: item.cor + '40' }]}>
                <View style={[styles.positionCircle, { backgroundColor: item.cor }]}>
                  <Text style={styles.positionText}>{item.posicao}º</Text>
                </View>
                <Ionicons 
                  name={isEmpty ? (isFirst ? 'trophy-outline' : 'medal-outline') : (isFirst ? 'trophy' : 'medal')} 
                  size={isFirst ? 32 : 24} 
                  color={isEmpty ? '#555' : item.cor} 
                />
                <Text style={[styles.points, { color: isEmpty ? '#555' : item.cor }]}>
                  {isEmpty ? '- pts' : `${item.pontosTotais} pts`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1, // Faz com que todas as colunas tenham a mesma largura
  },
  badge: {
    width: '100%', // Força a ocupar toda a largura da coluna
    minHeight: 40, // Garante que caibam duas linhas de texto se o nome for grande
    justifyContent: 'center',
    alignItems: 'center', // Centraliza o texto
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12, // Dá um espaço para a bolinha da posição não encostar
  },
  badgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center', // Centraliza o texto
  },
  podium: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  positionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute', // Coloca a bolinha no topo absoluto do podium
    top: -14, // Puxa ela para cima para ficar metade pra dentro, metade pra fora
    borderWidth: 2,
    borderColor: '#1a1a2e',
    zIndex: 2,
  },
  positionText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  points: {
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 8, // Dá espaço depois do troféu/medalha
  },
});
