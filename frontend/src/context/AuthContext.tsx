import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Usuario } from '../types';
import * as api from '../services/api';

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  isLoading: boolean;
  isPreviewMode: boolean;
  isAdminViewingAsStudent: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (nome: string, email: string, senha: string, turmaId?: string, equipeId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enterPreviewMode: () => void;
  exitPreviewMode: () => void;
  setAdminViewingAsStudent: (viewing: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAdminViewingAsStudent, setIsAdminViewingAsStudent] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        // Refresh user data
        try {
          const userData = await api.getMe();
          setUser(userData);
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          // Token might be expired or invalid (SECRET_KEY changed) - clear it silently
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          setToken(null);
          setUser(null);
          // Don't call logout() to avoid clearing other state unnecessarily
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, senha: string) => {
    const data = await api.login(email, senha);
    setToken(data.access_token);
    setUser(data.usuario);
    await AsyncStorage.setItem('token', data.access_token);
    await AsyncStorage.setItem('user', JSON.stringify(data.usuario));
  };

  const register = async (nome: string, email: string, senha: string, turmaId?: string, equipeId?: string) => {
    const data = await api.register(nome, email, senha, turmaId, equipeId);
    setToken(data.access_token);
    setUser(data.usuario);
    await AsyncStorage.setItem('token', data.access_token);
    await AsyncStorage.setItem('user', JSON.stringify(data.usuario));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setIsPreviewMode(false);
    setIsAdminViewingAsStudent(false);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  };

  const refreshUser = async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const enterPreviewMode = () => {
    setIsPreviewMode(true);
  };

  const exitPreviewMode = () => {
    setIsPreviewMode(false);
  };

  const handleSetAdminViewingAsStudent = (viewing: boolean) => {
    setIsAdminViewingAsStudent(viewing);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isPreviewMode,
        isAdminViewingAsStudent,
        login,
        register,
        logout,
        refreshUser,
        enterPreviewMode,
        exitPreviewMode,
        setAdminViewingAsStudent: handleSetAdminViewingAsStudent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
