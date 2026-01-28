import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RankingItem } from '../types';

interface Props {
  ranking: RankingItem[];
  loading?: boolean;
}

export default function RankingHeader({ ranking, loading }: Props) {
  // Sort by position and take top 3
  const sortedRanking = [...ranking].sort((a, b) => a.posicao - b.posicao).slice(0, 3);
  
  // Reorder for display: 2nd, 1st, 3rd
  const displayOrder = sortedRanking.length >= 3 
    ? [sortedRanking[1], sortedRanking[0], sortedRanking[2]]
    : sortedRanking;

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
          const isFirst = item?.posicao === 1;
          const podiumHeight = isFirst ? 100 : item?.posicao === 2 ? 80 : 60;
          
          return item ? (
            <View key={item.id} style={styles.podiumItem}>
              <View style={[styles.badge, { backgroundColor: item.cor }]}>
                <Text style={styles.badgeText}>{item.nome}</Text>
              </View>
              <View style={[styles.podium, { height: podiumHeight, backgroundColor: item.cor + '40' }]}>
                <View style={[styles.positionCircle, { backgroundColor: item.cor }]}>
                  <Text style={styles.positionText}>{item.posicao}º</Text>
                </View>
                <Ionicons 
                  name={isFirst ? 'trophy' : 'medal'} 
                  size={isFirst ? 32 : 24} 
                  color={item.cor} 
                />
                <Text style={[styles.points, { color: item.cor }]}>
                  {item.pontosTotais} pts
                </Text>
              </View>
            </View>
          ) : null;
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
