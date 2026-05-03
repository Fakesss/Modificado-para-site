import React, { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';

export default function MathBlasterMultiNative() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  // Busca as credenciais e os parâmetros da sala para repassar à WebView
  useEffect(() => {
    const prepareUrl = async () => {
      const token = await AsyncStorage.getItem('token');
      const baseUrl = 'https://modificado-para-site.vercel.app/math_blaster_multi';
      
      // Resgata os parâmetros que a tela de "Jogadores" enviou ao aceitar o desafio
      const roomId = params.roomId || '';
      const isHost = params.isHost || 'false';
      const opponentName = params.opponentName || '';
      // Codifica a cor para não quebrar a URL por causa do símbolo '#'
      const opponentColor = encodeURIComponent((params.opponentColor as string) || '#FF00FF');

      // Monta a URL completa com o Token e os Dados da Sala
      setAuthUrl(`${baseUrl}?token=${token || ''}&userId=${user?.id || ''}&roomId=${roomId}&isHost=${isHost}&opponentName=${opponentName}&opponentColor=${opponentColor}`);
    };
    prepareUrl();
  }, [user, params]);

  // Se receber a mensagem 'GO_BACK' do site na Vercel, fecha a tela no celular
  const handleMessage = (event: any) => {
    if (event.nativeEvent.data === 'GO_BACK') {
      router.back();
    }
  };

  if (!authUrl) {
      return (
          <SafeAreaView style={styles.container}>
              <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="large" color="#00FFFF" />
              </View>
          </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <WebView 
        source={{ uri: authUrl }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage} 
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
  container: { flex: 1, backgroundColor: '#050015' },
  webview: { flex: 1, backgroundColor: '#050015' },
  loadingWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050015' }
});
