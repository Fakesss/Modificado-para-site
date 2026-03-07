import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Alteramos a linha abaixo para o seu novo endereço do Render
const API_URL = 'https://modificado-para-site-1.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==============================================================================
// 1. AUTENTICAÇÃO E DADOS BÁSICOS (Servidor)
// ==============================================================================

export const login = async (email: string, senha: string) => {
  try {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 404 || error.response?.status === 400) {
      throw new Error('E-mail ou senha incorretos.');
    }
    throw new Error(error.response?.data?.detail || 'Erro de conexão.');
  }
};

export const register = async (nome: string, email: string, senha: string, turmaId?: string, equipeId?: string) => {
  try {
    const response = await api.post('/auth/register', { nome, email, senha, turmaId, equipeId });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Erro ao criar conta.');
  }
};

export const getMe = async () => {
  try { const response = await api.get('/auth/me'); return response.data; } catch (e) { return null; }
};

export const getTurmas = async () => {
  try { const response = await api.get('/turmas'); return response.data; } catch (error) { return []; }
};

export const getUsuarios = async () => {
  try { const response = await api.get('/usuarios'); return response.data; } catch (error) { return []; }
};

// ==============================================================================
// 2. CONFIGURAÇÕES GERAIS (LOCAL - Vidas Padrão do Arcade)
// ==============================================================================
const CONFIG_KEY = '@config_jogo_v1';

export const salvarConfiguracaoJogo = async (vidas: number) => {
  try {
    const config = { vidasPadrao: vidas };
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) { return false; }
};

export const getConfiguracaoJogo = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(CONFIG_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : { vidasPadrao: 5 }; // Padrão 5 se não tiver nada salvo
  } catch(e) {
    return { vidasPadrao: 5 };
  }
};

// ==============================================================================
// 3. JOGOS PERSONALIZADOS & MISSÕES (LOCAL)
// ==============================================================================
const JOGOS_KEY = '@jogos_v2';
const CONCLUIDOS_KEY = '@jogos_concluidos_ids';

// Busca jogos criados (Admin)
export const getJogosPersonalizados = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(JOGOS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch(e) { return []; }
};

// Cria jogo novo (Com vidas e pontos personalizados)
export const criarJogo = async (dados: any) => {
  try {
    const existing = await getJogosPersonalizados();
    const novoJogo = { ...dados, id: Math.random().toString(36).substr(2, 9) };
    const novaLista = [novoJogo, ...existing];
    await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify(novaLista));
    return novoJogo;
  } catch (e) { throw new Error('Erro ao salvar localmente'); }
};

// Deleta jogo
export const deletarJogo = async (id: string) => {
  try {
    const existing = await getJogosPersonalizados();
    const novaLista = existing.filter((j: any) => j.id !== id);
    await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify(novaLista));
    return true;
  } catch (e) { return false; }
};

// Busca missões para o ALUNO (Esconde as que ele já venceu)
export const getMissoesDisponiveis = async () => {
  try {
    const todas = await getJogosPersonalizados();
    const concluidosJson = await AsyncStorage.getItem(CONCLUIDOS_KEY);
    const concluidos = concluidosJson ? JSON.parse(concluidosJson) : [];
    
    // Retorna só o que NÃO foi concluído
    return todas.filter((m: any) => !concluidos.includes(m.id));
  } catch (error) { return []; }
};

// Marca como vencida (Salva o ID da missão)
export const concluirMissao = async (id: string) => {
  try {
    const concluidosJson = await AsyncStorage.getItem(CONCLUIDOS_KEY);
    const concluidos = concluidosJson ? JSON.parse(concluidosJson) : [];
    
    if (!concluidos.includes(id)) {
      concluidos.push(id);
      await AsyncStorage.setItem(CONCLUIDOS_KEY, JSON.stringify(concluidos));
    }
    return true;
  } catch (error) { return false; }
};

// Export padrão para compatibilidade
export default api;
