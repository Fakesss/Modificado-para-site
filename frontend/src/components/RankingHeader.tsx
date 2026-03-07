import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RankingItem } from '../types';

interface Props {
  ranking: RankingItem[];
  loading?: boolean;
}

const EMPTY_ITEM = { id: 'empty', nome: '-', cor: '#333', pontosTotais: 0, posicao: 0 };

export default function RankingHeader({ ranking, loading }: Props) {
  const sortedRanking = [...ranking].sort((a, b) => a.posicao - b.posicao);
  const first = sortedRanking[0] || { ...EMPTY_ITEM, posicao: 1 };
  const second = sortedRanking[1] || { ...EMPTY_ITEM, posicao: 2 };
  const third = sortedRanking[2] || { ...EMPTY_ITEM, posicao: 3 };
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
          const podiumHeight = isFirst ? 110 : item.posicao === 2 ? 90 : 75;
          
          // Quebra o nome em duas linhas certinhas (Ex: Equipe \n Delta)
          const nomeFormatado = item.nome.replace(' ', '\n');

          return (
            <View key={`${item.id}-${index}`} style={styles.podiumItem}>
              <View style={[styles.badge, { backgroundColor: item.cor }]}>
                <Text style={styles.badgeText} numberOfLines={2} adjustsFontSizeToFit>
                  {nomeFormatado}
                </Text>
              </View>
              <View style={[styles.podium, { height: podiumHeight, backgroundColor: item.cor + '30' }]}>
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
    flex: 1, 
  },
  badge: {
    width: '100%', // Ocupa a largura total da coluna
    minHeight: 48, // Altura exata para caber as 2 linhas sem espremer
    justifyContent: 'center',
    alignItems: 'center', 
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12, // Curva igual da sua imagem original
    marginBottom: 18, // Espaço exato para a bolinha não grudar no nome
  },
  badgeText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 14,
  },
  podium: {
    width: '100%',
    borderRadius: 14, // Cantos suaves no pódio também
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  positionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute', 
    top: -16, 
    zIndex: 2,
  },
  positionText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  points: {
    fontWeight: 'bold',
    fontSize: 13,
    marginTop: 6,
  },
});
