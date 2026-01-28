import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Conteudo, ProgressoVideo } from '../../src/types';

export default function Videos() {
  const router = useRouter();
  const [videos, setVideos] = useState<Conteudo[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressoVideo>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const videosData = await api.getConteudos('videos');
      setVideos(videosData.filter((v: Conteudo) => v.tipo === 'VIDEO'));
      
      // Load progress for each video
      const progressData: Record<string, ProgressoVideo> = {};
      for (const video of videosData) {
        try {
          const progress = await api.getProgressoVideo(video.id);
          progressData[video.id] = progress;
        } catch (error) {
          // No progress yet
        }
      }
      setProgressMap(progressData);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getProgressStatus = (videoId: string) => {
    const progress = progressMap[videoId];
    if (!progress) return { status: 'new', label: 'Novo', color: '#888' };
    if (progress.concluido) return { status: 'completed', label: 'Concluído', color: '#32CD32' };
    return { status: 'progress', label: 'Em andamento', color: '#FFD700' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="play-circle" size={28} color="#4169E1" />
        <Text style={styles.title}>Vídeo-aulas</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />
        }
      >
        {videos.map((video) => {
          const progressStatus = getProgressStatus(video.id);
          const progress = progressMap[video.id];
          
          return (
            <TouchableOpacity
              key={video.id}
              style={styles.videoCard}
              onPress={() => router.push(`/video/${video.id}`)}
            >
              <View style={styles.videoThumbnail}>
                <Ionicons name="play" size={32} color="#fff" />
              </View>
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle}>{video.titulo}</Text>
                {video.descricao && (
                  <Text style={styles.videoDescription} numberOfLines={2}>
                    {video.descricao}
                  </Text>
                )}
                <View style={styles.videoMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: progressStatus.color + '30' }]}>
                    <Ionicons
                      name={progressStatus.status === 'completed' ? 'checkmark-circle' : 'ellipse'}
                      size={14}
                      color={progressStatus.color}
                    />
                    <Text style={[styles.statusText, { color: progressStatus.color }]}>
                      {progressStatus.label}
                    </Text>
                  </View>
                  {progress?.pontosGerados > 0 && (
                    <View style={styles.pointsBadge}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.pointsText}>+{progress.pontosGerados} pts</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#666" />
            </TouchableOpacity>
          );
        })}

        {videos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="videocam-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum vídeo disponível</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  videoThumbnail: {
    width: 80,
    height: 60,
    backgroundColor: '#4169E1' + '40',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  videoDescription: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  videoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#FFD700' + '30',
    gap: 4,
  },
  pointsText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});
