import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTema, textoSobre } from '../context/ThemeContext';

interface Props {
  nome: string;
  cor: string;
  pontos?: number;
  size?: 'small' | 'medium' | 'large';
}

export default function TeamBadge({ nome, cor, pontos, size = 'medium' }: Props) {
  const { corEquipe } = useTema();
  const corFundo = corEquipe(cor);
  const corTexto = textoSobre(corFundo);
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { paddingH: 8, paddingV: 4, fontSize: 12, borderRadius: 10 };
      case 'large':
        return { paddingH: 16, paddingV: 10, fontSize: 18, borderRadius: 16 };
      default:
        return { paddingH: 12, paddingV: 6, fontSize: 14, borderRadius: 12 };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: corFundo,
        paddingHorizontal: sizeStyles.paddingH,
        paddingVertical: sizeStyles.paddingV,
        borderRadius: sizeStyles.borderRadius,
      }
    ]}>
      <Text style={[styles.text, { fontSize: sizeStyles.fontSize, color: corTexto }]}>
        Equipe {nome}
      </Text>
      {pontos !== undefined && (
        <Text style={[styles.points, { fontSize: sizeStyles.fontSize - 2, color: corTexto }]}>
          {pontos} pts
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#000',
    fontWeight: 'bold',
  },
  points: {
    color: '#000',
    fontWeight: '600',
    opacity: 0.8,
  },
});
