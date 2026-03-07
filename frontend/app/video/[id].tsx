import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Conteudo, ProgressoVideo } from '../../src/types';

export default function VideoPlayer() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const router = useRouter();
  const [video, setVideo] = useState<Conteudo | null>(null);
  const [progress, setProgress] = useState<ProgressoVideo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  
  const [completed, setCompleted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [canComplete, setCanComplete] = useState(false);
  const [watchedPercentage, setWatchedPercentage] = useState(0);
  
  const lastUpdateRef = useRef(0);
  const iframeRef = useRef<any>(null);

  // 🔎 Regex que aceita vídeos normais e SHORTS
  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ \s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const youtubeId = video?.urlVideo ? getYouTubeId(video.urlVideo) : null;

  useEffect(() => {
    if (id) loadVideo();
  }, [id]);

  // 📻 CANAL DE RÁDIO COM O YOUTUBE (A lógica de sucesso do seu código)
  useEffect(() => {
    if (Platform.OS !== 'web' || !youtubeId) return;

    // Escuta as respostas do YouTube
    const handleMessage = (event: any) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'infoDelivery' && data.info) {
          if (data.info.currentTime) setCurrentTime(data.info.currentTime);
          if (data.info.duration) setDuration(data.info.duration);
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);

    // Pergunta o tempo exato para o YouTube a cada 1 segundo
    const timer = setInterval(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), 'https://www.youtube.com');
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getDuration', args: [] }), 'https://www.youtube.com');
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(timer);
    };
  }, [youtubeId]);

  // 🧠 Cérebro Matemático Blindado contra o "Maximizar"
  useEffect(() => {
    const safeCurrent = Math.floor(Number(currentTime) || 0);
    const safeDuration = Math.floor(Number(duration) || 0);

    // Se a duração zerar ao maximizar a tela, ele simplesmente congela e não envia erros
    if (safeDuration > 0 && safeCurrent >= 0 && !isNaN(safeCurrent) && !isNaN(safeDuration)) {
      const percentage = (safeCurrent / safeDuration) * 100;
      setWatchedPercentage(percentage > 100 ? 100 : percentage);

      if (percentage >= 90 && !canComplete) {
        setCanComplete(true);
      }

      // Só envia dados pro servidor APÓS 5 segundos de vídeo pra não bugar
      if (safeCurrent >= 5 && (safeCurrent - lastUpdateRef.current >= 5 || percentage >= 90)) {
        if (safeCurrent > lastUpdateRef.current) {
           lastUpdateRef.current = safeCurrent;
           updateProgress(safeCurrent, safeDuration);
        }
      }
    }
  }, [currentTime, duration, canComplete]);

  const loadVideo = async () => {
    try {
      const conteudos = await api.getConteudos('videos');
      const videoData = conteudos.find((v: Conteudo) => v.id === id);
      setVideo(videoData || null);

      if (videoData) {
        try {
          const progressData = await api.getProgressoVideo(videoData.id);
          setProgress(progressData);
          
          if (progressData) {
            const tempoSalvo = Math.floor(progressData.tempoAssistidoSeg || 0);
            setStartTime(tempoSalvo);
            setCurrentTime(tempoSalvo);
            lastUpdateRef.current = tempoSalvo;
            
            if (progressData.duracaoSeg > 0) {
              setDuration(progressData.duracaoSeg);
              setWatchedPercentage((tempoSalvo / progressData.duracaoSeg) * 100);
            }
            
            setCompleted(progressData.concluido || false);
            setPointsEarned(progressData.pontosGerados || 0);
            
            if (progressData.concluido) {
              setCanComplete(true);
              setWatchedPercentage(100);
            }
          }
        } catch (error) {
          // Vídeo novo, sem progresso ainda
        }
      }
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (watchedSeconds: number, totalDuration: number) => {
    // 🔒 O CADEADO DO PYTHON: Se os números forem NaN ou zero (bug do maximizar), a porta fecha!
    if (!id || !totalDuration || totalDuration <= 0 || isNaN(watchedSeconds) || isNaN(totalDuration)) return;

    try {
      const result = await api.updateProgressoVideo(id, watchedSeconds, totalDuration);
      if (result.concluido && !completed) {
        setCompleted(true);
        setPointsEarned(result.pontosGerados);
        if (window.alert) window.alert(`Parabéns! Você concluiu este vídeo e ganhou ${result.pontosGerados} pontos!`);
      }
    } catch (error) {
      console.log('Sincronização pendente...');
    }
  };

  const handleComplete = async () => {
    if (completed) {
      router.back();
      return;
    }

    if (!canComplete) {
      if (window.alert) window.alert(`Você precisa assistir pelo menos 90% do vídeo. Progresso atual: ${Math.round(watchedPercentage)}%`);
      return;
    }

    try {
      const safeDuration = Math.floor(Number(duration) || 300);
      const result = await api.updateProgressoVideo(
        id,
        Math.floor(Math.max(Number(currentTime) || 0, safeDuration * 0.9)),
        safeDuration
      );
      setCompleted(true);
      setPointsEarned(result.pontosGerados);
      
      if (window.alert) window.alert(`Parabéns! Você ganhou ${result.pontosGerados} pontos!`);
      router.back();
    } catch (error) {
      if (window.alert) window.alert('Erro ao marcar como concluído. Tente novamente.');
    }
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

      <View style={styles.playerContainer}>
        {youtubeId ? (
          <iframe
            ref={iframeRef}
            style={{ width: '100%', height: '100%', borderWidth: 0 }}
            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&start=${startTime}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off" size={48} color="#666" />
            <Text style={styles.noVideoText}>URL do vídeo inválida</Text>
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title}>{video.titulo}</Text>
        {video.descricao && <Text style={styles.description}>{video.descricao}</Text>}

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
            : `Assista ${Math.round(Math.max(0, 90 - watchedPercentage))}% para desbloquear`}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { color: '#666', fontSize: 18, marginTop: 16 },
  backButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FFD700', borderRadius: 12 },
  backButtonText: { color: '#000', fontWeight: 'bold' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginHorizontal: 16 },
  // Usando AspectRatio para suportar Maximizar/Girar a tela perfeitamente sem bugar o React
  playerContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  noVideo: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noVideoText: { color: '#666', marginTop: 12, fontSize: 16 },
  infoContainer: { padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  description: { color: '#888', fontSize: 14, marginTop: 8, lineHeight: 20 },
  progressSection: { marginTop: 16 },
  progressBar: { height: 6, backgroundColor: '#1a1a2e', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#32CD32' },
  progressText: { color: '#888', fontSize: 12, marginTop: 8 },
  statusContainer: { flexDirection: 'row', marginTop: 16, gap: 12 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#32CD3230', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  completedText: { color: '#32CD32', fontWeight: '600' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70030', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  pointsText: { color: '#FFD700', fontWeight: '600' },
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#32CD32', margin: 16, paddingVertical: 16, borderRadius: 12, gap: 8 },
  completeButtonDone: { backgroundColor: '#1a1a2e' },
  completeButtonDisabled: { backgroundColor: '#1a1a2e', opacity: 0.5 },
  completeButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
