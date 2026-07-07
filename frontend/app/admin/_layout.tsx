import React from 'react';
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0c0c0c' },
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
      <Stack.Screen name="criar-exercicio" options={{ presentation: 'modal' }} />
      <Stack.Screen name="criar-conteudo" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
