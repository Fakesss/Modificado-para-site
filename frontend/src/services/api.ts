import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SEU ENDEREÇO DO RENDER
const API_URL = 'https://modificado-para-site-1.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

// Adiciona o token em todas as requisições
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==============================================================================
// 1. AUTENTICAÇÃO E USUÁRIOS (Isso continua indo para o Servidor)
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
  const response = await api.get('/auth/me');
  return response.data;
};

// ==============================================================================
// 2. DADOS GERAIS (Turmas, Equipes, Ranking - Vai para o Servidor)
// ==============================================================================

export const getTurmas = async () => {
  try {
    const response = await api.get('/turmas');
    return response.data;
  } catch (error) { return []; }
};

export const getEquipes = async () => {
  try {
    const response = await api.get('/equipes');
    return response.data;
  } catch (error) { return []; }
};

export const getUsuarios = async () => {
  try {
    const response = await api.get('/usuarios');
    return response.data;
  } catch (error) { return []; }
};

export const updateEquipe = async (id: string, dados: any) => {
  const response = await api.put(`/equipes/${id}`, dados);
  return response.data;
};

// Ranking
export const getRankingGeral = async () => { try { const r = await api.get('/ranking/geral'); return r.data; } catch (e) { return []; } };
export const getRankingPorTurma = async (id: string) => { try { const r = await api.get(`/ranking/turma/${id}`); return r.data; } catch (e) { return []; } };
export const getRankingAlunosEquipe = async (id: string) => { try { const r = await api.get(`/ranking/alunos/${id}`); return r.data; } catch (e) { return []; } };

// Conteúdos e Exercícios
export const getConteudos = async (cat?: string) => { const r = await api.get('/conteudos', { params: { categoria: cat } }); return r.data; };
export const createConteudo = async (d: any) => (await api.post('/conteudos', d)).data;
export const deleteConteudo = async (id: string) => (await api.delete(`/conteudos/${id}`)).data;

export const getExercicios = async () => { const r = await api.get('/exercicios'); return r.data; };
export const createExercicio = async (d: any) => (await api.post('/exercicios', d)).data;
export const deleteExercicio = async (id: string) => (await api.delete(`/exercicios/${id}`)).data;

export const submitExercicio = async (id: string, resp: any) => (await api.post('/submissoes', { exercicioId: id, respostas: resp })).data;
export const getSubmissao = async (id: string) => (await api.get(`/submissoes/${id}`)).data;

// Relatórios
export const getRelatorioGeral = async () => { try { const r = await api.get('/relatorios/geral'); return r.data; } catch (e) { return {}; } };
export const getBNCCErros = async () => { try { const r = await api.get('/relatorios/bncc-erros'); return r.data; } catch (e) { return []; } };

// Lixeira
export const getLixeira = async () => (await api.get('/admin/lixeira')).data;
export const restaurarItem = async (id: string, tipo: string) => (await api.post(`/admin/lixeira/${id}/restaurar?tipo=${tipo}`)).data;
export const deletePermanente = async (id: string, tipo: string) => (await api.delete(`/admin/lixeira/${id}?tipo=${tipo}`)).data;

// ==============================================================================
// 3. JOGOS PERSONALIZADOS (LOCAL - SALVA NA MEMÓRIA DO CELULAR)
// ==============================================================================
// Como não temos o backend pronto para isso, vamos usar o AsyncStorage
// para simular um banco de dados local. Assim o botão SALVAR vai funcionar!

const JOGOS_STORAGE_KEY = '@jogos_personalizados_v1';

// Busca jogos salvos na memória
export const getJogosPersonalizados = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(JOGOS_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch(e) {
    return [];
  }
};

// Salva um novo jogo na memória
export const criarJogo = async (dados: any) => {
  try {
    // 1. Pega os jogos antigos
    const existing = await getJogosPersonalizados();
    
    // 2. Adiciona o novo (com ID único)
    const novoJogo = { ...dados, id: Math.random().toString(36).substr(2, 9) };
    const novaLista = [novoJogo, ...existing]; // Adiciona no topo
    
    // 3. Salva de volta
    await AsyncStorage.setItem(JOGOS_STORAGE_KEY, JSON.stringify(novaLista));
    return novoJogo;
  } catch (e) {
    throw new Error('Erro ao salvar localmente');
  }
};

// Deleta da memória
export const deletarJogo = async (id: string) => {
  try {
    const existing = await getJogosPersonalizados();
    const novaLista = existing.filter((jogo: any) => jogo.id !== id);
    await AsyncStorage.setItem(JOGOS_STORAGE_KEY, JSON.stringify(novaLista));
    return true;
  } catch (e) {
    throw new Error('Erro ao deletar');
  }
};

// Para o aluno ver (Pega da memória também)
export const getMissoesDisponiveis = async () => {
  // Num cenário real, filtrariamos por turma aqui.
  // Como é local, retorna tudo que foi criado no admin.
  return await getJogosPersonalizados();
};

export default api;
