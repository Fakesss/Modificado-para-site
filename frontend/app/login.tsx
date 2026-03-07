import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 🚨 NOVO: Estado para guardar o texto do erro na tela
  const [mensagemErro, setMensagemErro] = useState('');
  
  const [previewPressCount, setPreviewPressCount] = useState(0);
  
  const { login, enterPreviewMode, user, isPreviewMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.perfil === 'ADMIN' || isPreviewMode) {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, isPreviewMode]);

  const handleLogin = async () => {
    // Limpa qualquer erro antigo ao tentar de novo
    setMensagemErro('');

    if (!email || !senha) {
      setMensagemErro('Preencha o e-mail e a senha.');
      return;
    }

    setLoading(true);
    try {
      const emailPadronizado = email.toLowerCase().trim();
      const senhaPadronizada = senha.trim();

      await login(emailPadronizado, senhaPadronizada);
      
    } catch (error: any) {
      // 🚨 EM VEZ DE ALERT, ESCREVEMOS O ERRO NA TELA!
      setMensagemErro('E-mail ou senha incorretos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPress = () => {
    const newCount = previewPressCount + 1;
    setPreviewPressCount(newCount);
    
    if (newCount >= 5) {
      enterPreviewMode();
      router.replace('/admin');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hidden preview button */}
          <TouchableOpacity
            style={styles.previewButton}
            onPress={handlePreviewPress}
            activeOpacity={1}
          >
            <View style={styles.previewDot} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="school" size={64} color="#FFD700" />
            <Text style={styles.title}>Ranking Matemática</Text>
            <Text style={styles.subtitle}>Equipes</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setMensagemErro(''); // Limpa o erro quando volta a digitar
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor="#666"
                value={senha}
                onChangeText={(text) => {
                  setSenha(text);
                  setMensagemErro(''); // Limpa o erro quando volta a digitar
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            {/* 🚨 CAIXA DE ERRO VISUAL APARECE AQUI SE TIVER ERRO */}
            {mensagemErro !== '' && (
              <View style={styles.caixaErro}>
                <Ionicons name="alert-circle" size={20} color="#ff4444" />
                <Text style={styles.textoErro}>{mensagemErro}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.registerText}>Não tem conta? </Text>
              <Text style={styles.registerTextBold}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Gamificação para estudos de Matemática</Text>
            <Text style={styles.footerText}>6º ao 9º ano</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  previewButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 10,
    zIndex: 100,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0c0c0c',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 20,
    color: '#FFD700',
    fontWeight: '600',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  
  // 🚨 ESTILOS DO NOVO AVISO DE ERRO EM VERMELHO
  caixaErro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff444420', // Fundo vermelho transparente
    padding: 12,
    borderRadius: 8,
    marginTop: -4,
    marginBottom: 4,
  },
  textoErro: {
    color: '#ff4444', // Letra vermelha
    marginLeft: 8,
    fontSize: 14,
    fontWeight: 'bold',
  },

  button: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  registerText: {
    color: '#888',
    fontSize: 16,
  },
  registerTextBold: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#555',
    fontSize: 14,
  },
});
