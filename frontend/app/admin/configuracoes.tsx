import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as api from '../../src/services/api';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

export default function ConfiguracoesAdmin() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const [vidas, setVidas] = useState('5');

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    const conf = await api.getConfiguracaoJogo();
    setVidas(String(conf.vidasPadrao));
  };

  const salvar = async () => {
    const v = parseInt(vidas);
    if (isNaN(v) || v <= 0) return Alert.alert('Erro', 'Digite um número válido maior que 0');
    
    await api.salvarConfiguracaoJogo(v);
    Alert.alert('Sucesso', `O Modo Arcade agora terá ${v} vidas padrão!`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={cores.dourado} /></TouchableOpacity>
        <Text style={styles.title}>Configurações do Jogo</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Vidas Padrão (Modo Arcade):</Text>
        <Text style={styles.desc}>Defina com quantas vidas o aluno começa nos modos clássicos (Soma, Divisão, etc).</Text>
        
        <View style={styles.inputRow}>
          <Ionicons name="heart" size={24} color={cores.erro} />
          <TextInput 
            style={styles.input} 
            value={vidas} 
            onChangeText={setVidas} 
            keyboardType="numeric" 
          />
        </View>

        <TouchableOpacity style={styles.btnSalvar} onPress={salvar}>
          <Text style={styles.btnTxt}>SALVAR ALTERAÇÃO</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: 1, borderColor: cores.superficieAlt },
  title: { color: cores.dourado, fontSize: 20, fontWeight: 'bold' },
  content: { padding: 20 },
  label: { color: cores.texto, fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  desc: { color: cores.textoFraco, marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficie, padding: 15, borderRadius: 10, gap: 10, marginBottom: 20 },
  input: { color: cores.texto, fontSize: 20, fontWeight: 'bold', flex: 1 },
  btnSalvar: { backgroundColor: cores.sucesso, padding: 15, borderRadius: 10, alignItems: 'center' },
  btnTxt: { fontWeight: '900', color: cores.sobreAcento }
});
