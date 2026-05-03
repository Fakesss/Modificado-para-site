import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function MathBlasterNative() {
  const router = useRouter();
  
  // A URL oficial da sua branch main na Vercel
  const VERCEL_URL = 'https://modificado-para-site.vercel.app/math_blaster'; 

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      
      {/* HEADER: Botão para sair do WebView e voltar ao menu */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#00FFFF" />
          <Text style={styles.backTxt}>Sair do Teste Web</Text>
        </TouchableOpacity>
        <Text style={styles.urlTxt}>Servidor: Vercel</Text>
      </View>

      {/* O WEBVIEW */}
      <WebView 
        source={{ uri: VERCEL_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        
        // Travas para garantir que o multi-touch vá para o jogo, não para o navegador
        scrollEnabled={false} 
        bounces={false}       
        scalesPageToFit={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        
        // Injeção de JS para bloquear o zoom de pinça do navegador nativo do Android
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
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingHorizontal: 15, 
    paddingVertical: 10,
    backgroundColor: '#0A0025', 
    borderBottomWidth: 2, 
    borderBottomColor: '#00FFFF' 
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center',
    padding: 5,
  },
  backTxt: { 
    color: '#00FFFF', 
    marginLeft: 8, 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  urlTxt: {
    color: '#9D97B5',
    fontSize: 12,
    fontStyle: 'italic'
  },
  webview: { 
    flex: 1, 
    backgroundColor: '#050015' 
  }
});
