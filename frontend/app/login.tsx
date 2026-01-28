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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import * as api from '../src/services/api';
import { Turma, Equipe } from '../src/types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewPressCount, setPreviewPressCount] = useState(0);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [selectedTurma, setSelectedTurma] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  
  const { login, enterPreviewMode, user, isPreviewMode, updateUserTeamInfo } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.perfil === 'ADMIN' || isPreviewMode) {
        router.replace('/admin');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, isPreviewMode]);

  const loadData = async () => {
    try {
      const [turmasData, equipesData] = await Promise.all([
        api.getTurmas(),
        api.getEquipes(),
      ]);
      setTurmas(turmasData);
      setEquipes(equipesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const canLogin = email && senha && selectedTurma && selectedEquipe;

  const handleLogin = async () => {
    if (!canLogin) {
      Alert.alert('Erro', 'Preencha todos os campos e selecione turma e equipe');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), senha, selectedTurma, selectedEquipe);
      // Navigation will happen in useEffect
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erro ao fazer login';
      Alert.alert('Erro', message);
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

  const getEquipeColor = (equipeId: string) => {
    const equipe = equipes.find(e => e.id === equipeId);
    return equipe?.cor || '#888';
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
                onChangeText={setEmail}
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
                onChangeText={setSenha}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={24}
                  color="#888"
                />
              </TouchableOpacity>
            </View>

            {/* Turma Selection */}
            <Text style={styles.sectionLabel}>Selecione sua Turma *</Text>
            <View style={styles.selectGrid}>
              {turmas.map((turma) => (
                <TouchableOpacity
                  key={turma.id}
                  style={[
                    styles.selectOption,
                    selectedTurma === turma.id && styles.selectOptionActive,
                  ]}
                  onPress={() => setSelectedTurma(turma.id)}
                >
                  <Text style={[
                    styles.selectText,
                    selectedTurma === turma.id && styles.selectTextActive,
                  ]}>
                    {turma.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Equipe Selection */}
            <Text style={styles.sectionLabel}>Selecione sua Equipe *</Text>
            <View style={styles.selectGrid}>
              {equipes.map((equipe) => (
                <TouchableOpacity
                  key={equipe.id}
                  style={[
                    styles.selectOption,
                    { borderColor: equipe.cor },
                    selectedEquipe === equipe.id && { backgroundColor: equipe.cor },
                  ]}
                  onPress={() => setSelectedEquipe(equipe.id)}
                >
                  <Text style={[
                    styles.selectText,
                    { color: selectedEquipe === equipe.id ? '#000' : equipe.cor },
                  ]}>
                    {equipe.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Warning message if not all selected */}
            {(!selectedTurma || !selectedEquipe) && (
              <View style={styles.warningContainer}>
                <Ionicons name="warning" size={16} color="#FFD700" />
                <Text style={styles.warningText}>
                  Selecione turma e equipe para continuar
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                (!canLogin || loading) && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!canLogin || loading}
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
    marginTop: 40,
    marginBottom: 24,
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
    gap: 12,
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
  sectionLabel: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    minWidth: 70,
    alignItems: 'center',
  },
  selectOptionActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  selectText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 14,
  },
  selectTextActive: {
    color: '#000',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 13,
  },
  button: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
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
    paddingTop: 24,
    alignItems: 'center',
  },
  footerText: {
    color: '#555',
    fontSize: 14,
  },
});
