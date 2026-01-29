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
  const [canComplete, setCanComplete] = useState(false);
  const [watchedPercentage, setWatchedPercentage] = useState(0);
  const lastUpdateRef = useRef(0);
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    try {
      const conteudos = await api.getConteudos('videos');
      const videoData = conteudos.find((v: Conteudo) => v.id === id);
      setVideo(videoData || null);

      if (videoData) {
        try {
          const progressData = await api.getProgressoVideo(videoData.id);
          setProgress(progressData);
          setCompleted(progressData?.concluido || false);
          setPointsEarned(progressData?.pontosGerados || 0);
          // If already completed, allow marking as complete
          if (progressData?.concluido) {
            setCanComplete(true);
            setWatchedPercentage(100);
          }
        } catch (error) {
          // No progress yet
        }
      }
    } catch (error) {
      console.error('Error loading video:', error);
      Alert.alert('Erro', 'Não foi possível carregar o vídeo. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'timeupdate') {
        const currentSec = data.currentTime;
        const totalSec = data.duration;
        
        setCurrentTime(currentSec);
        setDuration(totalSec);
        
        if (totalSec > 0) {
          const percentage = (currentSec / totalSec) * 100;
          setWatchedPercentage(percentage);
          
          // Enable complete button when 90% watched
          if (percentage >= 90 && !canComplete) {
            setCanComplete(true);
          }
        }
        
        // Update progress every 10 seconds
        if (currentSec - lastUpdateRef.current >= 10) {
          updateProgress(currentSec, totalSec);
        }
      } else if (data.type === 'error') {
        console.error('YouTube player error:', data.error);
        Alert.alert(
          'Erro no Player',
          `Erro ${data.error}: Problema ao reproduzir o vídeo. Verifique se o link do YouTube está correto e se o vídeo não foi removido.`
        );
      }
    } catch (error) {
      console.error('Error parsing webview message:', error);
    }
  };

  const updateProgress = async (watchedSeconds: number, totalDuration: number) => {
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

    // Require 90% watched
    if (!canComplete) {
      Alert.alert(
        'Atenção',
        `Você precisa assistir pelo menos 90% do vídeo para marcá-lo como concluído. Progresso atual: ${Math.round(watchedPercentage)}%`
      );
      return;
    }

    try {
      // Force completion with current time
      const result = await api.updateProgressoVideo(
        id as string,
        Math.max(currentTime, duration * 0.9),
        duration || 300
      );
      setCompleted(true);
      setPointsEarned(result.pontosGerados);
      Alert.alert(
        'Parabéns!',
        `Você concluiu este vídeo e ganhou ${result.pontosGerados} pontos!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error completing video:', error);
      Alert.alert('Erro', 'Não foi possível marcar como concluído. Tente novamente.');
    }
  };

  const getYouTubeId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ \s]{11})/;
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

  // Enhanced YouTube embed with tracking
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; }
          body { background: #000; }
          #player { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script>
          var tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          var firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          
          var player;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              videoId: '${youtubeId}',
              playerVars: {
                'autoplay': 1,
                'rel': 0,
                'modestbranding': 1,
                'playsinline': 1
              },
              events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
              }
            });
          }
          
          function onPlayerReady(event) {
            // Start tracking
            setInterval(function() {
              if (player && player.getCurrentTime) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'timeupdate',
                  currentTime: player.getCurrentTime(),
                  duration: player.getDuration()
                }));
              }
            }, 1000);
          }
          
          function onPlayerStateChange(event) {
            // Track state changes if needed
          }
          
          function onPlayerError(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              error: event.data
            }));
          }
        </script>
      </body>
    </html>
  `;

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
            ref={webViewRef}
            style={styles.player}
            source={{ html: htmlContent }}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            onMessage={handleWebViewMessage}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error:', nativeEvent);
              Alert.alert('Erro', 'Falha ao carregar o player de vídeo.');
            }}
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off" size={48} color="#666" />
            <Text style={styles.noVideoText}>URL do vídeo inválida</Text>
            <Text style={styles.noVideoSubtext}>Verifique o link do YouTube</Text>
          </View>
        )}
      </View>

      {/* Video Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{video.titulo}</Text>
        {video.descricao && <Text style={styles.description}>{video.descricao}</Text>}

        {/* Progress Bar */}
        {!completed && duration > 0 && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(watchedPercentage, 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {Math.round(watchedPercentage)}% assistido {canComplete ? '✓' : '(mín. 90% para concluir)'}
            </Text>
          </View>
        )}

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
        style={[
          styles.completeButton,
          completed && styles.completeButtonDone,
          !canComplete && !completed && styles.completeButtonDisabled
        ]}
        onPress={handleComplete}
        disabled={!canComplete && !completed}
      >
        <Ionicons
          name={completed ? 'checkmark-circle' : canComplete ? 'play-circle' : 'lock-closed'}
          size={24}
          color={completed ? '#fff' : canComplete ? '#000' : '#666'}
        />
        <Text style={[
          styles.completeButtonText,
          completed && { color: '#fff' },
          !canComplete && !completed && { color: '#666' }
        ]}>
          {completed
            ? 'Vídeo Concluído - Voltar'
            : canComplete
            ? 'Marcar como Concluído'
            : `Assista ${Math.round(90 - watchedPercentage)}% para desbloquear`}
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
    height: width * 0.5625,
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
    fontSize: 16,
  },
  noVideoSubtext: {
    color: '#444',
    marginTop: 4,
    fontSize: 12,
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
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1a1a2e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#32CD32',
  },
  progressText: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
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
  completeButtonDisabled: {
    backgroundColor: '#1a1a2e',
    opacity: 0.5,
  },
  completeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
