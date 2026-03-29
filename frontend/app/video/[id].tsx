import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';

export default function VideoPlayer() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  
  const [video, setVideo] = useState<Conteudo | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados do Sistema Anti-Trapaça
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [watchedTime, setWatchedTime] = useState(0); // Tempo real assistido em segundos
  const [completed, setCompleted] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Calcula a porcentagem do tempo assistido em relação à meta (90% do vídeo)
  const metaTempo = duration > 0 ? duration * 0.9 : 0;
  const progressoReal = metaTempo > 0 ? Math.min((watchedTime / metaTempo) * 100, 100) : 0;
  const isLiberado = progressoReal >= 100;

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

  const loadVideo = async () => {
    try {
      const conteudos = await api.getConteudos();
      const videoData = conteudos.find((v: Conteudo) => v.id === id);
      setVideo(videoData || null);

      // Como o backend não salva o progresso do vídeo, o aluno sempre começa do 0%
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cronômetro Anti-Trapaça: Só roda se o vídeo estiver tocando!
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (playing && !completed && metaTempo > 0) {
      interval = setInterval(() => {
        setWatchedTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playing, completed, metaTempo]);

  const onStateChange = useCallback((state: string) => {
    if (state === 'playing') setPlaying(true);
    else setPlaying(false);
  }, []);

  const onReady = useCallback(() => {
    playerRef.current?.getDuration().then((dur: number) => {
      setDuration(dur);
    });
  }, []);

  const handleComplete = async () => {
    if (completed) {
      router.back();
      return;
    }

    if (!isLiberado) return; // Trava de segurança extra

    setSubmitting(true);
    try {
      // SIMULAÇÃO: Como não há rota no backend, vamos simular o carregamento e sucesso
      await new Promise(resolve => setTimeout(resolve, 800));

      setCompleted(true);
      setPointsEarned(50); // Valor de pontos fictício para recompensar visualmente
      
      Alert.alert('Parabéns!', `Você concluiu a aula e ganhou 50 pontos!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao marcar como concluído.');
    } finally {
      setSubmitting(false);
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
        <Text style={styles.headerTitle} numberOfLines={1}>{video.titulo}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.playerContainer}>
        {youtubeId ? (
          <YoutubePlayer
            ref={playerRef}
            height={250}
            play={playing}
            videoId={youtubeId}
            onChangeState={onStateChange}
            onReady={onReady}
            initialPlayerParams={{
              controls: true,
              preventFullScreen: false,
              rel: false,
              modestbranding: true,
            }}
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off" size={48} color="#666" />
            <Text style={styles.noVideoText}>URL do vídeo inválida</Text>
          </View>
        )}
      </View>

      {/* BARRA DE PROGRESSO ANTI-TRAPAÇA */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progresso da Aula</Text>
          <Text style={[styles.progressPercent, isLiberado && { color: '#32CD32' }]}>
            {Math.floor(progressoReal)}%
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressoReal}%`, backgroundColor: isLiberado ? '#32CD32' : '#FFD700' }]} />
        </View>
        <Text style={styles.progressHint}>
          {isLiberado 
            ? "Aula concluída! Você já pode resgatar seus pontos." 
            : "Assista pelo menos 90% do vídeo sem pular para ganhar os pontos."}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title}>{video.titulo}</Text>
        {video.descricao && <Text style={styles.description}>{video.descricao}</Text>}

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
          (!isLiberado && !completed) && styles.completeButtonDisabled,
          completed && styles.completeButtonDone
        ]}
        onPress={handleComplete}
        disabled={(!isLiberado && !completed) || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons
              name={completed ? 'checkmark-circle' : (!isLiberado ? 'lock-closed' : 'play-circle')}
              size={24}
              color={completed ? '#fff' : (!isLiberado ? '#666' : '#000')}
            />
            <Text style={[
              styles.completeButtonText, 
              completed && { color: '#fff' },
              (!isLiberado && !completed) && { color: '#666' }
            ]}>
              {completed ? 'Vídeo Concluído - Voltar' : (!isLiberado ? 'Assista para Liberar' : 'Marcar como Concluído')}
            </Text>
          </>
        )}
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
  
  playerContainer: { width: '100%', height: 250, backgroundColor: '#000', justifyContent: 'center' },
  noVideo: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noVideoText: { color: '#666', marginTop: 12, fontSize: 16 },
  
  progressSection: { padding: 16, backgroundColor: '#151520', borderBottomWidth: 1, borderBottomColor: '#222' },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  progressPercent: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
  progressBarBg: { height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  progressHint: { color: '#888', fontSize: 12, marginTop: 8 },

  infoContainer: { padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  description: { color: '#888', fontSize: 14, marginTop: 8, lineHeight: 20 },
  statusContainer: { flexDirection: 'row', marginTop: 16, gap: 12 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#32CD3230', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  completedText: { color: '#32CD32', fontWeight: '600' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD70030', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  pointsText: { color: '#FFD700', fontWeight: '600' },
  
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700', margin: 16, paddingVertical: 16, borderRadius: 12, gap: 8 },
  completeButtonDisabled: { backgroundColor: '#222' },
  completeButtonDone: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#32CD32' },
  completeButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});
