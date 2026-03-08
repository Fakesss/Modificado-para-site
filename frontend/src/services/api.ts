import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// SEU ENDEREÇO DO SERVIDOR (Onde estão as Turmas e Equipes)
const API_URL = 'https://modificado-para-site-1.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

// Envia o crachá (Token) em toda requisição para o servidor deixar a gente entrar
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ==============================================================================
// 1. DADOS DO SERVIDOR (O que "sumiu" vai voltar aqui)
// ==============================================================================

// Turmas (6º Ano, 7º Ano...)
export const getTurmas = async () => {
  try {
    const response = await api.get('/turmas');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar turmas:', error);
    return []; // Retorna vazio só se der erro de conexão real
  }
};

// Equipes (Cores e Nomes)
export const getEquipes = async () => {
  try {
    const response = await api.get('/equipes');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar equipes:', error);
    return [];
  }
};

// Usuários (Lista de Alunos)
export const getUsuarios = async () => {
  try {
    const response = await api.get('/usuarios');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return [];
  }
};

// Autenticação
export const login = async (email: string, senha: string) => {
  try {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 404) {
      throw new Error('Email ou senha incorretos.');
    }
    throw new Error('Erro de conexão com o servidor.');
  }
};

export const register = async (nome: string, email: string, senha: string, turmaId?: string, equipeId?: string) => {
  try {
    const response = await api.post('/auth/register', { nome, email, senha, turmaId, equipeId });
    return response.data;
  } catch (error: any) {
    throw new Error('Erro ao criar conta.');
  }
};

export const getMe = async () => {
  try { const response = await api.get('/auth/me'); return response.data; } catch { return null; }
};

export const updateEquipe = async (id: string, dados: any) => {
  const response = await api.put(`/equipes/${id}`, dados);
  return response.data;
};

// Outros dados do servidor (Ranking, Conteúdos, Relatórios)
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
// 2. CONFIGURAÇÕES LOCAIS (Vidas do Arcade - Salva no Celular)
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
    return jsonValue != null ? JSON.parse(jsonValue) : { vidasPadrao: 5 };
  } catch(e) {
    return { vidasPadrao: 5 };
  }
};

// ==============================================================================
// 3. JOGOS PERSONALIZADOS (Salva no Celular)
// ==============================================================================
const JOGOS_KEY = '@jogos_v2';
const CONCLUIDOS_KEY = '@jogos_concluidos_ids';

export const getJogosPersonalizados = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(JOGOS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch(e) { return []; }
};

export const criarJogo = async (dados: any) => {
  try {
    const existing = await getJogosPersonalizados();
    const novoJogo = { ...dados, id: Math.random().toString(36).substr(2, 9) };
    const novaLista = [novoJogo, ...existing];
    await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify(novaLista));
    return novoJogo;
  } catch (e) { throw new Error('Erro ao salvar localmente'); }
};

export const deletarJogo = async (id: string) => {
  try {
    const existing = await getJogosPersonalizados();
    const novaLista = existing.filter((j: any) => j.id !== id);
    await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify(novaLista));
    return true;
  } catch (e) { return false; }
};

export const getMissoesDisponiveis = async () => {
  try {
    const todas = await getJogosPersonalizados();
    const concluidosJson = await AsyncStorage.getItem(CONCLUIDOS_KEY);
    const concluidos = concluidosJson ? JSON.parse(concluidosJson) : [];
    // Retorna só o que NÃO foi concluído
    return todas.filter((m: any) => !concluidos.includes(m.id));
  } catch (error) { return []; }
};

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

export default api;
