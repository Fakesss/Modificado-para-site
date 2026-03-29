import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Image, Platform, UIManager, LayoutAnimation
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';
import { useAuth } from '../../src/context/AuthContext'; // 🚨 IMPORTADO

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Videos() {
  const router = useRouter();
  const { user } = useAuth(); // 🚨 PUXANDO O ALUNO LOGADO
  const [videos, setVideos] = useState<Conteudo[]>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getConteudos('videos');
      
      // 🚨 PORTA DE SEGURANÇA: Filtra os vídeos
      const filteredVideos = data.filter((v: Conteudo) => {
        if (!v.ativo || v.is_deleted || v.tipo !== 'VIDEO') return false;
        if (v.equipeId) return v.equipeId === user?.equipeId;
        if (v.turmaId) return v.turmaId === user?.turmaId;
        return true;
      });
      
      setVideos(filteredVideos);
      await checkProgress();
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkProgress = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const viewed = keys.filter(k => k.startsWith('@video_done_')).map(k => k.replace('@video_done_', ''));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewedIds(viewed);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { checkProgress(); }, []));

  const novos = videos.filter(v => !viewedIds.includes(v.id));
  const concluidos = videos.filter(v => viewedIds.includes(v.id)).sort((a, b) => a.titulo.localeCompare(b.titulo));
  
  const pastasAgrupadas = concluidos.reduce((acc, curr) => {
    const p = curr.pasta || 'Geral';
    if (!acc[p]) acc[p] = [];
    acc[p].push(curr);
    return acc;
  }, {} as Record<string, Conteudo[]>);

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="play-circle" size={28} color="#FFD700" />
        <Text style={styles.title}>Vídeo-aulas</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor="#FFD700" />}>
        
        {novos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={24} color="#FF4500" />
              <Text style={styles.sectionTitle}>Para Assistir</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Assista as aulas abaixo para ganhar pontos.</Text>
            
            {novos.map((video) => (
              <TouchableOpacity key={video.id} style={styles.videoCard} onPress={() => router.push(`/video/${video.id}`)}>
                <View style={styles.badgeNovo}><Text style={styles.badgeNovoText}>NOVO</Text></View>
                
                {video.thumbnail ? (
                  <Image source={{ uri: video.thumbnail }} style={styles.videoThumbnail} />
                ) : (
                  <View style={[styles.videoThumbnail, { backgroundColor: '#FFD70020' }]}>
                    <Ionicons name="play" size={32} color="#FFD700" />
                  </View>
                )}
                
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle}>{video.titulo}</Text>
                  {video.descricao && <Text style={styles.videoDescription} numberOfLines={2}>{video.descricao}</Text>}
                  
                  <View style={styles.videoMeta}>
                    <View style={styles.statusBadge}>
                      <Ionicons name="ellipse" size={10} color="#FFD700" />
                      <Text style={styles.statusText}>Pendente</Text>
                    </View>
                    {video.pontos > 0 && (
                      <View style={styles.pointsBadge}>
                        <Ionicons name="star" size={12} color="#FFD700" />
                        <Text style={styles.pointsText}>+{video.pontos} pts</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {Object.keys(pastasAgrupadas).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-done-circle" size={24} color="#888" />
              <Text style={[styles.sectionTitle, { color: '#888' }]}>Aulas Concluídas</Text>
            </View>
            
            {Object.entries(pastasAgrupadas).sort().map(([nomePasta, itens]) => (
              <View key={nomePasta} style={styles.pastaContainer}>
                <View style={styles.pastaHeader}>
                  <Ionicons name="folder" size={20} color="#FFD700" />
                  <Text style={styles.pastaTitle}>{nomePasta}</Text>
                </View>
                
                {itens.map((video) => (
                  <TouchableOpacity key={video.id} style={styles.cardPastas} onPress={() => router.push(`/video/${video.id}`)}>
                    <Ionicons name="play-circle" size={22} color="#666" style={{marginRight: 12}} />
                    <View style={{flex: 1}}>
                      <Text style={styles.cardPastasTitle}>{video.titulo}</Text>
                    </View>
                    <Ionicons name="checkmark" size={20} color="#32CD32" />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}

        {videos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum vídeo disponível no momento.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  sectionSubtitle: { color: '#888', fontSize: 12, marginTop: 4, marginBottom: 12 },
  
  videoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  badgeNovo: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FF4500', paddingHorizontal: 10, paddingVertical: 2, borderBottomLeftRadius: 12, zIndex: 10 },
  badgeNovoText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  videoThumbnail: { width: 100, height: 70, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  videoInfo: { flex: 1, marginLeft: 12 },
  videoTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  videoDescription: { color: '#888', fontSize: 12, marginTop: 4 },
  videoMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70020', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, gap: 4 },
  statusText: { fontSize: 10, fontWeight: 'bold', color: '#FFD700' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#32CD3220', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, gap: 4 },
  pointsText: { color: '#32CD32', fontSize: 10, fontWeight: 'bold' },
  
  pastaContainer: { backgroundColor: '#151520', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#222' },
  pastaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  pastaTitle: { color: '#FFD700', fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase' },
  cardPastas: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  cardPastasTitle: { color: '#bbb', fontSize: 14 },
  
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', fontSize: 14, marginTop: 16 },
});
