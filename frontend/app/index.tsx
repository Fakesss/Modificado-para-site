import React, { useEffect, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useTema, CoresTema } from '../src/context/ThemeContext';

export default function Index() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { user, isLoading, isPreviewMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (user.perfil === 'ADMIN' || isPreviewMode) {
          router.replace('/admin');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, user, isPreviewMode]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={cores.dourado} />
    </View>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: cores.fundo,
  },
});
