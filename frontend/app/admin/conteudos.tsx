import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as api from '../../src/services/api';

type TipoConteudo = 'VIDEO' | 'LINK' | 'MATERIAL';
type ViewMode = 'LIST' | 'FORM';

export default function AdminConteudos() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [conteudos, setConteudos] = useState<any[]>([]);
  
  // Estado do Formulário
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoConteudo>('VIDEO');
  const [url, setUrl] = useState(''); 
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [arquivoBase64, setArquivoBase64] = useState<string | null>(null);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [turmaId, setTurmaId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contData, turmasData] = await Promise.all([
        api.getConteudos(),
        api.getTurmas()
      ]);
      setConteudos(contData || []);
      setTurmas(turmasData || []);
    } catch (e) {
      console.log('Erro ao carregar dados', e);
    } finally {
      setLoading(false);
    }
  };

  const startCreating = () => {
    setEditingId(null);
    setTitulo('');
    setDescricao('');
    setTipo('VIDEO');
    setUrl('');
    setNomeArquivo('');
    setArquivoBase64(null);
    setTurmaId('');
    setViewMode('FORM');
  };

  const startEditing = (item: any) => {
    setEditingId(item.id);
    setTitulo(item.titulo);
    setDescricao(item.descricao || '');
    setTipo(item.tipo);
    setUrl(item.urlVideo || '');
    setTurmaId(item.turmaId || '');
    // Arquivo não carregamos de volta o base64 para economizar memória, 
    // só mostramos se já existe
    setNomeArquivo(item.arquivo ? 'Arquivo Atual (Mantenha ou troque)' : '');
    setArquivoBase64(null); // Só muda se o usuário selecionar outro
    setViewMode('FORM');
  };

  const handleDelete = (id: string) => {
    Alert.alert("Excluir", "Tem certeza?", [
      { text: "Cancelar" },
      { text: "Sim", style: 'destructive', onPress: async () => {
          try {
            await api.deleteConteudo(id);
            loadData();
          } catch(e) { Alert.alert("Erro", "Não foi possível excluir"); }
      }}
    ]);
  };

  const handlePickDocument = async () => {
    if (Platform.OS === 'web') {
      // WEB: Usa input nativo do navegador (Funciona no Vercel)
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*'; // Aceita tudo
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          // Validação de tamanho simples (limite 4MB para evitar travar Vercel free tier)
          if (file.size > 4 * 1024 * 1024) {
            Alert.alert("Erro", "Arquivo muito grande (Máx 4MB na versão Web).");
            return;
          }
          
          setNomeArquivo(file.name);
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              const base64String = reader.result.split(',')[1];
              setArquivoBase64(base64String);
              Alert.alert("Sucesso", "Arquivo carregado!");
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // MOBILE: Usa Expo Document Picker
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
        if (result.canceled) return;
        
        const file = result.assets[0];
        setNomeArquivo(file.name);
        // No mobile precisa ler o arquivo do cache para converter em Base64
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
        setArquivoBase64(base64);
      } catch (err) {
        Alert.alert("Erro", "Falha ao selecionar arquivo no celular.");
      }
    }
  };

  const handleSave = async () => {
    if (!titulo.trim()) return Alert.alert("Erro", "Título é obrigatório.");
    if (tipo !== 'MATERIAL' && !url.trim()) return Alert.alert("Erro", "Link/URL é obrigatório.");
    // Se for material novo, precisa de arquivo. Se for edição, pode manter o antigo (arquivoBase64 null)
    if (tipo === 'MATERIAL' && !arquivoBase64 && !editingId) return Alert.alert("Erro", "Selecione um arquivo.");

    setLoading(true);
    try {
      const payload: any = {
        titulo,
        descricao,
        tipo,
        turmaId: turmaId || null,
        urlVideo: (tipo === 'VIDEO' || tipo === 'LINK') ? url : null,
        abaCategoria: tipo === 'VIDEO' ? 'videos' : 'materiais',
      };

      // Só envia arquivo se houver um novo selecionado
      if (arquivoBase64) {
        payload.arquivo = arquivoBase64;
      }

      if (editingId) {
        // Atualizar
        if (api.updateConteudo) {
            await api.updateConteudo(editingId, payload);
        } else {
            throw new Error("Função de atualização não encontrada no API.");
        }
      } else {
        // Criar
        await api.createConteudo(payload);
      }
      
      Alert.alert("Sucesso", "Conteúdo salvo!", [
        { text: "OK", onPress: () => {
            setViewMode('LIST');
            loadData();
        }}
      ]);

    } catch (error: any) {
      console.log(error);
      Alert.alert("Erro ao Salvar", "Verifique sua conexão ou o tamanho do arquivo.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZAÇÃO ---

  if (viewMode === 'LIST') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Gerenciar Conteúdos</Text>
          <TouchableOpacity onPress={startCreating}><Ionicons name="add-circle" size={32} color="#FFD700" /></TouchableOpacity>
        </View>

        <ScrollView style={{padding: 16}}>
          {loading ? <ActivityIndicator color="#FFD700" /> : conteudos.length === 0 ? (
            <Text style={{color:'#666', textAlign:'center', marginTop:20}}>Nenhum conteúdo cadastrado.</Text>
          ) : (
            conteudos.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={{flex:1}}>
                  <Text style={styles.cardTitle}>{item.titulo}</Text>
                  <View style={{flexDirection:'row', gap:10, marginTop:4}}>
                    <Text style={[styles.badge, {color: item.tipo==='VIDEO'?'#4169E1':item.tipo==='LINK'?'#32CD32':'#FFD700'}]}>{item.tipo}</Text>
                    {item.turmaId ? <Text style={styles.badgeTurma}>Turma Específica</Text> : <Text style={styles.badgeTurma}>Geral</Text>}
                  </View>
                </View>
                <View style={{flexDirection:'row', gap:15}}>
                  <TouchableOpacity onPress={() => startEditing(item)}>
                    <Ionicons name="pencil" size={20} color="#FFD700" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash" size={20} color="#E74C3C" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- MODO FORMULÁRIO ---
  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={{color:'#fff', marginTop:10}}>Salvando...</Text>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setViewMode('LIST')}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{editingId ? "Editar Conteúdo" : "Novo Conteúdo"}</Text>
        <TouchableOpacity onPress={handleSave}><Ionicons name="checkmark" size={28} color="#FFD700" /></TouchableOpacity>
      </View>

      <ScrollView style={{padding: 16}}>
        
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.tabContainer}>
          {(['VIDEO', 'LINK', 'MATERIAL'] as TipoConteudo[]).map(t => (
            <TouchableOpacity key={t} style={[styles.tab, tipo === t && styles.tabActive]} onPress={() => setTipo(t)}>
              <Text style={{color: tipo === t ? '#000' : '#fff', fontWeight:'bold'}}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Título</Text>
        <TextInput style={styles.input} value={titulo} onChangeText={setTitulo} placeholder="Título do conteúdo" placeholderTextColor="#666" />

        <Text style={styles.label}>Descrição</Text>
        <TextInput style={[styles.input, {height:60}]} multiline value={descricao} onChangeText={setDescricao} placeholder="Opcional" placeholderTextColor="#666" />

        {tipo !== 'MATERIAL' ? (
          <>
            <Text style={styles.label}>{tipo === 'VIDEO' ? 'Link do YouTube' : 'URL do Link'}</Text>
            <TextInput style={styles.input} value={url} onChangeText={setUrl} placeholder="https://..." placeholderTextColor="#666" />
          </>
        ) : (
          <View style={{marginBottom: 20}}>
            <Text style={styles.label}>Arquivo (PDF, Doc, Imagem)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
              <Ionicons name="cloud-upload-outline" size={24} color="#000" />
              <Text style={styles.uploadText}>{nomeArquivo || "Selecionar Arquivo"}</Text>
            </TouchableOpacity>
            <Text style={{color:'#666', fontSize:12, marginTop:5}}>* Limite recomendado: 4MB (Web)</Text>
          </View>
        )}

        <Text style={styles.label}>Disponível Para</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 20}}>
          <TouchableOpacity onPress={() => setTurmaId('')} style={[styles.chip, !turmaId && styles.chipActive]}>
            <Text style={{color: !turmaId ? '#000' : '#fff'}}>Geral (Todos)</Text>
          </TouchableOpacity>
          {turmas.map((t: any) => (
            <TouchableOpacity key={t.id} onPress={() => setTurmaId(t.id)} 
              style={[styles.chip, turmaId === t.id && styles.chipActive]}>
              <Text style={{color: turmaId === t.id ? '#000' : '#fff'}}>{t.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center', backgroundColor: '#151520', borderBottomWidth:1, borderBottomColor:'#222' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  label: { color: '#888', fontSize: 11, marginTop: 15, marginBottom: 5, textTransform: 'uppercase', letterSpacing:1 },
  input: { backgroundColor: '#1a1a2e', color: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#333', fontSize:16 },
  tabContainer: { flexDirection: 'row', backgroundColor:'#1a1a2e', borderRadius:8, padding:4, marginBottom:10 },
  tab: { flex:1, paddingVertical:10, alignItems:'center', borderRadius:6 },
  tabActive: { backgroundColor:'#FFD700' },
  uploadButton: { flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:'#FFD700', padding:15, borderRadius:10, gap:10 },
  uploadText: { color:'#000', fontWeight:'bold', fontSize:16 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333', marginRight: 8 },
  chipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#1a1a2e', padding:16, marginBottom:10, borderRadius:12 },
  cardTitle: { color:'#fff', fontWeight:'bold', fontSize:16 },
  badge: { fontSize:10, fontWeight:'bold', marginRight:10 },
  badgeTurma: { fontSize:10, color:'#888' }
});
