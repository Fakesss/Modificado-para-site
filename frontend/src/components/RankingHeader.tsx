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
  const sortedByPoints = [...ranking].sort((a, b) => b.pontosTotais - a.pontosTotais);

  const first = sortedByPoints[0] ? { ...sortedByPoints[0], posicao: 1 } : { ...EMPTY_ITEM, posicao: 1 };
  const second = sortedByPoints[1] ? { ...sortedByPoints[1], posicao: 2 } : { ...EMPTY_ITEM, posicao: 2 };
  const third = sortedByPoints[2] ? { ...sortedByPoints[2], posicao: 3 } : { ...EMPTY_ITEM, posicao: 3 };
  
  const displayOrder = [second, first, third];

  // Extrai as pontuações reais para a matemática relativa
  const p1 = first.pontosTotais;
  const p2 = second.pontosTotais;
  const p3 = third.pontosTotais;

  // 🚨 NOVA MATEMÁTICA RELATIVA E INTELIGENTE
  const getDynamicHeights = () => {
    // 1. Se ninguém tem pontos, escadinha padrão
    if (p1 === 0) return { 1: 140, 2: 115, 3: 90 };
    
    // 2. Regra de Ouro: Se a diferença entre o 1º e o 3º for de 10% ou menos, usa a escadinha fixa para clareza
    const diff = p1 - p3;
    if (diff <= p1 * 0.10) {
      return { 1: 140, 2: 115, 3: 90 };
    }

    // 3. Alturas Dinâmicas Relativas
    const h1 = 140;
    
    // 2º lugar sobe se aproximando do 1º (Varia entre 95 e 130)
    const ratio2 = p2 / p1;
    const h2 = 95 + (ratio2 * 35); 
    
    // 3º lugar sobe se aproximando do 2º (Varia entre 75 e quase o 2º lugar)
    const ratio3 = p2 > 0 ? (p3 / p2) : 0;
    const maxH3 = h2 - 10; // Garante que o 3º nunca ultrapasse visualmente o 2º
    const h3 = 75 + (ratio3 * (maxH3 - 75)); 

    return { 1: h1, 2: h2, 3: h3 };
  };

  const heights = getDynamicHeights();

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
          
          const podiumHeight = heights[item.posicao as keyof typeof heights] || 90;
          
          const partesNome = item.nome.split(' ');
          const nomeFormatado = partesNome.length > 1 
            ? `${partesNome[0]}\n${partesNome.slice(1).join(' ')}` 
            : item.nome;

          return (
            <View key={`${item.id}-${index}`} style={[styles.podiumItem, isFirst && { zIndex: 2 }]}>
              
              <View style={[styles.teamNamePill, { backgroundColor: isEmpty ? '#333' : item.cor }]}>
                <Text style={styles.teamNamePillText} numberOfLines={2} adjustsFontSizeToFit>
                  {isEmpty ? '-' : nomeFormatado}
                </Text>
              </View>
              
              <View style={[styles.podiumBox, { height: podiumHeight, backgroundColor: isEmpty ? '#33333330' : item.cor + '25' }]}>
                
                <View style={[styles.insidePositionCircle, { backgroundColor: isEmpty ? '#333' : item.cor }]}>
                  <Text style={[styles.insidePositionText, { color: isEmpty ? '#888' : '#000' }]}>
                    {item.posicao}º
                  </Text>
                </View>
                
                <Ionicons 
                  name={isEmpty ? (isFirst ? 'trophy-outline' : 'medal-outline') : (isFirst ? 'trophy' : 'medal')} 
                  size={isFirst ? 32 : 28} 
                  color={isEmpty ? '#555' : item.cor} 
                />
                
                <Text style={[styles.podiumPoints, { color: isEmpty ? '#555' : item.cor }]}>
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
  container: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#333' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 20 },
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 4 },
  podiumItem: { flex: 1, alignItems: 'center', marginHorizontal: 4 },
  teamNamePill: { width: '92%', alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8, zIndex: 10, minHeight: 38, borderWidth: 1, borderColor: '#1a1a2e' },
  teamNamePillText: { color: '#000', fontWeight: '900', fontSize: 13, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  podiumBox: { width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  insidePositionCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  insidePositionText: { fontWeight: 'bold', fontSize: 14 },
  podiumPoints: { fontWeight: 'bold', fontSize: 14, marginTop: 4 },
});
