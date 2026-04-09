import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_URL = 'https://modificado-para-site-1.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const isNetworkOrServerError = !error.response || error.response?.status >= 500;

    if (isNetworkOrServerError && !originalRequest._retry) {
      originalRequest._retry = true; 
      console.log('📡 Detectada queda. Aguardando estabilização...');
      const tempoEspera = Platform.OS === 'web' ? 3000 : 100;
      await new Promise((resolve) => setTimeout(resolve, tempoEspera));
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

// AUTENTICAÇÃO E USUÁRIOS
export const login = async (email: string, senha: string) => {
  try {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 404) throw new Error('Dados incorretos.');
    throw new Error('Erro de conexão.');
  }
};
export const register = async (nome: string, email: string, senha: string, turmaId?: string, equipeId?: string) => {
  try {
    const response = await api.post('/auth/register', { nome, email, senha, turmaId, equipeId });
    return response.data;
  } catch (error: any) { throw new Error('Erro ao criar conta.'); }
};
export const getMe = async () => { try { return (await api.get('/auth/me')).data; } catch { return null; } };

export const getUsuarios = async () => { try { return (await api.get('/usuarios')).data; } catch { return []; } };
export const updateUsuario = async (id: string, d: any) => (await api.put(`/usuarios/${id}`, d)).data;
export const deleteUsuario = async (id: string) => (await api.delete(`/usuarios/${id}`)).data;

// TURMAS E EQUIPES
export const getTurmas = async () => { try { return (await api.get('/turmas')).data; } catch { return []; } };
export const createTurma = async (nome: string) => (await api.post('/turmas', { nome })).data;
export const deleteTurma = async (id: string) => (await api.delete(`/turmas/${id}`)).data;
export const getEquipes = async () => { try { return (await api.get('/equipes')).data; } catch { return []; } };
export const createEquipe = async (nome: string, cor: string) => (await api.post('/equipes', { nome, cor })).data;

export const updateEquipe = async (id: string, d: any) => (await api.put(`/equipes/${id}`, d)).data;
export const deleteEquipe = async (id: string) => (await api.delete(`/equipes/${id}`)).data;

// CONTEÚDOS E PASTAS
export const getConteudos = async (cat?: string) => { const r = await api.get('/conteudos', { params: { categoria: cat } }); return r.data; };
export const getPastas = async (turmaId?: string) => { try { return (await api.get('/pastas', { params: { turmaId } })).data; } catch { return []; } };
export const createConteudo = async (d: any) => (await api.post('/conteudos', d)).data;
export const updateConteudo = async (id: string, d: any) => (await api.put(`/conteudos/${id}`, d)).data;
export const deleteConteudo = async (id: string) => (await api.delete(`/conteudos/${id}`)).data;
export const concluirConteudo = async (id: string) => (await api.post(`/conteudos/${id}/concluir`)).data;

// EXERCÍCIOS
export const getExercicios = async () => { const r = await api.get('/exercicios'); return r.data; };
export const getExercicio = async (id: string) => {
  try {
    const r = await api.get(`/exercicios/${id}`);
    return r.data;
  } catch (error) { return null; }
};
export const createExercicio = async (d: any) => (await api.post('/exercicios', d)).data;
export const updateExercicio = async (id: string, d: any) => (await api.put(`/exercicios/${id}`, d)).data;
export const deleteExercicio = async (id: string) => (await api.delete(`/exercicios/${id}`)).data;

export const submitExercicio = async (id: string, resp: any) => (await api.post('/submissoes', { exercicioId: id, respostas: resp })).data;
export const getSubmissao = async (id: string) => (await api.get(`/submissoes/${id}`)).data;
export const retryExercicio = async (id: string) => (await api.delete(`/submissoes/${id}/retry`)).data;

// JOGOS PERSONALIZADOS E MISSÕES
export const getJogosPersonalizados = async () => { try { return (await api.get('/missoes')).data; } catch { return []; } };
export const criarJogo = async (d: any) => (await api.post('/missoes', d)).data;
export const deletarJogo = async (id: string) => (await api.delete(`/missoes/${id}`)).data;
export const getMissoesDisponiveis = async () => { try { return (await api.get('/missoes/disponiveis')).data; } catch { return []; } };
export const concluirMissao = async (id: string) => (await api.post(`/missoes/${id}/concluir`)).data;
export const reenviarJogo = async (id: string, d: any) => (await api.post(`/missoes/${id}/reenviar`, d)).data;
export const registrarTentativaMissao = async (id: string) => (await api.post(`/missoes/${id}/tentativa`)).data;

// OUTROS E RANKING GERAL
export const getRelatorioGeral = async () => { try { return (await api.get('/relatorios/geral')).data; } catch { return {}; } };
export const getLixeira = async () => (await api.get('/admin/lixeira')).data;
export const restaurarItem = async (id: string, tipo: string) => (await api.post(`/admin/lixeira/${id}/restaurar?tipo=${tipo}`)).data;
export const deletePermanente = async (id: string, tipo: string) => (await api.delete(`/admin/lixeira/${id}?tipo=${tipo}`)).data;
export const getRankingGeral = async () => { try { return (await api.get('/ranking/geral')).data; } catch { return []; } };
export const getRankingPorTurma = async (turmaId: string) => { try { return (await api.get(`/ranking/turma/${turmaId}`)).data; } catch { return []; } };
export const getMeuProgresso = async () => { try { return (await api.get('/usuarios/progresso')).data; } catch { return null; } };
export const zerarTodosPontos = async () => (await api.post('/usuarios/zerar-pontos')).data;

// ======== ROTAS DO RANKING ARCADE ========
export const getRankingArcade = async () => { try { return (await api.get('/ranking/arcade')).data; } catch { return []; } };
export const submitArcadeScore = async (pontos: number) => (await api.post('/arcade/score', { pontos })).data;

// ======== ROTAS DE RELATÓRIO DA BNCC ========
export const getBNCCRelatorio = async (tipo: string, turmaId?: string, equipeId?: string) => {
  try {
    const params: any = { filtro_tipo: tipo };
    if (turmaId) params.turma_id = turmaId;
    if (equipeId) params.equipe_id = equipeId;
    return (await api.get('/relatorios/bncc', { params })).data;
  } catch {
    return [];
  }
};

export const limparRelatorioBNCC = async (tipo: string, alvoId?: string) => {
  return (await api.post('/relatorios/bncc/limpar', { tipo, alvoId })).data;
};

export default api;
