import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, Linking, Alert, Platform, LayoutAnimation, UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as api from '../../src/services/api';
import { Conteudo } from '../../src/types';
import { useAuth } from '../../src/context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Conteudos() {
  const { user } = useAuth();
  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, msg: '' });

  const loadData = useCallback(async () => {
    try {
      const data = await api.getConteudos();
      
      const filteredConteudos = data.filter((c: any) => {
        if (!c.ativo || c.is_deleted || (c.tipo !== 'MATERIAL' && c.tipo !== 'LINK')) return false;
        
        const idDestino = c.usuarioId || c.alunoId;
        const alvoUsuario = idDestino && String(idDestino).trim() !== '';
        const alvoEquipe = c.equipeId && String(c.equipeId).trim() !== '';
        const alvoTurma = c.turmaId && String(c.turmaId).trim() !== '';

        const isPublic = !alvoUsuario && !alvoEquipe && !alvoTurma;
        if (isPublic) return true;

        const idAlunoLogado = user?.id || user?._id;

        if (alvoUsuario && String(idDestino) === String(idAlunoLogado)) return true;
        if (alvoEquipe && String(c.equipeId) === String(user?.equipeId)) return true;
        if (alvoTurma && String(c.turmaId) === String(user?.turmaId)) return true;
        
        return false;
      });
      
      setConteudos(filteredConteudos);
      await checkProgress();
    } catch (error) {
      console.error('Error loading conteudos:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkProgress = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const viewed = keys.filter(k => k.startsWith('@viewed_')).map(k => k.replace('@viewed_', ''));
      setViewedIds(viewed);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { checkProgress(); }, []));

  const showToast = (pastaName: string) => {
    setToast({ visible: true, msg: `Guardado na pasta: ${pastaName || 'Geral'}` });
    setTimeout(() => setToast({ visible: false, msg: '' }), 3500);
  };

  const handleMarkAsViewed = async (conteudo: Conteudo) => {
    if (!viewedIds.includes(conteudo.id)) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newViewed = [...viewedIds, conteudo.id];
      setViewedIds(newViewed);
      await AsyncStorage.setItem(`@viewed_${conteudo.id}`, 'true');
      api.concluirConteudo(conteudo.id).catch(() => {});
      showToast(conteudo.pasta || 'Geral');
    }
  };

  const abrirLink = async (conteudo: Conteudo) => {
    handleMarkAsViewed(conteudo);
    try {
      if (conteudo.urlVideo && await Linking.canOpenURL(conteudo.urlVideo)) {
        await Linking.openURL(conteudo.urlVideo);
      } else {
        Alert.alert('Erro', 'Link inválido');
      }
    } catch (error) { Alert.alert('Erro', 'Não foi possível abrir o link'); }
  };

  const detectarTipoArquivo = (base64Str: string) => {
    const magic = base64Str.substring(0, 10);
    if (magic.startsWith('JVBER')) return { ext: 'pdf', mime: 'application/pdf' };
    if (magic.startsWith('iVBORw')) return { ext: 'png', mime: 'image/png' };
    if (magic.startsWith('/9j/')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (magic.startsWith('R0lGOD')) return { ext: 'gif', mime: 'image/gif' };
    if (magic.startsWith('UEsDBB')) return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }; 
    return { ext: 'bin', mime: 'application/octet-stream' }; 
  };

  const abrirMaterial = async (conteudo: Conteudo) => {
    handleMarkAsViewed(conteudo);
    if (!conteudo.arquivo) return Alert.alert('Erro', 'Arquivo não disponível.');

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
      } catch (e) { Alert.alert("Erro", "Falha ao baixar no navegador."); }
    } else if (Platform.OS === 'android') {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, mime);
          await FileSystem.writeAsStringAsync(uri, conteudo.arquivo, { encoding: 'base64' });
        }
      } catch (e) { Alert.alert("Erro", "Falha ao salvar o arquivo."); }
    } else {
      try {
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, conteudo.arquivo, { encoding: 'base64' });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) await Sharing.shareAsync(fileUri);
      } catch (e) { Alert.alert("Erro", "Falha ao abrir no iOS."); }
    }
  };

  const novos = conteudos.filter(c => !viewedIds.includes(c.id));
  const concluidos = conteudos.filter(c => viewedIds.includes(c.id)).sort((a, b) => a.titulo.localeCompare(b.titulo));
  
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
        <Ionicons name="folder-open" size={28} color="#4169E1" />
        <Text style={styles.title}>Arquivos & Links</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor="#FFD700" />}>
        
        {novos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={24} color="#FFD700" />
              <Text style={styles.sectionTitle}>Novos Conteúdos</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Acesse para concluir e organizar.</Text>
            
            {novos.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.card, styles.cardNovo]} onPress={() => item.tipo === 'LINK' ? abrirLink(item) : abrirMaterial(item)}>
                <View style={styles.badgeNovo}><Text style={styles.badgeNovoText}>NOVO</Text></View>
                <View style={[styles.cardIcon, { backgroundColor: item.tipo === 'LINK' ? '#32CD3220' : '#FFD70020' }]}>
                  <Ionicons name={item.tipo === 'LINK' ? 'link' : 'document'} size={24} color={item.tipo === 'LINK' ? '#32CD32' : '#FFD700'} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.titulo}</Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>{item.descricao || (item.tipo === 'LINK' ? item.urlVideo : 'Toque para baixar')}</Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={28} color="#FFD700" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {Object.keys(pastasAgrupadas).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="library" size={24} color="#888" />
              <Text style={[styles.sectionTitle, { color: '#888' }]}>Seu Arquivo</Text>
            </View>
            
            {Object.entries(pastasAgrupadas).sort().map(([nomePasta, itens]) => (
              <View key={nomePasta} style={styles.pastaContainer}>
                <View style={styles.pastaHeader}>
                  <Ionicons name="folder" size={20} color="#4169E1" />
                  <Text style={styles.pastaTitle}>{nomePasta}</Text>
                </View>
                
                {itens.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.cardPastas} onPress={() => item.tipo === 'LINK' ? abrirLink(item) : abrirMaterial(item)}>
                    <Ionicons name={item.tipo === 'LINK' ? 'link' : 'document-text'} size={20} color="#666" style={{marginRight: 12}} />
                    <View style={{flex: 1}}>
                      <Text style={styles.cardPastasTitle}>{item.titulo}</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}

        {conteudos.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhum material postado ainda.</Text>
          </View>
        )}
      </ScrollView>

      {toast.visible && (
        <View style={styles.toastContainer}>
          <Ionicons name="checkmark-circle" size={28} color="#32CD32" />
          <View>
            <Text style={styles.toastTitle}>Sucesso!</Text>
            <Text style={styles.toastText}>{toast.msg}</Text>
          </View>
        </View>
      )}
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
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 12, marginBottom: 12, overflow: 'hidden' },
  cardNovo: { borderColor: '#FFD70050', borderWidth: 1 },
  badgeNovo: { position: 'absolute', top: 0, right: 0, backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 2, borderBottomLeftRadius: 12 },
  badgeNovoText: { fontSize: 9, fontWeight: 'bold', color: '#000' },
  cardIcon: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1, marginLeft: 12, marginRight: 10 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardDescription: { color: '#888', fontSize: 12, marginTop: 2 },
  
  pastaContainer: { backgroundColor: '#151520', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#222' },
  pastaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
  pastaTitle: { color: '#4169E1', fontSize: 15, fontWeight: 'bold', textTransform: 'uppercase' },
  cardPastas: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  cardPastasTitle: { color: '#bbb', fontSize: 14 },
  
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', fontSize: 14, marginTop: 16 },

  toastContainer: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: '#1a1a2e', borderColor: '#32CD32', borderWidth: 1, padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', elevation: 5, gap: 12 },
  toastTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  toastText: { color: '#aaa', fontSize: 13, marginTop: 2 }
});
