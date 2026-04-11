import React, { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { socket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function OnlineHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Essa é a função salva-vidas. Ela obriga o servidor a registrar
    // o ID novo do socket como o usuário real, tirando ele do modo "Fantasma"
    const restaurarConexao = () => {
      socket.emit('register_player', { user_id: user.id, name: user.nome });
      socket.emit('request_sync');
      socket.emit('get_lobbies');
    };

    // 1. Quando o componente monta e já tem internet
    if (socket.connected) {
      restaurarConexao();
    }

    // 2. Se a internet cair (caminhar na rua, trocar de Wi-Fi pra 4G) e voltar
    socket.on('connect', restaurarConexao);

    // 3. O SEGREDO DO MOBILE: Se o aluno bloquear a tela e desbloquear
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (!socket.connected) {
          socket.connect(); // Força o religamento imediato se a rede dormiu
        } else {
          restaurarConexao(); // Atualiza tudo imediatamente ao olhar pro app
        }
      }
    });

    return () => {
      socket.off('connect', restaurarConexao);
      subscription.remove();
    };
  }, [user]);

  return null; // Roda silenciosamente por trás
}
