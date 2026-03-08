import React from 'react';
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

export default function Resultado() {
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
  const total = parseNumber(params.total); // Agora lê corretamente
  const nota = parseNumber(params.nota);
  const percentual = parseNumber(params.percentual);
  const pontos = parseNumber(params.pontos);
  
  const detalhes = params.detalhes ? JSON.parse(params.detalhes as string) : [];

  const getNotaColor = () => {
    if (nota >= 7) return '#32CD32';
    if (nota >= 5) return '#FFD700';
    return '#E74C3C';
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
        <View style={styles.resultHeader}>
          <Ionicons
            name={nota >= 7 ? 'trophy' : nota >= 5 ? 'thumbs-up' : 'refresh'}
            size={64}
            color={getNotaColor()}
          />
          <Text style={[styles.notaText, { color: getNotaColor() }]}>{nota.toFixed(1)}</Text>
          <Text style={styles.notaMessage}>{getNotaMessage()}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={24} color="#32CD32" />
            <Text style={styles.statValue}>{acertos}</Text>
            <Text style={styles.statLabel}>Acertos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={24} color="#E74C3C" />
            <Text style={styles.statValue}>{erros}</Text>
            <Text style={styles.statLabel}>Erros</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="list" size={24} color="#4169E1" />
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        <View style={styles.pointsCard}>
          <Ionicons name="star" size={32} color="#FFD700" />
          <View style={styles.pointsInfo}>
            <Text style={styles.pointsLabel}>Pontos ganhos</Text>
            <Text style={styles.pointsValue}>+{pontos}</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressLabel}>Aproveitamento: {percentual.toFixed(0)}%</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(percentual, 100)}%`, backgroundColor: getNotaColor() },
              ]}
            />
          </View>
        </View>

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
                    color={detalhe.acertou ? '#32CD32' : '#E74C3C'}
                  />
                </View>
                <View style={styles.detalheInfo}>
                  <View style={styles.detalheRow}>
                    <Text style={styles.detalheLabel}>Sua resposta:</Text>
                    <Text
                      style={[
                        styles.detalheValue,
                        { color: detalhe.acertou ? '#32CD32' : '#E74C3C' },
                      ]}
                    >
                      {detalhe.resposta || '-'}
                    </Text>
                  </View>
                  {!detalhe.acertou && (
                    <View style={styles.detalheRow}>
                      <Text style={styles.detalheLabel}>Resposta correta:</Text>
                      <Text style={[styles.detalheValue, { color: '#32CD32' }]}>
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

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)/exercicios')}
        >
          <Ionicons name="arrow-back" size={20} color="#000" />
          <Text style={styles.primaryButtonText}>Voltar para Atividades</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  resultHeader: { alignItems: 'center', paddingVertical: 32 },
  notaText: { fontSize: 64, fontWeight: 'bold', marginTop: 16 },
  notaMessage: { fontSize: 20, color: '#fff', marginTop: 8 },
  statsContainer: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#333' },
  pointsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFD700' + '30', borderRadius: 16, padding: 20, marginBottom: 16, gap: 16 },
  pointsInfo: { flex: 1 },
  pointsLabel: { color: '#888', fontSize: 14 },
  pointsValue: { color: '#FFD700', fontSize: 28, fontWeight: 'bold' },
  progressContainer: { marginBottom: 24 },
  progressLabel: { color: '#fff', fontSize: 14, marginBottom: 8 },
  progressBar: { height: 12, backgroundColor: '#333', borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  detalheCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  detalheHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  detalheNumero: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  detalheNumeroText: { color: '#fff', fontWeight: 'bold' },
  detalheInfo: { gap: 8 },
  detalheRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detalheLabel: { color: '#888', fontSize: 14 },
  detalheValue: { fontSize: 14, fontWeight: 'bold' },
  actionsContainer: { padding: 16 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700', paddingVertical: 16, borderRadius: 12, gap: 8 },
  primaryButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
});
