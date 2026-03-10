import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { enviarPingOnline } from '../services/multiplayerApi';

export default function OnlineHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Dispara o primeiro ping assim que entra
    enviarPingOnline(user.nome, user.turmaId, user.equipeId);

    // Fica avisando o servidor a cada 30 segundos que ainda está aqui
    const interval = setInterval(() => {
      enviarPingOnline(user.nome, user.turmaId, user.equipeId);
    }, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return null; // É um componente fantasma, não desenha nada na tela
}
