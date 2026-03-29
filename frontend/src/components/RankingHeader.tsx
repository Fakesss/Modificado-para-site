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
  // Mantendo a lógica perfeita de ordenação
  const sortedByPoints = [...ranking].sort((a, b) => b.pontosTotais - a.pontosTotais);

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
          
          const podiumHeight = isFirst ? 140 : item.posicao === 2 ? 120 : 100;
          
          // Quebra inteligente de nome mantida
          const partesNome = item.nome.split(' ');
          const nomeFormatado = partesNome.length > 1 
            ? `${partesNome[0]}\n${partesNome.slice(1).join(' ')}` 
            : item.nome;

          return (
            <View key={`${item.id}-${index}`} style={[styles.podiumItem, isFirst && { zIndex: 2 }]}>
              
              {/* 🎯 NOME DA EQUIPE (CORRIGIDO: Tamanho Uniforme e Centralização Vertical) */}
              <View style={[styles.teamNamePill, { backgroundColor: isEmpty ? '#333' : item.cor }]}>
                <Text style={styles.teamNamePillText} numberOfLines={2} adjustsFontSizeToFit>
                  {isEmpty ? '-' : nomeFormatado}
                </Text>
              </View>
              
              {/* CAIXA DO PÓDIO */}
              <View style={[styles.podiumBox, { height: podiumHeight, backgroundColor: isEmpty ? '#33333330' : item.cor + '25' }]}>
                
                <View style={[
                  styles.insidePositionCircle, 
                  { 
                    backgroundColor: isEmpty ? '#333' : item.cor,
                    width: isFirst ? 44 : 36,
                    height: isFirst ? 44 : 36,
                    borderRadius: isFirst ? 22 : 18
                  }
                ]}>
                  <Text style={[styles.insidePositionText, { fontSize: isFirst ? 18 : 14, color: isEmpty ? '#888' : '#000' }]}>
                    {item.posicao}º
                  </Text>
                </View>
                
                <Ionicons 
                  name={isEmpty ? (isFirst ? 'trophy-outline' : 'medal-outline') : (isFirst ? 'trophy' : 'medal')} 
                  size={isFirst ? 36 : 28} 
                  color={isEmpty ? '#555' : item.cor} 
                />
                
                <Text style={[styles.podiumPoints, { color: isEmpty ? '#555' : item.cor, fontSize: isFirst ? 16 : 14 }]}>
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
  
  /* 🎯 ESTILOS DA PÍLULA CORRIGIDOS (Uniformidade e Alinhamento) */
  teamNamePill: {
    width: '92%', /* 🎯 Tamanho uniforme (pouco menor que a box) */
    alignSelf: 'center', /* Centraliza */
    paddingVertical: 6,
    paddingHorizontal: 4, 
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center', /* 🎯 Centraliza o Ômega verticalmente no meio */
    marginBottom: 8,
    zIndex: 10,
    minHeight: 38, /* Aumentado ligeiramente para nomes com acento ficarem confortáveis */
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  teamNamePillText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13, 
    textAlign: 'center',
    /* 🎯 Garante que não haja alinhamento estranho de linha */
    includeFontPadding: false, 
    textAlignVertical: 'center',
  },
  podiumBox: { width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  insidePositionCircle: { alignItems: 'center', justifyContent: 'center' },
  insidePositionText: { fontWeight: 'bold' },
  podiumPoints: { fontWeight: 'bold', marginTop: 4 },
});
