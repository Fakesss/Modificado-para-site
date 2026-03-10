import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { enviarPingOnline } from '../services/multiplayerApi';

export default function OnlineHeartbeat() {
  const { user } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!user) return;

    // Função que avisa o servidor que estamos vivos
    const ping = () => enviarPingOnline(user.nome, user.turmaId, user.equipeId);

    // Bate o coração a primeira vez que entra
    ping();

    // Configura o relógio para bater a cada 30 segundos
    let interval = setInterval(() => {
      // SÓ ENVIA SE O APLICATIVO ESTIVER ABERTO E COM A TELA LIGADA
      if (AppState.currentState === 'active') {
        ping();
      }
    }, 30000);

    // Escuta quando o aluno minimiza o app ou bloqueia a tela
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // O celular acabou de ser desbloqueado! Avisa o servidor na hora.
        ping();
      }
      appState.current = nextAppState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user]);

  return null;
}
