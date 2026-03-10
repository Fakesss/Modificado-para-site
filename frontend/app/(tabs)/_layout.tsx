import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import { Equipe } from '../../src/types';
import OnlineHeartbeat from '../../src/components/OnlineHeartbeat'; // <<< IMPORTAÇÃO DO SISTEMA ONLINE AQUI

// Team colors map
const TEAM_COLORS: Record<string, string> = {
  'equipe-alfa': '#FFD700',
  'equipe-delta': '#4169E1',
  'equipe-omega': '#32CD32',
};

function AdminBanner() {
  const { user, isAdminViewingAsStudent, setAdminViewingAsStudent } = useAuth();
  const router = useRouter();
  
  const handleBackToAdmin = () => {
    setAdminViewingAsStudent(false);
    router.replace('/admin');
  };

  if (!(isAdminViewingAsStudent || user?.perfil === 'ADMIN')) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.adminBanner} onPress={handleBackToAdmin}>
      <Ionicons name="arrow-back" size={18} color="#FFD700" />
      <Text style={styles.adminBannerText}>Voltar ao Painel do Administrador</Text>
    </TouchableOpacity>
  );
}

function NeonLineSimple({ color }: { color: string }) {
  return (
    <View style={[styles.neonLine, { backgroundColor: color }]} />
  );
}

export default function TabsLayout() {
  const { user, isAdminViewingAsStudent } = useAuth();
  const isLeader = user?.perfil === 'ALUNO_LIDER';
  const [teamColor, setTeamColor] = useState<string>('#FFD700');

  useEffect(() => {
    loadTeamColor();
  }, [user?.equipeId, isAdminViewingAsStudent]);

  const loadTeamColor = async () => {
    try {
      // 1. SE FOR ADMIN NO MODO VISUALIZAÇÃO: Puxa a cor salva no celular
      if (isAdminViewingAsStudent || user?.perfil === 'ADMIN') {
        const savedAdminColor = await AsyncStorage.getItem('adminPreviewColor');
        if (savedAdminColor) {
          setTeamColor(savedAdminColor);
          return; // Para a função aqui. Não puxa cor de equipe nenhuma.
        }
      }

      // 2. SE FOR ALUNO NORMAL: Puxa a cor da equipe no banco de dados
      if (user?.equipeId) {
        const equipes = await api.getEquipes();
        const userEquipe = equipes.find((e: Equipe) => e.id === user?.equipeId);
        if (userEquipe) {
          setTeamColor(userEquipe.cor);
        }
      }
    } catch (error) {
      console.error('Error loading team color:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnlineHeartbeat /> {/* <<< CORAÇÃO BATENDO (AVISA QUE ESTÁ ONLINE) */}
      <AdminBanner />
      <NeonLineSimple color={teamColor} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: teamColor + '40',
            borderTopWidth: 2,
            paddingBottom: Platform.OS === 'ios' ? 20 : 12, // Dá mais espaço embaixo no Android (12) e no iOS (20)
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 85 : 70, // Aumenta a altura total da barra
          },
          tabBarActiveTintColor: teamColor,
          tabBarInactiveTintColor: '#666',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginBottom: Platform.OS === 'android' ? 4 : 0, // Ajuste fino pro texto não encostar
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ranking"
          options={{
            title: 'Ranking',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="conteudos"
          options={{
            title: 'Conteúdos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="folder-open" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="exercicios"
          options={{
            title: 'Atividades',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="videos"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="progresso"
          options={{
            title: 'Progresso',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        
        {/* <<< NOVA ABA DE JOGADORES ONLINE >>> */}
        <Tabs.Screen
          name="jogadores"
          options={{
            title: 'Online',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="radio" size={size} color={color} /> 
            ),
          }}
        />

        <Tabs.Screen
          name="jogo"
          options={{
            title: 'Jogo',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="game-controller" size={size} color={color} />
            ),
            tabBarBadge: '🧪',
            tabBarBadgeStyle: { backgroundColor: 'transparent', fontSize: 10 },
          }}
        />
        
        {/* Usando o href para esconder a aba caso não seja líder, sem causar erro na Vercel */}
        <Tabs.Screen
          name="equipe"
          options={{
            title: 'Equipe',
            href: isLeader ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD70040',
  },
  adminBannerText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  neonLine: {
    height: 2,
    width: '100%',
    opacity: 0.6,
  },
});
