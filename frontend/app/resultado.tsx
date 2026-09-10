import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTema, CoresTema } from '../src/context/ThemeContext';

export default function Resultado() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const params = useLocalSearchParams();

  // Função BLINDADA para ler números
  const parseNumber = (val: any) => {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = Number(val);
    return isNaN(parsed) ? 0 : parsed;
  };

  const acertos = parseNumber(params.acertos);
  const erros = parseNumber(params.erros);
  const total = parseNumber(params.total);
  const nota = parseNumber(params.nota);
  // percentual removido visualmente, mas mantido na leitura caso precise futuramente
  const pontos = parseNumber(params.pontos);
  
  const detalhes = params.detalhes ? JSON.parse(params.detalhes as string) : [];

  const getNotaColor = () => {
    if (nota >= 7) return cores.sucesso;
    if (nota >= 5) return cores.dourado;
    return cores.erro;
  };

  const getNotaIcon = () => {
    if (nota >= 7) return 'trophy';
    if (nota >= 5) return 'thumbs-up';
    return 'alert-circle'; // Mudado de 'refresh' para 'alert-circle' para não confundir
  };

  const getNotaMessage = () => {
    if (nota >= 9) return 'Excelente!';
    if (nota >= 7) return 'Muito bom!';
    if (nota >= 5) return 'Bom trabalho!';
    if (nota >= 3) return 'Continue estudando!';
    return 'Não desista!';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Cabeçalho do Resultado */}
        <View style={styles.resultHeader}>
          <Ionicons
            name={getNotaIcon()}
            size={80}
            color={getNotaColor()}
          />
          <Text style={[styles.notaText, { color: getNotaColor() }]}>{nota.toFixed(1)}</Text>
          <Text style={styles.notaMessage}>{getNotaMessage()}</Text>
        </View>

        {/* Estatísticas (Cards) */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color={cores.sucesso} />
            <Text style={styles.statValue}>{acertos}</Text>
            <Text style={styles.statLabel}>Acertos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={24} color={cores.erro} />
            <Text style={styles.statValue}>{erros}</Text>
            <Text style={styles.statLabel}>Erros</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="list" size={24} color={cores.azul} />
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Card de Pontos */}
        <View style={styles.pointsCard}>
          <Ionicons name="star" size={32} color={cores.dourado} />
          <View style={styles.pointsInfo}>
            <Text style={styles.pointsLabel}>Pontos ganhos</Text>
            <Text style={styles.pointsValue}>+{pontos}</Text>
          </View>
        </View>

        {/* BARRA DE PROGRESSO REMOVIDA AQUI COMO SOLICITADO */}

        {/* Detalhes das Questões */}
        {detalhes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Revisão das Questões</Text>
            {detalhes.map((detalhe: any, index: number) => (
              <View key={index} style={styles.detalheCard}>
                <View style={styles.detalheHeader}>
                  <View style={styles.detalheNumero}>
                    <Text style={styles.detalheNumeroText}>{detalhe.numero}</Text>
                  </View>
                  <Ionicons
                    name={detalhe.acertou ? 'checkmark-circle' : 'close-circle'}
                    size={24}
                    color={detalhe.acertou ? cores.sucesso : cores.erro}
                  />
                </View>
                <View style={styles.detalheInfo}>
                  <View style={styles.detalheRow}>
                    <Text style={styles.detalheLabel}>Sua resposta:</Text>
                    <Text
                      style={[
                        styles.detalheValue,
                        { color: detalhe.acertou ? cores.sucesso : cores.erro },
                      ]}
                    >
                      {detalhe.resposta || '-'}
                    </Text>
                  </View>
                  {!detalhe.acertou && (
                    <View style={styles.detalheRow}>
                      <Text style={styles.detalheLabel}>Resposta correta:</Text>
                      <Text style={[styles.detalheValue, { color: cores.sucesso }]}>
                        {detalhe.correta}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Botão Voltar */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/exercicios')}
        >
          <Ionicons name="arrow-back" size={20} color={cores.sobreAcento} />
          <Text style={styles.primaryButtonText}>Voltar para Atividades</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  resultHeader: { alignItems: 'center', paddingVertical: 32 },
  notaText: { fontSize: 64, fontWeight: 'bold', marginTop: 16 },
  notaMessage: { fontSize: 20, color: cores.texto, marginTop: 8 },
  statsContainer: { flexDirection: 'row', backgroundColor: cores.superficie, borderRadius: 16, padding: 20, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: cores.texto, marginTop: 8 },
  statLabel: { fontSize: 12, color: cores.textoFraco, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: cores.borda },
  pointsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.dourado + '30', borderRadius: 16, padding: 20, marginBottom: 16, gap: 16 },
  pointsInfo: { flex: 1 },
  pointsLabel: { color: cores.textoFraco, fontSize: 14 },
  pointsValue: { color: cores.dourado, fontSize: 28, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: cores.texto, marginBottom: 16 },
  detalheCard: { backgroundColor: cores.superficie, borderRadius: 12, padding: 16, marginBottom: 12 },
  detalheHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  detalheNumero: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
  detalheNumeroText: { color: cores.texto, fontWeight: 'bold' },
  detalheInfo: { gap: 8 },
  detalheRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detalheLabel: { color: cores.textoFraco, fontSize: 14 },
  detalheValue: { fontSize: 14, fontWeight: 'bold' },
  actionsContainer: { padding: 16 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.dourado, paddingVertical: 16, borderRadius: 12, gap: 8 },
  primaryButtonText: { color: cores.sobreAcento, fontSize: 18, fontWeight: 'bold' },
});
