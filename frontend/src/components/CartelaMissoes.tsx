import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// =============================================================================
// CARTELA DE MISSÕES — cartão de 30 casas que vão sendo preenchidas com
// estrelas, uma a uma, conforme o professor concede (ver admin/cartela_missoes
// e cartela_missoes.tsx). Desenhado inteiramente em código (sem imagem de
// fundo) pra combinar com o resto do app e funcionar em qualquer tamanho de
// tela — inspirado numa referência visual (moldura dourada, céu, faixa de
// título) que o professor enviou.
// =============================================================================

const COLUNAS = 6;
const LINHAS = 5;

interface Props {
  estrelas: number;
  total?: number;
}

export default function CartelaMissoes({ estrelas, total = 30 }: Props) {
  const casas = Array.from({ length: total }, (_, i) => i < estrelas);
  const completa = estrelas >= total;

  return (
    <View style={styles.moldura}>
      <LinearGradient colors={['#5EB6F0', '#BEE6FF', '#EAF7FF']} style={styles.ceu}>
        <View style={styles.nuvem1} />
        <View style={styles.nuvem2} />

        <View style={styles.faixaWrap}>
          <LinearGradient colors={['#D8232A', '#8B1418']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.faixa}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.faixaTexto}>CARTELA DE MISSÕES</Text>
            <Ionicons name="star" size={16} color="#FFD700" />
          </LinearGradient>
        </View>

        <View style={styles.grade}>
          {casas.map((preenchida, i) => (
            <View key={i} style={styles.casaWrap}>
              {preenchida ? (
                <LinearGradient colors={['#FFE07A', '#FFB300']} style={styles.casaCheia}>
                  <Ionicons name="star" size={22} color="#FFF8E1" />
                </LinearGradient>
              ) : (
                <View style={styles.casaVazia}>
                  <Ionicons name="star-outline" size={16} color="rgba(255,255,255,0.55)" />
                </View>
              )}
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.rodape, completa && styles.rodapeCompleto]}>
        <Ionicons name={completa ? 'trophy' : 'star'} size={14} color={completa ? '#8B1418' : '#FFB300'} />
        <Text style={[styles.rodapeTexto, completa && styles.rodapeTextoCompleto]}>
          {completa ? 'CARTELA COMPLETA! 🎉' : `${estrelas} / ${total} estrelas`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moldura: {
    borderRadius: 18,
    borderWidth: 4,
    borderColor: '#FFB300',
    overflow: 'hidden',
    backgroundColor: '#0d0b04',
  },
  ceu: {
    padding: 14,
    overflow: 'hidden',
  },
  nuvem1: {
    position: 'absolute', top: 10, right: -10, width: 90, height: 34, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  nuvem2: {
    position: 'absolute', top: 30, left: -18, width: 70, height: 26, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  faixaWrap: { alignItems: 'center', marginBottom: 14 },
  faixa: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    borderWidth: 2, borderColor: '#FFD700',
  },
  faixaTexto: { color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 1 },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: '2%' },
  casaWrap: { width: `${100 / COLUNAS - 2}%`, aspectRatio: 1, marginBottom: '2%' },
  casaCheia: {
    flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFF8E1',
    shadowColor: '#FFD700', shadowRadius: 6, shadowOpacity: 0.8, shadowOffset: { width: 0, height: 0 },
  },
  casaVazia: {
    flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },

  rodape: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: '#1a1608',
  },
  rodapeCompleto: { backgroundColor: '#FFD700' },
  rodapeTexto: { color: '#FFB300', fontWeight: '900', fontSize: 13 },
  rodapeTextoCompleto: { color: '#8B1418' },
});
