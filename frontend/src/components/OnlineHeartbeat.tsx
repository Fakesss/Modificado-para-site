import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { enviarPingOnline } from '../services/multiplayerApi';

export default function OnlineHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const baterCoracao = () => {
      if (AppState.currentState === 'active') {
        enviarPingOnline(user.nome, user.turmaId, user.equipeId);
      }
    };

    // Dispara ao entrar no app
    baterCoracao();

    // Loop contínuo (o Escudo nos protege das requisições engavetadas)
    const interval = setInterval(baterCoracao, 25000);

    // Quando o aluno desbloqueia a tela, avisa que voltou!
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        // Um pequeno delay para dar tempo do Wi-Fi/4G conectar
        setTimeout(baterCoracao, 1500);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user]);

  return null;
}
