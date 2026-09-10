import React from 'react';
import { Stack } from 'expo-router';
import { useTema } from '../../src/context/ThemeContext';

export default function AdminLayout() {
  const { cores } = useTema();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="usuarios" />
      <Stack.Screen name="conteudos" />
      <Stack.Screen name="exercicios" />
      <Stack.Screen name="relatorios" />
      <Stack.Screen name="reino" />
      <Stack.Screen name="config_jogo" />
      <Stack.Screen name="tabuada_relatorio" />
      <Stack.Screen name="cartela_missoes" />
      <Stack.Screen name="criar-exercicio" options={{ presentation: 'modal' }} />
      <Stack.Screen name="criar-conteudo" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
