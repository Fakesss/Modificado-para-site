import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTema } from '../src/context/ThemeContext';

function Navegacao() {
  const { cores, estaClaro } = useTema();
  return (
    <>
      <StatusBar style={estaClaro ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="video/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="exercicio/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="resultado" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Navegacao />
      </AuthProvider>
    </ThemeProvider>
  );
}
