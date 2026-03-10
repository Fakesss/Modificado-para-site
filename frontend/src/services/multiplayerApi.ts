import api from './api';

// 🛡️ ESCUDOS DE TEMPO (TIME SHIELDS) - Previne ataques DDOS acidentais do próprio app
let ultimoPing = 0;
let ultimaBusca = 0;

export const enviarPingOnline = async (nome: string, turmaId?: string | null, equipeId?: string | null) => {
  const agora = Date.now();
  
  // SE O APP TENTAR MANDAR OUTRO SINAL EM MENOS DE 20 SEGUNDOS, O ESCUDO DESTRÓI A REQUISIÇÃO NA HORA
  if (agora - ultimoPing < 20000) return;
  
  ultimoPing = agora;
  try {
    await api.post('/online/ping', { nome, turmaId, equipeId });
  } catch (error) {}
};

export const buscarUsuariosOnline = async () => {
  const agora = Date.now();
  
  // ESCUDO: Se a tela tentar buscar online num intervalo menor que 5 segundos, bloqueia.
  if (agora - ultimaBusca < 5000) return null; 
  
  ultimaBusca = agora;
  try {
    const res = await api.get('/online/users');
    return res.data;
  } catch (error) {
    return [];
  }
};
