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
  // Ordena os itens pela pontuação real
  const sortedByPoints = [...ranking].sort((a, b) => b.pontosTotais - a.pontosTotais);

  const first = sortedByPoints[0] ? { ...sortedByPoints[0], posicao: 1 } : { ...EMPTY_ITEM, posicao: 1 };
  const second = sortedByPoints[1] ? { ...sortedByPoints[1], posicao: 2 } : { ...EMPTY_ITEM, posicao: 2 };
  const third = sortedByPoints[2] ? { ...sortedByPoints[2], posicao: 3 } : { ...EMPTY_ITEM, posicao: 3 };
  
  const displayOrder = [second, first, third];

  // 🚨 A MÁGICA MATEMÁTICA DA ALTURA AQUI: Pega a pontuação do 1º lugar para ser o Teto (100%)
  const maxPoints = first.pontosTotais;

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
          
          // 🚨 CÁLCULO DINÂMICO DE ALTURA
          let podiumHeight = 100;
          if (maxPoints === 0) {
             // Se ninguém tem ponto ainda, faz uma escadinha padrão
             podiumHeight = isFirst ? 140 : item.posicao === 2 ? 120 : 100;
          } else {
             // Altura proporcional: Pontos da equipe divido pelos pontos do 1º lugar * Altura Máxima (140)
             // Math.max(85, ...) garante que a caixa nunca fique menor que 85px para não quebrar o design
             podiumHeight = Math.max(85, (item.pontosTotais / maxPoints) * 140);
          }
          
          const partesNome = item.nome.split(' ');
          const nomeFormatado = partesNome.length > 1 
            ? `${partesNome[0]}\n${partesNome.slice(1).join(' ')}` 
            : item.nome;

          return (
            <View key={`${item.id}-${index}`} style={[styles.podiumItem, isFirst && { zIndex: 2 }]}>
              
              {/* NOME DA EQUIPE */}
              <View style={[styles.teamNamePill, { backgroundColor: isEmpty ? '#333' : item.cor }]}>
                <Text style={styles.teamNamePillText} numberOfLines={2} adjustsFontSizeToFit>
                  {isEmpty ? '-' : nomeFormatado}
                </Text>
              </View>
              
              {/* CAIXA DO PÓDIO COM ALTURA DINÂMICA */}
              <View style={[styles.podiumBox, { height: podiumHeight, backgroundColor: isEmpty ? '#33333330' : item.cor + '25' }]}>
                
                {/* 🎯 BOLINHAS COM TAMANHO UNIFORME E PERFEITO PARA TODOS */}
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
  
  teamNamePill: {
    width: '92%', 
    alignSelf: 'center', 
    paddingVertical: 6,
    paddingHorizontal: 4, 
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    zIndex: 10,
    minHeight: 38, 
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
  teamNamePillText: { color: '#000', fontWeight: '900', fontSize: 13, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
  podiumBox: { width: '100%', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  
  /* 🎯 ESTILO UNIFORME PARA TODAS AS BOLINHAS */
  insidePositionCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  insidePositionText: { fontWeight: 'bold', fontSize: 14 },
  
  podiumPoints: { fontWeight: 'bold', fontSize: 14, marginTop: 4 },
});
