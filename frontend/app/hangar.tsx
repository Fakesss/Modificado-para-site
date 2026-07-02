import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../src/services/api';
import { ArmaHangar, HangarPerfil } from '../src/types';

const ARMAS: { id: ArmaHangar; nome: string; desc: string; custo: number; icone: any }[] = [
  { id: 'PADRAO', nome: 'Padrão', desc: 'Tiro simples e equilibrado.', custo: 0, icone: 'radio-button-on-outline' },
  { id: 'ELETRICA', nome: 'Elétrica', desc: 'Salta entre inimigos próximos.', custo: 80, icone: 'flash-outline' },
  { id: 'PLASMA', nome: 'Plasma Burst', desc: 'Cadência lenta, dano alto.', custo: 150, icone: 'flame-outline' },
  { id: 'LEQUE', nome: 'Spread Shot', desc: 'Três projéteis em leque, sempre ativo.', custo: 150, icone: 'apps-outline' },
];

const ATRIBUTOS: { id: 'cdr' | 'velocidade' | 'dano'; nome: string; desc: string; campoNivel: 'nivelCDR' | 'nivelVelocidade' | 'nivelDano'; custoBase: number; icone: any }[] = [
  { id: 'cdr', nome: 'Redução de Recarga', desc: 'Diminui o cooldown de todas as armas especiais.', campoNivel: 'nivelCDR', custoBase: 40, icone: 'timer-outline' },
  { id: 'velocidade', nome: 'Velocidade', desc: 'Aumenta a velocidade de movimento da nave.', campoNivel: 'nivelVelocidade', custoBase: 35, icone: 'speedometer-outline' },
  { id: 'dano', nome: 'Dano Base', desc: 'Aumenta o dano inicial da nave.', campoNivel: 'nivelDano', custoBase: 45, icone: 'flash' },
];

const FATOR_CRESCIMENTO = 1.4;
const NIVEL_MAX = 8;
const custoProximoNivel = (custoBase: number, nivelAtual: number) => Math.floor(custoBase * Math.pow(FATOR_CRESCIMENTO, nivelAtual));

const CORES = ['#00FFFF', '#FF00FF', '#7FFF00', '#FFD700', '#FF4444', '#BB77FF', '#FF7055', '#FFFFFF'];

export default function Hangar() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<HangarPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [codigoSecreto, setCodigoSecreto] = useState('');
  const [codigoPromo, setCodigoPromo] = useState('');
  const [mostrarInjetor, setMostrarInjetor] = useState(false);
  const [quantidadeInjetar, setQuantidadeInjetar] = useState('');
  const erroTimer = useRef<any>(null);

  useEffect(() => {
    api.getHangarPerfil().then((p) => { setPerfil(p); setLoading(false); });
  }, []);

  const mostrarErro = (msg: string) => {
    setErro(msg);
    if (erroTimer.current) clearTimeout(erroTimer.current);
    erroTimer.current = setTimeout(() => setErro(''), 3000);
  };

  const recarregarPerfil = async () => setPerfil(await api.getHangarPerfil());

  const handleEquiparArma = async (arma: ArmaHangar) => {
    try {
      const atualizado = await api.hangarEquiparArma(arma);
      setPerfil(atualizado);
    } catch (e: any) { mostrarErro(e.message); }
  };

  const handleUpgrade = async (atributo: 'cdr' | 'velocidade' | 'dano') => {
    try {
      const atualizado = await api.hangarUpgrade(atributo);
      setPerfil(atualizado);
    } catch (e: any) { mostrarErro(e.message); }
  };

  const handleCor = async (cor: string) => {
    setPerfil(p => p ? { ...p, corNave: cor } : p);
    await api.hangarCor(cor);
  };

  const handleCodigoSecreto = async () => {
    if (!codigoSecreto.trim()) return;
    try {
      await api.hangarCodigoSecreto(codigoSecreto);
      setCodigoSecreto('');
      await recarregarPerfil();
    } catch (e: any) { mostrarErro(e.message); }
  };

  const handleCodigoPromo = (texto: string) => {
    setCodigoPromo(texto);
    if (texto.trim().toUpperCase() === 'SANDBOX9000') setMostrarInjetor(true);
  };

  const handleInjetar = async () => {
    const qtd = parseInt(quantidadeInjetar);
    if (isNaN(qtd) || qtd < 0) { mostrarErro('Digite um número válido'); return; }
    try {
      await api.hangarAdminInjetarMoedas(codigoPromo.trim().toUpperCase(), qtd);
      await recarregarPerfil();
      setMostrarInjetor(false);
      setCodigoPromo('');
      setQuantidadeInjetar('');
    } catch (e: any) { mostrarErro(e.message); }
  };

  if (loading || !perfil) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#00FFFF" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00FFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>HANGAR</Text>
        <View style={styles.moedasBox}>
          <Ionicons name="logo-bitcoin" size={16} color="#FFD700" />
          <Text style={styles.moedasText}>{perfil.moedas}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {erro ? (
          <View style={styles.erroBox}><Text style={styles.erroText}>{erro}</Text></View>
        ) : null}

        <Text style={styles.secaoTitulo}>ARMA INICIAL</Text>
        <Text style={styles.secaoDesc}>Escolha com qual arma sua nave começa cada missão.</Text>
        <View style={styles.gridArmas}>
          {ARMAS.map((arma) => {
            const desbloqueada = perfil.armasDesbloqueadas.includes(arma.id);
            const selecionada = perfil.armaInicial === arma.id;
            return (
              <TouchableOpacity
                key={arma.id}
                style={[styles.cardArma, selecionada && styles.cardArmaSelecionada]}
                onPress={() => handleEquiparArma(arma.id)}
              >
                <Ionicons name={arma.icone} size={26} color={selecionada ? '#00FFFF' : '#AAA'} />
                <Text style={[styles.cardArmaNome, selecionada && { color: '#00FFFF' }]}>{arma.nome}</Text>
                <Text style={styles.cardArmaDesc}>{arma.desc}</Text>
                {!desbloqueada && (
                  <View style={styles.cardArmaCusto}>
                    <Ionicons name="lock-closed-outline" size={12} color="#FFD700" />
                    <Text style={styles.cardArmaCustoText}>{arma.custo}</Text>
                  </View>
                )}
                {selecionada && <View style={styles.cardArmaCheck}><Ionicons name="checkmark-circle" size={18} color="#00FFFF" /></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.secaoTitulo}>EVOLUÇÃO DA NAVE</Text>
        <Text style={styles.secaoDesc}>Cada nível custa mais que o anterior — evolua com calma.</Text>
        {ATRIBUTOS.map((attr) => {
          const nivelAtual = perfil[attr.campoNivel];
          const noMax = nivelAtual >= NIVEL_MAX;
          const custo = custoProximoNivel(attr.custoBase, nivelAtual);
          return (
            <View key={attr.id} style={styles.linhaAtributo}>
              <View style={styles.linhaAtributoTopo}>
                <Ionicons name={attr.icone} size={18} color="#00FFFF" />
                <Text style={styles.linhaAtributoNome}>{attr.nome}</Text>
                <Text style={styles.linhaAtributoNivel}>Nv. {nivelAtual}/{NIVEL_MAX}</Text>
              </View>
              <Text style={styles.linhaAtributoDesc}>{attr.desc}</Text>
              <View style={styles.barraNivel}>
                {Array.from({ length: NIVEL_MAX }).map((_, i) => (
                  <View key={i} style={[styles.pipNivel, i < nivelAtual && styles.pipNivelCheio]} />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btnEvoluir, noMax && styles.btnEvoluirDesativado]}
                disabled={noMax}
                onPress={() => handleUpgrade(attr.id)}
              >
                <Text style={styles.btnEvoluirText}>{noMax ? 'NÍVEL MÁXIMO' : `EVOLUIR — ${custo} moedas`}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={styles.secaoTitulo}>COR DA NAVE</Text>
        <View style={styles.linhaCores}>
          {CORES.map((cor) => (
            <TouchableOpacity
              key={cor}
              style={[styles.swatchCor, { backgroundColor: cor }, perfil.corNave === cor && styles.swatchCorSelecionada]}
              onPress={() => handleCor(cor)}
            />
          ))}
        </View>

        <Text style={styles.secaoTitulo}>HABILIDADE SECRETA</Text>
        {perfil.habilidadeSecretaDesbloqueada ? (
          <View style={[styles.cardSecreto, styles.cardSecretoDesbloqueado]}>
            <Ionicons name="star" size={22} color="#FFD700" />
            <Text style={styles.cardSecretoTitulo}>OVERDRIVE — desbloqueado</Text>
            <Text style={styles.cardSecretoDesc}>Ativação especial: digite o código correto durante a partida.</Text>
          </View>
        ) : (
          <View style={styles.cardSecreto}>
            <Ionicons name="lock-closed-outline" size={22} color="#666" />
            <Text style={styles.cardSecretoTituloBloqueado}>??? — bloqueado</Text>
            <TextInput
              style={styles.inputCodigo}
              placeholder="Digite um código secreto..."
              placeholderTextColor="#555"
              value={codigoSecreto}
              onChangeText={setCodigoSecreto}
              autoCapitalize="characters"
              onSubmitEditing={handleCodigoSecreto}
            />
            <TouchableOpacity style={styles.btnPequeno} onPress={handleCodigoSecreto}>
              <Text style={styles.btnPequenoText}>CONFIRMAR</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginTop: 40 }}>
          <TextInput
            style={styles.inputPromo}
            placeholder="Código promocional"
            placeholderTextColor="#333"
            value={codigoPromo}
            onChangeText={handleCodigoPromo}
            autoCapitalize="characters"
          />
          {mostrarInjetor && (
            <View style={styles.injetorBox}>
              <TextInput
                style={styles.inputCodigo}
                placeholder="Quantidade de moedas"
                placeholderTextColor="#555"
                value={quantidadeInjetar}
                onChangeText={setQuantidadeInjetar}
                keyboardType="numeric"
                onSubmitEditing={handleInjetar}
              />
              <TouchableOpacity style={styles.btnPequeno} onPress={handleInjetar}>
                <Text style={styles.btnPequenoText}>APLICAR</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050015' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a3e',
  },
  backButton: { padding: 8 },
  title: { fontSize: 20, fontWeight: '900', color: '#00FFFF', letterSpacing: 2 },
  moedasBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a3e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  moedasText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  erroBox: { backgroundColor: '#FF444430', borderWidth: 1, borderColor: '#FF4444', borderRadius: 8, padding: 10, marginBottom: 16 },
  erroText: { color: '#FF9999', fontSize: 13, textAlign: 'center' },
  secaoTitulo: { color: '#00FFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1, marginTop: 28, marginBottom: 4 },
  secaoDesc: { color: '#777', fontSize: 12, marginBottom: 12 },
  gridArmas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardArma: { width: '47%', backgroundColor: '#0e0e28', borderRadius: 10, borderWidth: 1, borderColor: '#252550', padding: 12, position: 'relative', minHeight: 110 },
  cardArmaSelecionada: { borderColor: '#00FFFF', backgroundColor: '#0e2a2e' },
  cardArmaNome: { color: '#EEE', fontWeight: 'bold', fontSize: 13, marginTop: 6 },
  cardArmaDesc: { color: '#888', fontSize: 10, marginTop: 3 },
  cardArmaCusto: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  cardArmaCustoText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold' },
  cardArmaCheck: { position: 'absolute', top: 8, right: 8 },
  linhaAtributo: { backgroundColor: '#0e0e28', borderRadius: 10, borderWidth: 1, borderColor: '#252550', padding: 14, marginBottom: 12 },
  linhaAtributoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaAtributoNome: { color: '#EEE', fontWeight: 'bold', fontSize: 13, flex: 1 },
  linhaAtributoNivel: { color: '#888', fontSize: 11 },
  linhaAtributoDesc: { color: '#777', fontSize: 11, marginTop: 4, marginBottom: 10 },
  barraNivel: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  pipNivel: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#252550' },
  pipNivelCheio: { backgroundColor: '#00FFFF' },
  btnEvoluir: { backgroundColor: '#00FFFF', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  btnEvoluirDesativado: { backgroundColor: '#333' },
  btnEvoluirText: { color: '#001018', fontWeight: '900', fontSize: 12 },
  linhaCores: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatchCor: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchCorSelecionada: { borderColor: '#FFF' },
  cardSecreto: { backgroundColor: '#0e0e28', borderRadius: 10, borderWidth: 1, borderColor: '#252550', padding: 16, alignItems: 'center', gap: 8 },
  cardSecretoDesbloqueado: { borderColor: '#FFD700', backgroundColor: '#2a2200' },
  cardSecretoTitulo: { color: '#FFD700', fontWeight: '900', fontSize: 13 },
  cardSecretoTituloBloqueado: { color: '#666', fontWeight: 'bold', fontSize: 13 },
  cardSecretoDesc: { color: '#999', fontSize: 11, textAlign: 'center' },
  inputCodigo: { backgroundColor: '#050015', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#EEE', paddingHorizontal: 12, paddingVertical: 8, width: '100%', textAlign: 'center' },
  btnPequeno: { backgroundColor: '#252550', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginTop: 4 },
  btnPequenoText: { color: '#00FFFF', fontWeight: 'bold', fontSize: 11 },
  inputPromo: { color: '#222', fontSize: 10, textAlign: 'center', padding: 4 },
  injetorBox: { alignItems: 'center', gap: 8, marginTop: 10 },
});
