import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { socket } from '../services/socket';

export default function OnlineHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      if (socket.connected) socket.disconnect();
      return;
    }

    // 1. Liga o motor de tempo real (Socket) se estiver desligado
    if (!socket.connected) socket.connect();

    // 2. Registra o jogador no servidor para ele aparecer nas Lobbies e aba Online
    const registrarJogador = () => {
      socket.emit('register_player', {
        name: user.nome,
        user_id: user.id
      });
    };

    registrarJogador();

    // 3. Se a internet cair e voltar, ele se registra automaticamente
    socket.on('connect', registrarJogador);

    // 4. "Acorda" a conexão caso o celular bloqueie a tela e volte (WebView)
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          if (!socket.connected) socket.connect();
          setTimeout(registrarJogador, 1000);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        socket.off('connect', registrarJogador);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    return () => {
      socket.off('connect', registrarJogador);
    };
  }, [user]);

  return null;
}
