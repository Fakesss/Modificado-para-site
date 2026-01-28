import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0c0c0c' },
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
    </AuthProvider>
  );
}
