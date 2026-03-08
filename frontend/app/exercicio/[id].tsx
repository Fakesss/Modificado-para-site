import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Exercicio } from '../../src/types';

const ALTERNATIVA_CORES = [
  '#E74C3C', '#F39C12', '#27AE60', '#3498DB', '#9B59B6'
];

export default function ExercicioScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);

  useEffect(() => {
    loadExercicio();
  }, [id]);

  const loadExercicio = async () => {
    try {
      const exercicioData = await api.getExercicio(id as string);
      setExercicio(exercicioData);
      const sub = await api.getSubmissao(id as string);
      if (sub) setExistingSubmission(sub);
    } catch (error) {
      console.error('Error loading exercise:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlternativa = (questaoId: string, letra: string) => {
    if (existingSubmission) return;
    setRespostas((prev) => ({ ...prev, [questaoId]: letra }));
  };

  const handleTextChange = (questaoId: string, text: string) => {
    if (existingSubmission) return;
    setRespostas((prev) => ({ ...prev, [questaoId]: text }));
  };

  const handleSubmit = async () => {
    if (!exercicio?.questoes) return;
    const unanswered = exercicio.questoes.filter((q) => !respostas[q.id]);
    if (unanswered.length > 0) {
      Alert.alert(
        'Questões não respondidas',
        `Faltam ${unanswered.length} questão(ões). Enviar mesmo assim?`,
        [{ text: 'Não', style: 'cancel' }, { text: 'Sim', onPress: submitAnswers }]
      );
    } else {
      submitAnswers();
    }
  };

  const submitAnswers = async () => {
    setSubmitting(true);
    try {
      const respostasArray = Object.entries(respostas).map(([questaoId, resposta]) => ({
        questaoId, resposta
      }));

      const result = await api.submitExercicio(id as string, respostasArray);
      
      router.replace({
        pathname: '/resultado',
        params: {
          exercicioId: id as string,
          acertos: String(result.acertos),
          erros: String(result.erros),
          total: String(result.totalQuestoes),
          nota: String(result.nota),
          percentual: String(result.percentual),
          pontos: String(result.pontosGerados),
          detalhes: JSON.stringify(result.submissao.detalhesQuestoes),
        },
      });
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FFD700" /></View>;
  if (!exercicio) return <View style={styles.errorContainer}><Text style={styles.errorText}>Não encontrado</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{exercicio.titulo}</Text>
        <View style={{ width: 24 }} />
      </View>

      {existingSubmission && (
        <View style={styles.submittedBanner}>
          <Ionicons name="checkmark-circle" size={20} color={existingSubmission.nota >= 5 ? "#32CD32" : "#E74C3C"} />
          <Text style={[styles.submittedText, { color: existingSubmission.nota >= 5 ? "#32CD32" : "#E74C3C" }]}>
            Nota Final: {existingSubmission.nota}
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {exercicio.descricao && <Text style={styles.description}>{exercicio.descricao}</Text>}

        {exercicio.questoes?.map((questao, index) => (
          <View key={questao.id} style={styles.questaoCard}>
            <View style={styles.questaoHeader}>
              <View style={styles.questaoNumero}><Text style={styles.questaoNumeroText}>{questao.numero}</Text></View>
              <Text style={styles.questaoPontos}>{questao.pontuacaoMax} pt(s)</Text>
            </View>

            <Text style={styles.questaoEnunciado}>{questao.enunciado}</Text>

            {questao.tipoResposta === 'MULTIPLA_ESCOLHA' ? (
              <View style={styles.alternativasContainer}>
                {questao.alternativas.map((alt, altIndex) => {
                  const isSelected = respostas[questao.id] === alt.letra;
                  let cor = alt.cor;
                  if (!cor || cor === '#4169E1') cor = ALTERNATIVA_CORES[altIndex % ALTERNATIVA_CORES.length];
                  
                  let statusStyle = {};
                  let statusIcon = null;
                  
                  if (existingSubmission) {
                    const detalhe = existingSubmission.detalhesQuestoes?.find((d: any) => d.questaoId === questao.id);
                    if (detalhe) {
                      if (alt.letra === detalhe.correta) {
                        statusStyle = { borderColor: '#32CD32', borderWidth: 2 };
                        statusIcon = <Ionicons name="checkmark" size={20} color="#32CD32" />;
                      } else if (alt.letra === detalhe.resposta && !detalhe.acertou) {
                        statusStyle = { borderColor: '#E74C3C', borderWidth: 2 };
                        statusIcon = <Ionicons name="close" size={20} color="#E74C3C" />;
                      }
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={alt.letra}
                      style={[
                        styles.alternativa,
                        isSelected && { backgroundColor: cor + '40', borderColor: cor },
                        statusStyle,
                      ]}
                      onPress={() => handleSelectAlternativa(questao.id, alt.letra)}
                      disabled={!!existingSubmission}
                    >
                      <View style={[styles.alternativaLetra, { backgroundColor: cor }]}>
                        <Text style={styles.alternativaLetraText}>{alt.letra}</Text>
                      </View>
                      <Text style={styles.alternativaTexto}>{alt.texto}</Text>
                      {statusIcon && <View style={styles.statusIcon}>{statusIcon}</View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="Sua resposta..."
                placeholderTextColor="#666"
                value={respostas[questao.id] || ''}
                onChangeText={(text) => handleTextChange(questao.id, text)}
                editable={!existingSubmission}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {/* AÇÕES RODAPÉ: Apenas Enviar ou Voltar, sem opção de tentar novamente */}
      {!existingSubmission ? (
        <TouchableOpacity style={[styles.submitButton, submitting && {opacity:0.5}]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitButtonText}>Enviar Respostas</Text>}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.backToExercises} onPress={() => router.back()}>
          <Text style={styles.backToExercisesText}>Voltar para Atividades</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c0c' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor:'#0c0c0c' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#666', fontSize: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  submittedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222', padding: 10, gap: 8, borderBottomWidth:1, borderBottomColor:'#333' },
  submittedText: { fontWeight: 'bold', fontSize: 16 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  description: { color: '#888', fontSize: 14, marginBottom: 20 },
  questaoCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  questaoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  questaoNumero: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFD700', alignItems: 'center', justifyContent: 'center' },
  questaoNumeroText: { color: '#000', fontWeight: 'bold' },
  questaoPontos: { color: '#888', fontSize: 12 },
  questaoEnunciado: { color: '#fff', fontSize: 16, marginBottom: 16, lineHeight: 22 },
  alternativasContainer: { gap: 10 },
  alternativa: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252540', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'transparent' },
  alternativaLetra: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alternativaLetraText: { color: '#000', fontWeight: 'bold' },
  alternativaTexto: { flex: 1, color: '#fff' },
  statusIcon: { marginLeft: 8 },
  textInput: { backgroundColor: '#252540', borderRadius: 12, padding: 12, color: '#fff', minHeight: 50 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD700', margin: 16, padding: 16, borderRadius: 12 },
  submitButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
  backToExercises: { alignItems: 'center', paddingVertical: 16, margin: 16, backgroundColor: '#1a1a2e', borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  backToExercisesText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
