import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  streakDias: number;
}

export default function StreakBadge({ streakDias }: Props) {
  const getStreakColor = () => {
    if (streakDias >= 30) return '#FF4500';
    if (streakDias >= 14) return '#FF6B35';
    if (streakDias >= 7) return '#FF8C00';
    if (streakDias >= 3) return '#FFA500';
    return '#FFD700';
  };

  return (
    <View style={[styles.container, { backgroundColor: getStreakColor() + '30' }]}>
      <Ionicons name="flame" size={24} color={getStreakColor()} />
      <Text style={[styles.text, { color: getStreakColor() }]}>
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
