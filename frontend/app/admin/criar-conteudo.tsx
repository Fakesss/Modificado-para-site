import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as api from '../../src/services/api';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

type TipoConteudo = 'VIDEO' | 'LINK' | 'MATERIAL';

export default function AdminCriarConteudo() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoConteudo>('VIDEO');
  const [url, setUrl] = useState(''); 
  const [pontos, setPontos] = useState('0');
  
  // NOVOS ESTADOS: PASTA E THUMBNAIL
  const [pasta, setPasta] = useState('');
  const [pastasExistentes, setPastasExistentes] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState('');
  
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [arquivoBase64, setArquivoBase64] = useState<string | null>(null);

  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const ts = await api.getTurmas();
      setTurmas(ts || []);

      const ps = await api.getPastas();
      setPastasExistentes(ps || []);

      if (isEditing) {
        const todosConteudos = await api.getConteudos();
        const conteudoEdit = todosConteudos.find((c: any) => c.id === id);
        
        if (conteudoEdit) {
          setTitulo(conteudoEdit.titulo);
          setDescricao(conteudoEdit.descricao || '');
          setTipo(conteudoEdit.tipo as TipoConteudo);
          setUrl(conteudoEdit.urlVideo || '');
          setTurmaId(conteudoEdit.turmaId || '');
          setPontos(conteudoEdit.pontos ? String(conteudoEdit.pontos) : '0');
          setPasta(conteudoEdit.pasta || '');
          setThumbnail(conteudoEdit.thumbnail || '');
          
          if (conteudoEdit.tipo === 'MATERIAL') {
             setNomeArquivo("Arquivo já salvo (Envie outro para substituir)");
          }
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];

        if (file.size && file.size > 4 * 1024 * 1024) {
          return Alert.alert("Erro", "O arquivo é muito grande. O limite máximo é 4MB.");
        }

        setNomeArquivo(file.name);

        if (Platform.OS === 'web' && file.file) {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') setArquivoBase64(reader.result.split(',')[1]);
          };
          reader.readAsDataURL(file.file);
        } else {
          const response = await fetch(file.uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') setArquivoBase64(reader.result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        }
      }
    } catch (error) { Alert.alert("Erro", "Não foi possível selecionar o arquivo."); }
  };

  const handleSave = async () => {
    if (!titulo.trim()) return Alert.alert("Erro", "Título é obrigatório.");
    if (tipo !== 'MATERIAL' && !url.trim()) return Alert.alert("Erro", "Link/URL é obrigatório.");
    if (tipo === 'MATERIAL' && !isEditing && !arquivoBase64) return Alert.alert("Erro", "Selecione um arquivo.");

    setLoading(true);
    try {
      // INTELIGÊNCIA: Puxar a capa do YouTube automaticamente se o usuário não digitar nada!
      let finalThumbnail = thumbnail.trim();
      if (tipo === 'VIDEO' && !finalThumbnail && url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ \s]{11})/;
        const match = url.match(regex);
        if (match && match[1]) {
          finalThumbnail = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
        }
      }

      const payload: any = {
        titulo,
        descricao,
        tipo,
        turmaId: turmaId || null,
        urlVideo: (tipo === 'VIDEO' || tipo === 'LINK') ? url : null,
        abaCategoria: tipo === 'VIDEO' ? 'videos' : 'materiais',
        pontos: parseInt(pontos) || 0,
        pasta: pasta.trim() || null,
        thumbnail: finalThumbnail || null,
      };

      if (arquivoBase64) payload.arquivo = arquivoBase64;

      if (isEditing && id) {
        await api.updateConteudo(id as string, payload);
      } else {
        await api.createConteudo(payload);
      }
      
      Alert.alert("Sucesso", "Conteúdo salvo!", [{ text: "OK", onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert("Erro", "Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={cores.dourado} />
          <Text style={{color: cores.texto, marginTop:10}}>{isEditing ? "Atualizando..." : "Salvando..."}</Text>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color={cores.texto} /></TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? "Editar Conteúdo" : "Novo Conteúdo"}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loadingData}><Ionicons name="checkmark" size={28} color={cores.dourado} /></TouchableOpacity>
      </View>

      {loadingData ? (
        <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
          <ActivityIndicator size="large" color={cores.dourado} />
        </View>
      ) : (
        <ScrollView style={{padding: 16}}>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.tabContainer}>
            {(['VIDEO', 'LINK', 'MATERIAL'] as TipoConteudo[]).map(t => (
              <TouchableOpacity key={t} style={[styles.tab, tipo === t && styles.tabActive]} onPress={() => setTipo(t)}>
                <Text style={{color: tipo === t ? cores.sobreAcento : cores.texto, fontWeight:'bold'}}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Título</Text>
          <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholderTextColor={cores.textoFraco} />

          <Text style={styles.label}>Descrição</Text>
          <TextInput style={[styles.input, {height:60}]} multiline value={descricao} onChangeText={setDescricao} placeholderTextColor={cores.textoFraco} />

          {/* SESSÃO DE PASTA */}
          <Text style={styles.label}>Pasta / Organização (Opcional)</Text>
          <TextInput 
            style={styles.input} 
            value={pasta} 
            onChangeText={setPasta} 
            placeholder="Ex: Módulo 1, Apostilas..." 
            placeholderTextColor={cores.textoFraco} 
          />
          {pastasExistentes.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
              {pastasExistentes.map(p => (
                <TouchableOpacity key={p} style={styles.chipPasta} onPress={() => setPasta(p)}>
                  <Ionicons name="folder" size={14} color={cores.textoFraco} style={{marginRight: 4}}/>
                  <Text style={{color: cores.textoFraco, fontSize: 12}}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {tipo === 'VIDEO' && (
            <>
              <Text style={styles.label}>Link do YouTube</Text>
              <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholderTextColor={cores.textoFraco} />
              
              <Text style={styles.label}>Capa do Vídeo / Thumbnail (Opcional)</Text>
              <TextInput style={styles.input} value={thumbnail} onChangeText={setThumbnail} placeholder="Deixe em branco para capa automática" placeholderTextColor={cores.textoFraco} />

              <Text style={styles.label}>Pontos de Recompensa (Opcional)</Text>
              <TextInput style={styles.input} value={pontos} onChangeText={setPontos} keyboardType="numeric" placeholder="Ex: 50" placeholderTextColor={cores.textoFraco} />
            </>
          )}

          {tipo === 'LINK' && (
            <>
              <Text style={styles.label}>URL do Link</Text>
              <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholderTextColor={cores.textoFraco} />
              <Text style={styles.label}>Imagem de Capa (Opcional)</Text>
              <TextInput style={styles.input} value={thumbnail} onChangeText={setThumbnail} placeholder="URL de uma imagem na web" placeholderTextColor={cores.textoFraco} />
            </>
          )}

          {tipo === 'MATERIAL' && (
            <View style={{marginBottom: 20}}>
              <Text style={styles.label}>Arquivo (PDF, Doc, Imagem)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
                <Ionicons name="cloud-upload-outline" size={24} color={cores.sobreAcento} />
                <Text style={styles.uploadText} numberOfLines={1}>{nomeArquivo || "Selecionar Arquivo"}</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Disponível Para</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 40}}>
            <TouchableOpacity onPress={() => setTurmaId('')} style={[styles.chip, !turmaId && styles.chipActive]}>
              <Text style={{color: !turmaId ? cores.sobreAcento : cores.texto}}>Geral (Todos)</Text>
            </TouchableOpacity>
            {turmas.map((t: any) => (
              <TouchableOpacity key={t.id} onPress={() => setTurmaId(t.id)} style={[styles.chip, turmaId === t.id && styles.chipActive]}>
                <Text style={{color: turmaId === t.id ? cores.sobreAcento : cores.texto}}>{t.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: cores.superficieAlt, borderBottomWidth:1, borderBottomColor:cores.superficieAlt },
  headerTitle: { color: cores.texto, fontSize: 18, fontWeight: 'bold' },
  label: { color: cores.textoFraco, fontSize: 11, marginTop: 15, marginBottom: 5, textTransform: 'uppercase', letterSpacing:1 },
  input: { backgroundColor: cores.superficie, color: cores.texto, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: cores.borda, fontSize:16 },
  tabContainer: { flexDirection: 'row', backgroundColor:cores.superficie, borderRadius:8, padding:4, marginBottom:10 },
  tab: { flex:1, paddingVertical:10, alignItems:'center', borderRadius:6 },
  tabActive: { backgroundColor:cores.dourado },
  uploadButton: { flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:cores.dourado, padding:15, borderRadius:10, gap:10 },
  uploadText: { color: cores.sobreAcento, fontWeight:'bold', fontSize:16, flexShrink: 1 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, marginRight: 8 },
  chipActive: { backgroundColor: cores.dourado, borderColor: cores.dourado },
  chipPasta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: cores.superficieAlt, marginRight: 8 },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
});
