import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Exercicio, Questao } from '../../src/types';

const ALTERNATIVA_CORES = [
  '#E74C3C', // A - Red
  '#F39C12', // B - Orange  
  '#27AE60', // C - Green
  '#3498DB', // D - Blue
  '#9B59B6', // E - Purple
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

      // Check for existing submission
      const sub = await api.getSubmissao(id as string);
      if (sub) setExistingSubmission(sub);
    } catch (error) {
      console.error('Error loading exercise:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlternativa = (questaoId: string, letra: string) => {
    if (existingSubmission) return; // Don't allow changes if already submitted
    setRespostas((prev) => ({
      ...prev,
      [questaoId]: letra,
    }));
  };

  const handleTextChange = (questaoId: string, text: string) => {
    if (existingSubmission) return;
    setRespostas((prev) => ({
      ...prev,
      [questaoId]: text,
    }));
  };

  const handleSubmit = async () => {
    if (!exercicio?.questoes) return;

    // Check if all questions are answered
    const unanswered = exercicio.questoes.filter((q) => !respostas[q.id]);
    if (unanswered.length > 0) {
      Alert.alert(
        'Questões não respondidas',
        `Você ainda não respondeu ${unanswered.length} questão(oes). Deseja enviar mesmo assim?`,
        [
          { text: 'Não', style: 'cancel' },
          { text: 'Sim, enviar', onPress: submitAnswers },
        ]
      );
    } else {
      submitAnswers();
    }
  };

  const submitAnswers = async () => {
    setSubmitting(true);
    try {
      const respostasArray = Object.entries(respostas).map(([questaoId, resposta]) => ({
        questaoId,
        resposta,
      }));

      const result = await api.submitExercicio(id as string, respostasArray);
      
      // Navigate to result screen
      router.replace({
        pathname: '/resultado',
        params: {
          exercicioId: id as string,
          acertos: result.acertos,
          erros: result.erros,
          total: result.totalQuestoes,
          nota: result.nota,
          percentual: result.percentual,
          pontos: result.pontosGerados,
          detalhes: JSON.stringify(result.submissao.detalhesQuestoes),
        },
      });
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
        </View>
      </SafeAreaView>
    );
  }

  if (!exercicio) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Exercício não encontrado</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {exercicio.titulo}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {existingSubmission && (
        <View style={styles.submittedBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#32CD32" />
          <Text style={styles.submittedText}>
            Já respondido - Nota: {existingSubmission.nota}
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {exercicio.descricao && (
          <Text style={styles.description}>{exercicio.descricao}</Text>
        )}

        {exercicio.questoes?.map((questao, index) => (
          <View key={questao.id} style={styles.questaoCard}>
            <View style={styles.questaoHeader}>
              <View style={styles.questaoNumero}>
                <Text style={styles.questaoNumeroText}>{questao.numero}</Text>
              </View>
              <Text style={styles.questaoPontos}>{questao.pontuacaoMax} pt(s)</Text>
            </View>

            <Text style={styles.questaoEnunciado}>{questao.enunciado}</Text>

            {questao.imagemBase64 && (
              <Image
                source={{ uri: `data:image/png;base64,${questao.imagemBase64}` }}
                style={styles.questaoImagem}
                resizeMode="contain"
              />
            )}

            {questao.tipoResposta === 'MULTIPLA_ESCOLHA' ? (
              <View style={styles.alternativasContainer}>
                {questao.alternativas.map((alt, altIndex) => {
                  const isSelected = respostas[questao.id] === alt.letra;
                  const cor = alt.cor || ALTERNATIVA_CORES[altIndex % ALTERNATIVA_CORES.length];
                  
                  // Show correct/incorrect for submitted answers
                  let statusStyle = {};
                  let statusIcon = null;
                  if (existingSubmission) {
                    const detalhe = existingSubmission.detalhesQuestoes?.find(
                      (d: any) => d.questaoId === questao.id
                    );
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
                placeholder="Digite sua resposta..."
                placeholderTextColor="#666"
                value={respostas[questao.id] || ''}
                onChangeText={(text) => handleTextChange(questao.id, text)}
                multiline
                editable={!existingSubmission}
              />
            )}
          </View>
        ))}

        {exercicio.questoes?.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>Nenhuma questão disponível</Text>
          </View>
        )}
      </ScrollView>

      {!existingSubmission && exercicio.questoes && exercicio.questoes.length > 0 && (
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#000" />
              <Text style={styles.submitButtonText}>Enviar Respostas</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {existingSubmission && (
        <TouchableOpacity style={styles.backToExercises} onPress={() => router.back()}>
          <Text style={styles.backToExercisesText}>Voltar para Atividades</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FFD700',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 16,
  },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#32CD32' + '30',
    paddingVertical: 8,
    gap: 8,
  },
  submittedText: {
    color: '#32CD32',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  description: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  questaoCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  questaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  questaoNumero: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questaoNumeroText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  questaoPontos: {
    color: '#888',
    fontSize: 12,
  },
  questaoEnunciado: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  questaoImagem: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  alternativasContainer: {
    gap: 10,
  },
  alternativa: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alternativaLetra: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alternativaLetraText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  alternativaTexto: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  statusIcon: {
    marginLeft: 8,
  },
  textInput: {
    backgroundColor: '#252540',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backToExercises: {
    alignItems: 'center',
    paddingVertical: 16,
    margin: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  backToExercisesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
