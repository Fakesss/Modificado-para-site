import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ... (Mantenha as funções de Login, Register, Turmas, etc. iguais às anteriores) ...
// Vou pular as funções padrão para focar na MUDANÇA DAS MISSÕES abaixo:

export const login = async (email: string, senha: string) => {
  try {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 404) throw new Error('Credenciais inválidas.');
    throw new Error('Erro de conexão.');
  }
};
// ... (Presuma que as outras funções getTurmas, getUsuarios etc estão aqui) ...
// Se precisar, copie do código anterior, vou focar na lógica nova:

export const getTurmas = async () => { try { return (await api.get('/turmas')).data; } catch { return []; } };
export const getUsuarios = async () => { try { return (await api.get('/usuarios')).data; } catch { return []; } };

// ==============================================================================
// 3. JOGOS PERSONALIZADOS & SISTEMA DE CONCLUSÃO (LOCAL)
// ==============================================================================

const JOGOS_KEY = '@jogos_v2';
const CONCLUIDOS_KEY = '@jogos_concluidos_ids';

// 1. Busca jogos criados (Admin)
export const getJogosPersonalizados = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(JOGOS_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch(e) { return []; }
};

// 2. Cria jogo com VIDAS e PONTOS personalizados
export const criarJogo = async (dados: any) => {
  try {
    const existing = await getJogosPersonalizados();
    const novoJogo = { ...dados, id: Math.random().toString(36).substr(2, 9) };
    await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify([novoJogo, ...existing]));
    return novoJogo;
  } catch (e) { throw new Error('Erro ao salvar.'); }
};

// 3. Deleta jogo (Admin)
export const deletarJogo = async (id: string) => {
  try {
    const existing = await getJogosPersonalizados();
    const novaLista = existing.filter((j: any) => j.id !== id);
    await AsyncStorage.setItem(JOGOS_KEY, JSON.stringify(novaLista));
    return true;
  } catch (e) { return false; }
};

// 4. Busca missões para o ALUNO (Filtrando as que ele já venceu)
export const getMissoesDisponiveis = async () => {
  try {
    // Pega todas as missões
    const todas = await getJogosPersonalizados();
    
    // Pega a lista de IDs que este aluno já concluiu
    const concluidosJson = await AsyncStorage.getItem(CONCLUIDOS_KEY);
    const concluidos = concluidosJson ? JSON.parse(concluidosJson) : [];

    // Retorna apenas as que NÃO estão na lista de concluídos
    return todas.filter((m: any) => !concluidos.includes(m.id));
  } catch (error) {
    return [];
  }
};

// 5. Marca a missão como concluída (Vitória)
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
