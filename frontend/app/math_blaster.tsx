import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function MathBlasterNative() {
  // A sua URL de produção da Vercel
  const VERCEL_URL = 'https://modificado-para-site.vercel.app/math_blaster'; 

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <WebView 
        source={{ uri: VERCEL_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
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
