import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { enviarPingOnline } from '../services/multiplayerApi';

export default function OnlineHeartbeat() {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const ping = () => {
      if (isActive) enviarPingOnline(user.nome, user.turmaId, user.equipeId);
    };

    // Bate o coração a primeira vez que entra
    ping();

    // 🚨 A SOLUÇÃO: Loop com setTimeout (Imune ao efeito metralhadora)
    const loopPing = () => {
      if (!isActive) return;
      if (AppState.currentState === 'active') {
        ping();
      }
      // Só agenda o próximo disparo DEPOIS de processar o atual
      timeoutId = setTimeout(loopPing, 30000);
    };

    // Inicia o ciclo
    timeoutId = setTimeout(loopPing, 30000);

    // Escuta quando o celular é desbloqueado
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Celular acordou! Espera 2 segundinhos pro Wi-Fi conectar e avisa o servidor.
        setTimeout(ping, 2000);
      }
      appState.current = nextAppState;
    });

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      subscription.remove();
    };
  }, [user]);

  return null;
}
