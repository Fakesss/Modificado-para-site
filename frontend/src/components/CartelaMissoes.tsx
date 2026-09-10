import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTema } from '../context/ThemeContext';

// =============================================================================
// CARTELA DE MISSÕES — a cartela que o professor enviou, com as estrelas dele.
//
// Duas imagens:
//   • cartela_base.jpg  — a cartela vazia (5 colunas x 6 linhas = 30 casas)
//   • cartela_selos.png — as 30 estrelas numeradas, numa folha 5x6 em ordem
//                         (01..05 na 1ª linha, 06..10 na 2ª, e assim por diante)
//
// Cada estrela é recortada da folha por uma "janelinha" (View com overflow
// hidden) e colocada exatamente no centro da casa correspondente. As posições
// abaixo foram medidas em cima da imagem original, em pixels dela; tudo é
// convertido para o tamanho real da tela pela escala calculada no onLayout,
// então encaixa igual em qualquer celular.
// =============================================================================

const FUNDO = require('../../assets/images/cartela_base.jpg');
const SELOS = require('../../assets/images/cartela_selos.png');

// medidas da imagem cartela_base.jpg
const BASE_LARGURA = 784;
const BASE_ALTURA = 1207;
const CENTROS_X = [143, 269.5, 396, 520.5, 644.5];      // centro de cada coluna
const CENTROS_Y = [350.5, 475, 599.5, 722.5, 841, 958]; // centro de cada linha
const LADO_SELO = 100;                                   // tamanho da estrela na casa

// folha de estrelas: 5 colunas x 6 linhas
const SELOS_COLUNAS = 5;
const SELOS_LINHAS = 6;

interface Props {
  estrelas: number;
  total?: number;
  /** Esconde o contador embaixo da cartela (o admin já mostra o número dele). */
  semRodape?: boolean;
}

export default function CartelaMissoes({ estrelas, total = 30, semRodape }: Props) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);

  const escala = largura / BASE_LARGURA;
  const altura = largura * (BASE_ALTURA / BASE_LARGURA);
  const conquistadas = Math.max(0, Math.min(estrelas, total, CENTROS_X.length * CENTROS_Y.length));
  const completa = estrelas >= total;

  const aoMedir = (e: LayoutChangeEvent) => {
    const l = e.nativeEvent.layout.width;
    if (l > 0 && Math.abs(l - largura) > 0.5) setLargura(l);
  };

  const selos = useMemo(() => {
    if (escala <= 0) return null;
    const lado = LADO_SELO * escala;
    return Array.from({ length: conquistadas }, (_, i) => {
      const linha = Math.floor(i / SELOS_COLUNAS);
      const coluna = i % SELOS_COLUNAS;
      return (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: CENTROS_X[coluna] * escala - lado / 2,
            top: CENTROS_Y[linha] * escala - lado / 2,
            width: lado,
            height: lado,
            overflow: 'hidden',
          }}
        >
          <Image
            source={SELOS}
            style={{
              position: 'absolute',
              width: lado * SELOS_COLUNAS,
              height: lado * SELOS_LINHAS,
              left: -coluna * lado,
              top: -linha * lado,
            }}
            resizeMode="stretch"
          />
        </View>
      );
    });
  }, [conquistadas, escala]);

  return (
    <View>
      <View style={[styles.cartela, largura > 0 && { height: altura }]} onLayout={aoMedir}>
        <Image
          source={FUNDO}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: largura > 0 ? largura : '100%',
            height: largura > 0 ? altura : '100%',
          }}
          resizeMode="stretch"
        />
        {selos}
      </View>

      {!semRodape && (
        <View style={[styles.rodape, { backgroundColor: cores.superficie, borderColor: cores.borda }]}>
          <Ionicons name={completa ? 'trophy' : 'star'} size={16} color={cores.ambar} />
          <Text style={[styles.rodapeTexto, { color: completa ? cores.ambar : cores.texto }]}>
            {completa ? 'Cartela completa! 🎉' : `${conquistadas} de ${total} estrelas`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cartela: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    aspectRatio: BASE_LARGURA / BASE_ALTURA,
    borderRadius: 10,
    overflow: 'hidden',
  },
  rodape: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  rodapeTexto: { fontWeight: '900', fontSize: 14 },
});
