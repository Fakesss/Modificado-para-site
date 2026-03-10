// src/services/multiplayerApi.ts
import api from './api';

export const enviarPingOnline = async (nome: string, turmaId?: string | null, equipeId?: string | null) => {
  try {
    // Chamada silenciosa no fundo
    await api.post('/online/ping', { nome, turmaId, equipeId });
  } catch (error) {
    // Ignora erros (se faltar net, ele só não pinga)
  }
};

export const buscarUsuariosOnline = async () => {
  try {
    const res = await api.get('/online/users');
    return res.data;
  } catch (error) {
    return [];
  }
};
