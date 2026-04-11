import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface SpriteProps {
  imagem: any;
  larguraFrame: number;
  alturaFrame: number;
  frames: { linha: number; coluna: number }[];
  isPuxando: boolean;
  viradoParaEsquerda?: boolean;
}

export default function SpriteAnimado({ imagem, larguraFrame, alturaFrame, frames, isPuxando, viradoParaEsquerda = false }: SpriteProps) {
  const [frameAtualIndex, setFrameAtualIndex] = useState(0);

  useEffect(() => {
    // Se não estiver puxando, fica parado no primeiro frame da lista
    if (!isPuxando) {
      setFrameAtualIndex(0);
      return;
    }

    // Se estiver puxando, troca os frames a cada 150 milissegundos
    const intervalo = setInterval(() => {
      setFrameAtualIndex((prev) => (prev + 1) % frames.length);
    }, 150);

    return () => clearInterval(intervalo);
  }, [isPuxando, frames]);

  const frameAtual = frames[frameAtualIndex];
  
  // O truque da Janela: multiplicamos a linha e coluna pelo tamanho do frame e deixamos negativo para empurrar a imagem
  const posX = -(frameAtual.coluna * larguraFrame);
  const posY = -(frameAtual.linha * alturaFrame);

  return (
    <View style={{ 
      width: larguraFrame, 
      height: alturaFrame, 
      overflow: 'hidden',
      // Se for o jogador da direita, ele vira de costas para puxar a corda
      transform: [{ scaleX: viradoParaEsquerda ? -1 : 1 }] 
    }}>
      <Image
        source={imagem}
        style={{
          position: 'absolute',
          left: posX,
          top: posY,
          resizeMode: 'none' // Impede o React de distorcer a sprite sheet
        }}
      />
    </View>
  );
}
