import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTema, corParaTema } from '../context/ThemeContext';

interface Props {
  streakDias: number;
}

export default function StreakBadge({ streakDias }: Props) {
  const { estaClaro } = useTema();

  // No tema claro o laranja/dourado da chama é escurecido — o tom fluorescente
  // some no fundo branco.
  const getStreakColor = () => {
    if (streakDias >= 30) return '#FF4500';
    if (streakDias >= 14) return '#FF6B35';
    if (streakDias >= 7) return '#FF8C00';
    if (streakDias >= 3) return '#FFA500';
    return '#FFD700';
  };

  const cor = corParaTema(getStreakColor(), estaClaro, 0.38);

  return (
    <View style={[styles.container, { backgroundColor: cor + (estaClaro ? '18' : '30') }]}>
      <Ionicons name="flame" size={24} color={cor} />
      <Text style={[styles.text, { color: cor }]}>
        {streakDias} dia{streakDias !== 1 ? 's' : ''} de ofensiva
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  text: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});
