import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';

export default function VideoPlayer() {
  const params = useLocalSearchParams();
  const videoId = String(Array.isArray(params.id) ? params.id[0] : params.id);
  
  const router = useRouter();
  const [video, setVideo] = useState<Conteudo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados puramente visuais (para a tela)
  const [watchedPercentage, setWatchedPercentage] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [canComplete, setCanComplete] = useState(false);
  const [initialStart, setInitialStart] = useState(0);
  
  // 🛡️ MEMÓRIA INVISÍVEL (Sobrevive à maximização e não causa re-render)
  const iframeRef = useRef<any>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastSyncedRef = useRef(0);
  const isCompletedRef = useRef(false);
  const canCompleteRef = useRef(false);

  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ \s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const youtubeId = video?.urlVideo ? getYouTubeId(video.urlVideo) : null;

  useEffect(() => {
    if (videoId && videoId !== 'undefined') {
      loadVideo();
    }
  }, [videoId]);

  const loadVideo = async () => {
    try {
      const conteudos = await api.getConteudos('videos');
      const videoData = conteudos.find((v: Conteudo) => v.id === videoId);
      setVideo(videoData || null);

      if (videoData) {
        try {
          const progressData = await api.getProgressoVideo(videoData.id);
          if (progressData) {
            const tempoSalvo = Math.floor(progressData.tempoAssistidoSeg || 0);
            const duracaoSalva = Math.floor(progressData.duracaoSeg || 0);
            
            // Abastece a memória invisível
            currentTimeRef.current = tempoSalvo;
            lastSyncedRef.current = tempoSalvo;
            durationRef.current = duracaoSalva;
            setInitialStart(tempoSalvo);
            
            if (duracaoSalva > 0) {
              setWatchedPercentage((tempoSalvo / duracaoSalva) * 100);
            }
            
            if (progressData.concluido) {
              isCompletedRef.current = true;
              canCompleteRef.current = true;
              setCompleted(true);
              setCanComplete(true);
              setPointsEarned(progressData.pontosGerados || 0);
              setWatchedPercentage(100);
            }
          }
        } catch (error) {}
      }
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  // 📻 OUVINTE SILENCIOSO (Escuta o YouTube sem bugar a tela)
  useEffect(() => {
    const handleMessage = (event: any) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') currentTimeRef.current = data.info.currentTime;
          if (typeof data.info.duration === 'number') durationRef.current = data.info.duration;
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ⚙️ O MOTOR DE FUNDO (Apenas ele se comunica com o Servidor)
  useEffect(() => {
    if (!videoId || loading) return;

    const engine = setInterval(() => {
      // 1. Pede os dados atuais para o Iframe
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage('{"event":"listening","id":1}', 'https://www.youtube.com');
      }

      const current = Math.floor(currentTimeRef.current);
      const duration = Math.floor(durationRef.current);

      // 2. Barreira primária: Se os dados estiverem zoados, ignora.
      if (duration <= 0 || isNaN(current) || isNaN(duration)) return;

      // 3. Atualiza apenas a barrinha de progresso na tela
      const percent = (current / duration) * 100;
      setWatchedPercentage(percent > 100 ? 100 : percent);

      if (percent >= 90 && !canCompleteRef.current) {
        canCompleteRef.current = true;
        setCanComplete(true);
      }

      // 4. A TRAVA DO PLAY (Resolve o Erro 500)
      // Só envia para o Render se o vídeo ANDOU pelo menos 3 segundos desde a última vez
      if (current >= lastSyncedRef.current + 3) {
        lastSyncedRef.current = current; // Atualiza o último envio

        api.updateProgressoVideo(videoId, current, duration)
          .then(result => {
            if (result.concluido && !isCompletedRef.current) {
              isCompletedRef.current = true;
              setCompleted(true);
              setPointsEarned(result.pontosGerados);
              if (typeof window !== 'undefined' && window.alert) window.alert(`Parabéns! Você concluiu este vídeo e ganhou ${result.pontosGerados} pontos!`);
            }
          })
          .catch(() => { /* Falhas rápidas de 4G são ignoradas */ });
      }
    }, 2000); // Roda o motor a cada 2 segundos

    return () => clearInterval(engine);
  }, [videoId, loading]);

  const handleComplete = async () => {
    if (completed) {
      router.back();
      return;
    }

    if (!canComplete) {
      if (typeof window !== 'undefined' && window.alert) window.alert(`Você precisa assistir pelo menos 90% do vídeo. Progresso atual: ${Math.round(watchedPercentage)}%`);
      return;
    }

    try {
      const current = Math.floor(currentTimeRef.current);
      const duration = Math.floor(durationRef.current);
      
      const result = await api.updateProgressoVideo(
        videoId,
        Math.floor(Math.max(current, duration * 0.9)),
        Math.floor(duration || 300)
      );
      
      isCompletedRef.current = true;
      setCompleted(true);
      setPointsEarned(result.pontosGerados);
      
      if (typeof window !== 'undefined' && window.alert) window.alert(`Parabéns! Você ganhou ${result.pontosGerados} pontos!`);
      router.back();
    } catch (error) {
      if (typeof window !== 'undefined' && window.alert) window.alert('Erro ao marcar como concluído.');
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
            src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&autoplay=0&rel=0&modestbranding=1&start=${initialStart}`}
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

        {!completed && durationRef.current > 0 && (
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
  playerContainer: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }, // Aspect Ratio nativo (16:9)
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
