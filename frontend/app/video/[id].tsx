import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../../src/context/AuthContext';
import * as api from '../../src/services/api';

export default function VideoPlayer() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { user } = useAuth();
  
  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [watchedTime, setWatchedTime] = useState(0); 
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [showRewardModal, setShowRewardModal] = useState(false);
  
  // Pega os pontos reais cadastrados no banco de dados
  const PONTOS_RECOMPENSA = video?.pontos || 0;

  const metaTempo = duration > 0 ? duration * 0.9 : 0;
  const progressoReal = metaTempo > 0 ? Math.min((watchedTime / metaTempo) * 100, 100) : 0;
  const isLiberado = progressoReal >= 100;

  const getTeamColor = () => {
    if (user?.equipeId === 'equipe-alfa') return '#FFD700';
    if (user?.equipeId === 'equipe-delta') return '#4169E1';
    if (user?.equipeId === 'equipe-omega') return '#32CD32';
    return '#FFD700'; 
  };
  const teamColor = getTeamColor();

  const getYouTubeId = (url: string) => {
    if (!url) return null;
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ \s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const youtubeId = video?.urlVideo ? getYouTubeId(video.urlVideo) : null;

  useEffect(() => {
    if (id) {
      loadVideo();
      checkLocalCompletion();
    }
  }, [id]);

  const checkLocalCompletion = async () => {
    try {
      const isDone = await AsyncStorage.getItem(`@video_done_${id}`);
      if (isDone === 'true') {
        setCompleted(true);
        setWatchedTime(9999); 
      }
    } catch (e) { console.log(e); }
  };

  const loadVideo = async () => {
    try {
      const conteudos = await api.getConteudos();
      const videoData = conteudos.find((v: any) => v.id === id);
      setVideo(videoData || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (playing && !completed && metaTempo > 0) {
      interval = setInterval(() => {
        setWatchedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
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
    if (completed || !isLiberado) return;

    setSubmitting(true);
    try {
      // CHAMA A ROTA OFICIAL DO BACKEND QUE VAMOS CRIAR!
      await api.concluirConteudo(id as string);

      await AsyncStorage.setItem(`@video_done_${id}`, 'true');
      setCompleted(true);
      setShowRewardModal(true); 

    } catch (error) {
      console.log(error);
      Alert.alert('Aviso', 'Ocorreu um problema ao conectar com o servidor. Verifique com o administrador se a rota já foi ativada.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFD700" /></View>;

  if (!video) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.errorContainer}>
        <Ionicons name="videocam-off" size={48} color="#666" />
        <Text style={styles.errorText}>Vídeo não encontrado</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}><Text style={styles.backButtonText}>Voltar</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={showRewardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: teamColor }]}>
            <View style={[styles.iconCircle, { backgroundColor: teamColor }]}>
              <Ionicons name="trophy" size={40} color="#000" />
            </View>
            <Text style={styles.modalTitle}>PARABÉNS!</Text>
            <Text style={styles.modalText}>Você concluiu a aula com sucesso.</Text>
            {PONTOS_RECOMPENSA > 0 && (
              <Text style={[styles.modalPoints, { color: teamColor }]}>+{PONTOS_RECOMPENSA} PONTOS</Text>
            )}
            
            <TouchableOpacity style={[styles.modalButton, { backgroundColor: teamColor }]} onPress={() => setShowRewardModal(false)}>
              <Text style={styles.modalButtonText}>Incrível!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
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
            initialPlayerParams={{ controls: true, preventFullScreen: false, rel: false, modestbranding: true }}
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off" size={48} color="#666" />
            <Text style={styles.noVideoText}>URL do vídeo inválida</Text>
          </View>
        )}
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progresso da Aula</Text>
          <Text style={[styles.progressPercent, completed && { color: teamColor }]}>
            {completed ? '100%' : `${Math.floor(progressoReal)}%`}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: completed ? '100%' : `${progressoReal}%`, backgroundColor: completed ? teamColor : '#FFD700' }]} />
        </View>
        <Text style={styles.progressHint}>
          {completed ? "Aula concluída! Você já resgatou seus pontos." : "Assista sem pular para liberar a recompensa."}
        </Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.title}>{video.titulo}</Text>
        {video.descricao && <Text style={styles.description}>{video.descricao}</Text>}

        {completed && (
          <View style={[styles.completedBadge, { backgroundColor: teamColor + '20' }]}>
            <Ionicons name="checkmark-circle" size={20} color={teamColor} />
            <Text style={[styles.completedText, { color: teamColor }]}>
              Recompensa Coletada {PONTOS_RECOMPENSA > 0 ? `(+${PONTOS_RECOMPENSA} pts)` : ''}
            </Text>
          </View>
        )}
      </View>

      {!completed && (
        <TouchableOpacity
          style={[styles.completeButton, !isLiberado && styles.completeButtonDisabled]}
          onPress={handleComplete}
          disabled={!isLiberado || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name={!isLiberado ? 'lock-closed' : 'play-circle'} size={24} color={!isLiberado ? '#666' : '#000'} />
              <Text style={[styles.completeButtonText, !isLiberado && { color: '#666' }]}>
                {!isLiberado ? 'Assista para Liberar' : 'Marcar como Concluído'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

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
  
  completedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8, marginTop: 20 },
  completedText: { fontWeight: 'bold', fontSize: 14 },
  
  completeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700', margin: 16, paddingVertical: 16, borderRadius: 12, gap: 8 },
  completeButtonDisabled: { backgroundColor: '#222' },
  completeButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1a1a2e', width: '100%', borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 2 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: -60, borderWidth: 4, borderColor: '#1a1a2e' },
  modalTitle: { color: '#FFF', fontSize: 28, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  modalText: { color: '#AAA', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  modalPoints: { fontSize: 32, fontWeight: '900', marginBottom: 30 },
  modalButton: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' }
});
