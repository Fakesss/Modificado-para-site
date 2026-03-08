import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SEU ENDEREÇO DO SERVIDOR
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

// ==============================================================================
// 1. AUTENTICAÇÃO E DADOS BÁSICOS
// ==============================================================================

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

// ==============================================================================
// 2. GERENCIAMENTO DE TURMAS E EQUIPES (Novo!)
// ==============================================================================

// TURMAS
export const getTurmas = async () => { try { return (await api.get('/turmas')).data; } catch { return []; } };

export const createTurma = async (nome: string) => {
  const response = await api.post('/turmas', { nome });
  return response.data;
};

export const deleteTurma = async (id: string) => {
  const response = await api.delete(`/turmas/${id}`);
  return response.data;
};

// EQUIPES
export const getEquipes = async () => { try { return (await api.get('/equipes')).data; } catch { return []; } };

export const createEquipe = async (nome: string, cor: string) => {
  const response = await api.post('/equipes', { nome, cor });
  return response.data;
};

export const updateEquipe = async (id: string, dados: any) => {
  const response = await api.put(`/equipes/${id}`, dados);
  return response.data;
};

export const deleteEquipe = async (id: string) => {
  const response = await api.delete(`/equipes/${id}`);
  return response.data;
};

// ==============================================================================
// 3. CONTEÚDOS, RANKING E RELATÓRIOS
// ==============================================================================

export const getRankingGeral = async () => { try { return (await api.get('/ranking/geral')).data; } catch { return []; } };
export const getRankingPorTurma = async (id: string) => { try { return (await api.get(`/ranking/turma/${id}`)).data; } catch { return []; } };
export const getRankingAlunosEquipe = async (id: string) => { try { return (await api.get(`/ranking/alunos/${id}`)).data; } catch { return []; } };

export const getConteudos = async (cat?: string) => { const r = await api.get('/conteudos', { params: { categoria: cat } }); return r.data; };
export const createConteudo = async (d: any) => (await api.post('/conteudos', d)).data;
export const deleteConteudo = async (id: string) => (await api.delete(`/conteudos/${id}`)).data;

export const getExercicios = async () => { const r = await api.get('/exercicios'); return r.data; };
export const createExercicio = async (d: any) => (await api.post('/exercicios', d)).data;
export const deleteExercicio = async (id: string) => (await api.delete(`/exercicios/${id}`)).data;

export const submitExercicio = async (id: string, resp: any) => (await api.post('/submissoes', { exercicioId: id, respostas: resp })).data;
export const getSubmissao = async (id: string) => (await api.get(`/submissoes/${id}`)).data;

export const getRelatorioGeral = async () => { try { return (await api.get('/relatorios/geral')).data; } catch { return {}; } };
export const getBNCCErros = async () => { try { return (await api.get('/relatorios/bncc-erros')).data; } catch { return []; } };

export const getLixeira = async () => (await api.get('/admin/lixeira')).data;
export const restaurarItem = async (id: string, tipo: string) => (await api.post(`/admin/lixeira/${id}/restaurar?tipo=${tipo}`)).data;
export const deletePermanente = async (id: string, tipo: string) => (await api.delete(`/admin/lixeira/${id}?tipo=${tipo}`)).data;

// ==============================================================================
// 4. CONFIGURAÇÕES LOCAIS (Vidas do Arcade)
// ==============================================================================
const CONFIG_KEY = '@config_jogo_v1';

export const salvarConfiguracaoJogo = async (vidas: number) => {
  try {
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify({ vidasPadrao: vidas }));
    return true;
  } catch { return false; }
};

export const getConfiguracaoJogo = async () => {
  try {
    const json = await AsyncStorage.getItem(CONFIG_KEY);
    return json ? JSON.parse(json) : { vidasPadrao: 5 };
  } catch { return { vidasPadrao: 5 }; }
};

// ==============================================================================
// 5. JOGOS PERSONALIZADOS (Local)
// ==============================================================================
const JOGOS_KEY = '@jogos_v2';
const CONCLUIDOS_KEY = '@jogos_concluidos_ids';

export const getJogosPersonalizados = async () => {
  try {
    const json = await AsyncStorage.getItem(JOGOS_KEY);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
};

export const criarJogo = async (dados: any) => {
  const existing = await getJogosPersonalizados();
  const novo = { ...dados, id: Math.random().toString(36).substr(2, 9) };
  await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify([novo, ...existing]));
  return novo;
};

export const deletarJogo = async (id: string) => {
  const existing = await getJogosPersonalizados();
  await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify(existing.filter((x: any) => x.id !== id)));
  return true;
};

export const getMissoesDisponiveis = async () => {
  try {
    const jogos = await getJogosPersonalizados();
    const concluidosJson = await AsyncStorage.getItem(CONCLUIDOS_KEY);
    const concluidos = concluidosJson ? JSON.parse(concluidosJson) : [];
    return jogos.filter((j: any) => !concluidos.includes(j.id));
  } catch { return []; }
};

export const concluirMissao = async (id: string) => {
  const json = await AsyncStorage.getItem(CONCLUIDOS_KEY);
  const lista = json ? JSON.parse(json) : [];
  if (!lista.includes(id)) {
    lista.push(id);
    await AsyncStorage.setItem(CONCLUIDOS_KEY, JSON.stringify(lista));
  }
};

export default api;
