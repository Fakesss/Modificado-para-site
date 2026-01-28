import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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

// Auth
export const login = async (email: string, senha: string) => {
  const response = await api.post('/auth/login', { email, senha });
  return response.data;
};

export const register = async (nome: string, email: string, senha: string, turmaId?: string, equipeId?: string) => {
  const response = await api.post('/auth/register', { nome, email, senha, turmaId, equipeId });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// Turmas
export const getTurmas = async () => {
  const response = await api.get('/turmas');
  return response.data;
};

// Equipes
export const getEquipes = async () => {
  const response = await api.get('/equipes');
  return response.data;
};

// Ranking
export const getRankingGeral = async () => {
  const response = await api.get('/ranking/geral');
  return response.data;
};

export const getRankingPorTurma = async (turmaId: string) => {
  const response = await api.get(`/ranking/turma/${turmaId}`);
  return response.data;
};

export const getRankingAlunosEquipe = async (equipeId: string) => {
  const response = await api.get(`/ranking/alunos/${equipeId}`);
  return response.data;
};

// Conteudos
export const getConteudos = async (categoria?: string) => {
  const params = categoria ? { categoria } : {};
  const response = await api.get('/conteudos', { params });
  return response.data;
};

export const createConteudo = async (data: any) => {
  const response = await api.post('/conteudos', data);
  return response.data;
};

export const updateConteudo = async (id: string, data: any) => {
  const response = await api.put(`/conteudos/${id}`, data);
  return response.data;
};

export const deleteConteudo = async (id: string) => {
  const response = await api.delete(`/conteudos/${id}`);
  return response.data;
};

// Video Progress
export const updateProgressoVideo = async (conteudoId: string, tempoAssistidoSeg: number, duracaoSeg: number) => {
  const response = await api.post('/progresso-video', { conteudoId, tempoAssistidoSeg, duracaoSeg });
  return response.data;
};

export const getProgressoVideo = async (conteudoId: string) => {
  const response = await api.get(`/progresso-video/${conteudoId}`);
  return response.data;
};

// My Progress
export const getMeuProgresso = async () => {
  const response = await api.get('/meu-progresso');
  return response.data;
};

// Exercicios
export const getExercicios = async () => {
  const response = await api.get('/exercicios');
  return response.data;
};

export const getExercicio = async (id: string) => {
  const response = await api.get(`/exercicios/${id}`);
  return response.data;
};

export const createExercicio = async (data: any) => {
  const response = await api.post('/exercicios', data);
  return response.data;
};

export const updateExercicio = async (id: string, data: any) => {
  const response = await api.put(`/exercicios/${id}`, data);
  return response.data;
};

export const deleteExercicio = async (id: string) => {
  const response = await api.delete(`/exercicios/${id}`);
  return response.data;
};

// Submissoes
export const submitExercicio = async (exercicioId: string, respostas: { questaoId: string; resposta: string }[]) => {
  const response = await api.post('/submissoes', { exercicioId, respostas });
  return response.data;
};

export const getSubmissao = async (exercicioId: string) => {
  const response = await api.get(`/submissoes/${exercicioId}`);
  return response.data;
};

// BNCC Reports
export const getBNCCErros = async (turmaId?: string, equipeId?: string) => {
  const params: any = {};
  if (turmaId) params.turmaId = turmaId;
  if (equipeId) params.equipeId = equipeId;
  const response = await api.get('/relatorios/bncc-erros', { params });
  return response.data;
};

export const getAlunoBNCC = async (alunoId: string) => {
  const response = await api.get(`/relatorios/aluno/${alunoId}/bncc`);
  return response.data;
};

// Admin - Users
export const getUsuarios = async () => {
  const response = await api.get('/usuarios');
  return response.data;
};

export const getUsuario = async (id: string) => {
  const response = await api.get(`/usuarios/${id}`);
  return response.data;
};

export const updateUsuario = async (id: string, data: any) => {
  const response = await api.put(`/usuarios/${id}`, data);
  return response.data;
};

export const deleteUsuario = async (id: string) => {
  const response = await api.delete(`/usuarios/${id}`);
  return response.data;
};

// Self update (for updating own turma/equipe)
export const updateUsuarioSelf = async (data: any) => {
  const response = await api.put('/auth/me', data);
  return response.data;
};

// Admin - Reports
export const getRelatorioGeral = async () => {
  const response = await api.get('/relatorios/geral');
  return response.data;
};

export const getRelatorioUsuarios = async () => {
  const response = await api.get('/relatorios/usuarios');
  return response.data;
};

// Abas
export const getAbas = async () => {
  const response = await api.get('/abas');
  return response.data;
};

export const createAba = async (data: any) => {
  const response = await api.post('/abas', data);
  return response.data;
};

export const updateAba = async (id: string, data: any) => {
  const response = await api.put(`/abas/${id}`, data);
  return response.data;
};

export const deleteAba = async (id: string) => {
  const response = await api.delete(`/abas/${id}`);
  return response.data;
};

// Questoes
export const createQuestao = async (data: any) => {
  const response = await api.post('/questoes', data);
  return response.data;
};

export const updateQuestao = async (id: string, data: any) => {
  const response = await api.put(`/questoes/${id}`, data);
  return response.data;
};

export const deleteQuestao = async (id: string) => {
  const response = await api.delete(`/questoes/${id}`);
  return response.data;
};

// Lixeira (Trash)
export const getLixeira = async () => {
  const response = await api.get('/admin/lixeira');
  return response.data;
};

export const restaurarItem = async (id: string, tipo: string) => {
  const response = await api.post(`/admin/lixeira/${id}/restaurar?tipo=${tipo}`);
  return response.data;
};

export const deletePermanente = async (id: string, tipo: string) => {
  const response = await api.delete(`/admin/lixeira/${id}?tipo=${tipo}`);
  return response.data;
};

export const limparItensExpirados = async () => {
  const response = await api.post('/admin/lixeira/limpar-expirados');
  return response.data;
};

export default api;
