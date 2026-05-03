import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';

export default function MathBlasterNative() {
  const router = useRouter();
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const prepareUrl = async () => {
      const token = await AsyncStorage.getItem('token');
      // Passa o token e o ID do usuário via URL para a WebView poder autenticar as requisições
      const vercelBase = 'https://modificado-para-site.vercel.app/math_blaster';
      setUrl(`${vercelBase}?token=${token || ''}&userId=${user?.id || ''}`);
    };
    prepareUrl();
  }, [user]);

  // Função que escuta mensagens vindas do site na Vercel
  const handleMessage = (event: any) => {
    if (event.nativeEvent.data === 'GO_BACK') {
      router.back(); // Fecha a tela nativa e volta para o menu do app
    }
  };

  if (!url) return null; // Aguarda carregar as credenciais

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <WebView 
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage} // Conecta o escutador de eventos
        scrollEnabled={false} 
        bounces={false}       
        scalesPageToFit={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        
        // Bloqueio de zoom de pinça do navegador mobile
        injectedJavaScript={`
          const meta = document.createElement('meta'); 
          meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0'); 
          meta.setAttribute('name', 'viewport'); 
          document.getElementsByTagName('head')[0].appendChild(meta); 
          true;
        `}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#050015' 
  },
  webview: { 
    flex: 1, 
    backgroundColor: '#050015' 
  }
});
