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
  // 🚨 CORREÇÃO 1: Agora ordena pelos PONTOS e não pela posição antiga do servidor
  const sortedByPoints = [...ranking].sort((a, b) => b.pontosTotais - a.pontosTotais);

  // Redefine as posições visuais baseadas em quem realmente tem mais pontos agora
  const first = sortedByPoints[0] ? { ...sortedByPoints[0], posicao: 1 } : { ...EMPTY_ITEM, posicao: 1 };
  const second = sortedByPoints[1] ? { ...sortedByPoints[1], posicao: 2 } : { ...EMPTY_ITEM, posicao: 2 };
  const third = sortedByPoints[2] ? { ...sortedByPoints[2], posicao: 3 } : { ...EMPTY_ITEM, posicao: 3 };
  
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
          
          // 🚨 CORREÇÃO 2: Aumentei as alturas para o 3º lugar (Alfa) não vazar da caixa
          const podiumHeight = isFirst ? 130 : item.posicao === 2 ? 110 : 90;
          
          // Quebra inteligente: só pula linha no primeiro espaço, evitando nomes esquisitos
          const partesNome = item.nome.split(' ');
          const nomeFormatado = partesNome.length > 1 
            ? `${partesNome[0]}\n${partesNome.slice(1).join(' ')}` 
            : item.nome;

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
                  size={isFirst ? 36 : 28} 
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
    alignItems: 'flex-end', // Garante que a escadinha do pódio fique alinhada por baixo
    gap: 8,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1, 
    justifyContent: 'flex-end',
  },
  badge: {
    width: '100%',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center', 
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 18, 
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
    borderRadius: 14,
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
    borderWidth: 2,
    borderColor: '#1a1a2e',
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
