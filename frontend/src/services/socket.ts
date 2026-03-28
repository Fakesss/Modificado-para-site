import { io } from 'socket.io-client';

const SOCKET_URL = 'https://modificado-para-site-1.onrender.com';

// Única conexão centralizada do aplicativo
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket'],
});

// Memória global para quando um convite for aceito
export let activeMatchData: any = null;

export const setActiveMatchData = (data: any) => {
  activeMatchData = data;
};
