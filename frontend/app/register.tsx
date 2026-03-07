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

export default function Register() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [turmaId, setTurmaId] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  
  const { register, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user]);

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

  // Cadastro só pode ser feito se turma E equipe estiverem selecionadas
  const canRegister = nome && email && senha && confirmarSenha && turmaId && equipeId;

  const handleRegister = async () => {
    if (!canRegister) {
      Alert.alert('Erro', 'Preencha todos os campos obrigatórios');
      return;
    }

    // Limpeza de espaços invisíveis e padronização para evitar erros
    const emailPadronizado = email.toLowerCase().trim();
    const senhaPadronizada = senha.trim();
    const confirmarSenhaPadronizada = confirmarSenha.trim();

    if (senhaPadronizada !== confirmarSenhaPadronizada) {
      Alert.alert('Erro', 'As senhas não coincidem');
      return;
    }

    if (senhaPadronizada.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      // Envia os dados limpos para a API
      await register(nome.trim(), emailPadronizado, senhaPadronizada, turmaId, equipeId);
      // Navigation will happen in useEffect
    } catch (error: any) {
      // Filtro para erros comuns de cadastro
      const statusErro = error.response?.status;
      if (statusErro === 409 || error.response?.data?.detail?.includes('already exists')) {
        Alert.alert('Aviso', 'Este e-mail já está cadastrado. Tente fazer o login.');
      } else {
        const message = error.response?.data?.detail || 'Erro ao criar a conta. Tente novamente.';
        Alert.alert('Erro no Cadastro', message);
      }
    } finally {
      setLoading(false);
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
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.header}>
            <Ionicons name="person-add" size={48} color="#FFD700" />
            <Text style={styles.title}>Criar Conta</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nome completo *"
                placeholderTextColor="#666"
                value={nome}
                onChangeText={setNome}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-mail *"
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
                placeholder="Senha *"
                placeholderTextColor="#666"
                value={senha}
                onChangeText={setSenha}
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

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={24} color="#888" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirmar senha *"
                placeholderTextColor="#666"
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            {/* Seleção de Turma - OBRIGATÓRIO */}
            <Text style={styles.sectionTitle}>Selecione sua Série/Turma *</Text>
            <View style={styles.selectGrid}>
              {turmas.map((turma) => (
                <TouchableOpacity
                  key={turma.id}
                  style={[
                    styles.selectOption,
                    turmaId === turma.id && styles.selectOptionActive,
                  ]}
                  onPress={() => setTurmaId(turma.id)}
                >
                  <Text style={[
                    styles.selectText,
                    turmaId === turma.id && styles.selectTextActive,
                  ]}>{turma.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Seleção de Equipe - OBRIGATÓRIO */}
            <Text style={styles.sectionTitle}>Selecione sua Equipe *</Text>
            <View style={styles.selectGrid}>
              {equipes.map((equipe) => (
                <TouchableOpacity
                  key={equipe.id}
                  style={[
                    styles.selectOption,
                    { borderColor: equipe.cor },
                    equipeId === equipe.id && { backgroundColor: equipe.cor },
                  ]}
                  onPress={() => setEquipeId(equipe.id)}
                >
                  <Text style={[
                    styles.selectText,
                    { color: equipeId === equipe.id ? '#000' : equipe.cor },
                  ]}>{equipe.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Aviso se não selecionou turma/equipe */}
            {(!turmaId || !equipeId) && (
              <View style={styles.warningContainer}>
                <Ionicons name="warning" size={16} color="#FFD700" />
                <Text style={styles.warningText}>
                  Turma e equipe são obrigatórios para cadastro
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, (!canRegister || loading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={!canRegister || loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>Cadastrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.back()}
            >
              <Text style={styles.loginText}>Já tem conta? </Text>
              <Text style={styles.loginTextBold}>Entrar</Text>
            </TouchableOpacity>
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
  backButton: {
    marginTop: 10,
    padding: 8,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
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
  sectionTitle: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    minWidth: 80,
    alignItems: 'center',
  },
  selectOptionActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  selectText: {
    color: '#888',
    fontWeight: '600',
  },
  selectTextActive: {
    color: '#000',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 13,
    flex: 1,
  },
  button: {
    backgroundColor: '#FFD700',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginText: {
    color: '#888',
    fontSize: 16,
  },
  loginTextBold: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
