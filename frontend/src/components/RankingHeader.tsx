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
          const podiumHeight = isFirst ? 100 : item.posicao === 2 ? 80 : 60;
          
          return (
            <View key={`${item.id}-${index}`} style={styles.podiumItem}>
              <View style={[styles.badge, { backgroundColor: item.cor }]}>
                <Text style={styles.badgeText}>{item.nome}</Text>
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
    marginBottom: 16,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 12,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  podium: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  positionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  positionText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  points: {
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 4,
  },
});
