import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { enviarPingOnline } from '../services/multiplayerApi';

export default function OnlineHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const ping = () => {
      if (isActive) enviarPingOnline(user.nome, user.turmaId, user.equipeId);
    };

    // Função que verifica se a tela está acesa E o app está visível na WebView
    const isScreenVisible = () => {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        return document.visibilityState === 'visible';
      }
      return true; // Fallback se não estiver na web
    };

    const loopPing = () => {
      if (!isActive) return;
      
      // SÓ MANDA MENSAGEM SE A TELA ESTIVER ACESA E O APP ABERTO
      if (isScreenVisible()) {
        ping();
      }
      
      timeoutId = setTimeout(loopPing, 30000);
    };

    // Primeiro disparo
    ping();
    timeoutId = setTimeout(loopPing, 30000);

    // ESCUTA O BLOQUEIO DE TELA DA WEBVIEW
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Desbloqueou a tela! Espera 2 segundinhos pro 4G voltar e bate o coração.
          setTimeout(() => { if (isActive) ping(); }, 2000);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        isActive = false;
        clearTimeout(timeoutId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [user]);

  return null;
}
