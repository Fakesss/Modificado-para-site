import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as api from '../../src/services/api';
import { Conteudo, ProgressoVideo } from '../../src/types';

export default function VideoPlayer() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [video, setVideo] = useState<Conteudo | null>(null);
  const [progress, setProgress] = useState<ProgressoVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    try {
      const conteudos = await api.getConteudos('videos');
      const videoData = conteudos.find((v: Conteudo) => v.id === id);
      setVideo(videoData || null);

      if (videoData) {
        const progressData = await api.getProgressoVideo(videoData.id);
        setProgress(progressData);
        setCompleted(progressData?.concluido || false);
        setPointsEarned(progressData?.pontosGerados || 0);
      }
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (watchedSeconds: number, totalDuration: number) => {
    // Only update every 10 seconds to avoid too many API calls
    if (watchedSeconds - lastUpdateRef.current < 10) return;
    lastUpdateRef.current = watchedSeconds;

    try {
      const result = await api.updateProgressoVideo(id as string, watchedSeconds, totalDuration);
      if (result.concluido && !completed) {
        setCompleted(true);
        setPointsEarned(result.pontosGerados);
        Alert.alert(
          'Parabéns!',
          `Você concluiu este vídeo e ganhou ${result.pontosGerados} pontos!`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleComplete = async () => {
    if (completed) {
      router.back();
      return;
    }

    try {
      // Force completion
      const result = await api.updateProgressoVideo(id as string, duration || 300, duration || 300);
      setCompleted(true);
      setPointsEarned(result.pontosGerados);
      Alert.alert(
        'Parabéns!',
        `Você concluiu este vídeo e ganhou ${result.pontosGerados} pontos!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error completing video:', error);
    }
  };

  const getYouTubeId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
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

  if (!video) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="videocam-off" size={48} color="#666" />
          <Text style={styles.errorText}>Vídeo não encontrado</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const youtubeId = video.urlVideo ? getYouTubeId(video.urlVideo) : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {video.titulo}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Video Player */}
      <View style={styles.playerContainer}>
        {youtubeId ? (
          <WebView
            style={styles.player}
            source={{
              uri: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`,
            }}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off" size={48} color="#666" />
            <Text style={styles.noVideoText}>Vídeo não disponível</Text>
          </View>
        )}
      </View>

      {/* Video Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{video.titulo}</Text>
        {video.descricao && <Text style={styles.description}>{video.descricao}</Text>}

        {/* Status */}
        <View style={styles.statusContainer}>
          {completed && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
              <Text style={styles.completedText}>Concluído</Text>
            </View>
          )}
          {pointsEarned > 0 && (
            <View style={styles.pointsBadge}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.pointsText}>+{pointsEarned} pts</Text>
            </View>
          )}
        </View>
      </View>

      {/* Complete Button */}
      <TouchableOpacity
        style={[styles.completeButton, completed && styles.completeButtonDone]}
        onPress={handleComplete}
      >
        <Ionicons
          name={completed ? 'checkmark-circle' : 'play-circle'}
          size={24}
          color={completed ? '#fff' : '#000'}
        />
        <Text style={[styles.completeButtonText, completed && { color: '#fff' }]}>
          {completed ? 'Vídeo Concluído - Voltar' : 'Marcar como Concluído'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FFD700',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  playerContainer: {
    width: width,
    height: width * 0.5625, // 16:9 aspect ratio
    backgroundColor: '#000',
  },
  player: {
    flex: 1,
  },
  noVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: '#666',
    marginTop: 12,
  },
  infoContainer: {
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  description: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#32CD32' + '30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  completedText: {
    color: '#32CD32',
    fontWeight: '600',
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700' + '30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  pointsText: {
    color: '#FFD700',
    fontWeight: '600',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#32CD32',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonDone: {
    backgroundColor: '#1a1a2e',
  },
  completeButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
