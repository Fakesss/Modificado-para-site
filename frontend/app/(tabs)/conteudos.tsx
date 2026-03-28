import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Linking, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';

export default function Conteudos() {
  const router = useRouter();
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await api.getConteudos();
      setConteudos(data.filter((c: Conteudo) => c.ativo && !c.is_deleted));
    } catch (error) {
      console.error('Error loading conteudos:', error);
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

  const abrirLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
      else Alert.alert('Erro', 'Link inválido');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o link');
    }
  };

  // FUNÇÃO MÁGICA: Descobre o tipo do arquivo lendo a assinatura do Base64
  const detectarTipoArquivo = (base64Str: string) => {
    const magic = base64Str.substring(0, 10);
    if (magic.startsWith('JVBER')) return { ext: 'pdf', mime: 'application/pdf' };
    if (magic.startsWith('iVBORw')) return { ext: 'png', mime: 'image/png' };
    if (magic.startsWith('/9j/')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (magic.startsWith('R0lGOD')) return { ext: 'gif', mime: 'image/gif' };
    if (magic.startsWith('UEsDBB')) return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }; 
    return { ext: 'bin', mime: 'application/octet-stream' }; // Formato genérico se não reconhecer
  };

  const abrirMaterial = async (conteudo: Conteudo) => {
    if (!conteudo.arquivo) {
      return Alert.alert('Erro', 'Arquivo não disponível.');
    }

    const { ext, mime } = detectarTipoArquivo(conteudo.arquivo);
    const nomeLimpo = conteudo.titulo.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${nomeLimpo}.${ext}`;

    if (Platform.OS === 'web') {
      try {
        const linkSource = `data:${mime};base64,${conteudo.arquivo}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = fileName;
        downloadLink.click();
      } catch (e) {
        Alert.alert("Erro", "Falha ao baixar no navegador.");
      }
    } else if (Platform.OS === 'android') {
      // DOWNLOAD DIRETO NO ANDROID
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mime);
          await FileSystem.writeAsStringAsync(uri, conteudo.arquivo, { encoding: 'base64' });
          Alert.alert('Sucesso', 'Arquivo baixado com sucesso!');
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Erro", "Falha ao salvar o arquivo no Android.");
      }
    } else {
      // IOS (Apple): A única forma de salvar arquivos nativamente é pela tela de compartilhar
      try {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, conteudo.arquivo, { encoding: 'base64' });
        
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri); // O usuário clica em "Salvar em Arquivos" aqui
        }
      } catch (e) {
        console.error(e);
        Alert.alert("Erro", "Falha ao abrir o arquivo no iOS.");
      }
    }
  };

  const videos = conteudos.filter((c) => c.tipo === 'VIDEO');
  const links = conteudos.filter((c) => c.tipo === 'LINK');
  const materiais = conteudos.filter((c) => c.tipo === 'MATERIAL');

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFD700" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="folder-open" size={28} color="#4169E1" />
        <Text style={styles.title}>Conteúdos</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFD700" />}
      >
        {videos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="play-circle" size={24} color="#4169E1" />
              <Text style={styles.sectionTitle}>Vídeo-aulas</Text>
            </View>
            {videos.map((video) => (
              <TouchableOpacity key={video.id} style={styles.card} onPress={() => router.push(`/video/${video.id}`)}>
                <View style={styles.cardIcon}><Ionicons name="play" size={24} color="#4169E1" /></View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{video.titulo}</Text>
                  {video.descricao && <Text style={styles.cardDescription} numberOfLines={2}>{video.descricao}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={24} color="#666" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {links.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="link" size={24} color="#32CD32" />
              <Text style={styles.sectionTitle}>Links</Text>
            </View>
            {links.map((link) => (
              <TouchableOpacity key={link.id} style={styles.card} onPress={() => link.urlVideo && abrirLink(link.urlVideo)}>
                <View style={[styles.cardIcon, { backgroundColor: '#32CD32' + '20' }]}><Ionicons name="open-outline" size={24} color="#32CD32" /></View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{link.titulo}</Text>
                  <Text style={styles.linkUrl} numberOfLines={1}>{link.urlVideo}</Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color="#32CD32" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {materiais.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={24} color="#FFD700" />
              <Text style={styles.sectionTitle}>Materiais</Text>
            </View>
            {materiais.map((material) => (
              <TouchableOpacity key={material.id} style={styles.card} onPress={() => abrirMaterial(material)}>
                <View style={[styles.cardIcon, { backgroundColor: '#FFD700' + '20' }]}><Ionicons name="document" size={24} color="#FFD700" /></View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{material.titulo}</Text>
                  <Text style={styles.cardDescription}>Toque para baixar o arquivo</Text>
                </View>
                <Ionicons name="download-outline" size={24} color="#FFD700" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {conteudos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum conteúdo disponível</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 12, marginBottom: 12 },
  cardIcon: { width: 56, height: 56, backgroundColor: '#4169E1' + '20', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, marginLeft: 12 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardDescription: { color: '#888', fontSize: 13, marginTop: 4 },
  linkUrl: { color: '#32CD32', fontSize: 12, marginTop: 4 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', fontSize: 16, marginTop: 16 },
});
