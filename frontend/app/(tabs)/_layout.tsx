import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';
import NeonLine from '../../src/components/NeonLine';
import { Equipe } from '../../src/types';

// Team colors map
const TEAM_COLORS: Record<string, string> = {
  'equipe-alfa': '#FFD700',
  'equipe-delta': '#4169E1',
  'equipe-omega': '#32CD32',
};

export default function TabsLayout() {
  const { user, isAdminViewingAsStudent, setAdminViewingAsStudent } = useAuth();
  const router = useRouter();
  const isLeader = user?.perfil === 'ALUNO_LIDER';
  const [teamColor, setTeamColor] = useState<string>('#FFD700');

  useEffect(() => {
    if (user?.equipeId) {
      // Use predefined colors or fetch from API
      const color = TEAM_COLORS[user.equipeId];
      if (color) {
        setTeamColor(color);
      } else {
        // Fetch team color from API
        loadTeamColor();
      }
    }
  }, [user?.equipeId]);

  const loadTeamColor = async () => {
    try {
      const equipes = await api.getEquipes();
      const userEquipe = equipes.find((e: Equipe) => e.id === user?.equipeId);
      if (userEquipe) {
        setTeamColor(userEquipe.cor);
      }
    } catch (error) {
      console.error('Error loading team color:', error);
    }
  };

  const handleBackToAdmin = () => {
    setAdminViewingAsStudent(false);
    router.replace('/admin');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0c0c0c' }}>
      {/* Admin viewing as student banner */}
      {(isAdminViewingAsStudent || user?.perfil === 'ADMIN') && (
        <TouchableOpacity style={styles.adminBanner} onPress={handleBackToAdmin}>
          <Ionicons name="arrow-back" size={18} color="#FFD700" />
          <Text style={styles.adminBannerText}>Voltar ao Painel do Administrador</Text>
        </TouchableOpacity>
      )}
      
      {/* Neon line below the banner */}
      <NeonLine color={teamColor} position="top" />
      
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#1a1a2e',
            borderTopColor: teamColor + '40',
            borderTopWidth: 2,
            paddingBottom: 8,
            paddingTop: 8,
            height: 65,
          },
          tabBarActiveTintColor: teamColor,
          tabBarInactiveTintColor: '#666',
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
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
          name="videos"
          options={{
            title: 'Vídeos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="play-circle" size={size} color={color} />
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
          name="progresso"
          options={{
            title: 'Progresso',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        {isLeader && (
          <Tabs.Screen
            name="equipe"
            options={{
              title: 'Equipe',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="people" size={size} color={color} />
              ),
            }}
          />
        )}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 10,
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
});
