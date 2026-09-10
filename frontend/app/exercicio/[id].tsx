import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
import { Exercicio } from '../../src/types';
import { useTema, CoresTema } from '../../src/context/ThemeContext';

const ALTERNATIVA_CORES = [
  '#E74C3C', '#F39C12', '#27AE60', '#4169E1', '#9B59B6'
];

export default function ExercicioScreen() {
  const { cores } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
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
    if (submitting) return; // Proteção extra contra duplo clique
    setSubmitting(true);
    
    try {
      const respostasArray = Object.entries(respostas).map(([questaoId, resposta]) => ({
        questaoId, resposta
      }));

      const result = await api.submitExercicio(id as string, respostasArray);
      
      // Delay de segurança para garantir que a UI atualize antes de navegar
      setTimeout(() => {
        router.replace({
          pathname: '/resultado',
          params: {
            exercicioId: id as string,
            acertos: String(result.acertos),
            erros: String(result.erros),
            total: String(result.totalQuestoes),
            nota: String(result.nota),
            percentual: String(result.percentual || 0), // Garante que não vá nulo
            pontos: String(result.pontosGerados),
            detalhes: JSON.stringify(result.submissao?.detalhesQuestoes || []),
          },
        });
      }, 500);

    } catch (error: any) {
      setSubmitting(false);
      Alert.alert('Erro', error.response?.data?.detail || 'Erro ao enviar respostas.');
    }
  };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={cores.dourado} /></View>;
  if (!exercicio) return <View style={styles.errorContainer}><Text style={styles.errorText}>Não encontrado</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={cores.texto} /></TouchableOpacity>
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
                  if (!cor || cor === cores.azul) cor = ALTERNATIVA_CORES[altIndex % ALTERNATIVA_CORES.length];
                  
                  let statusStyle = {};
                  let statusIcon = null;
                  
                  if (existingSubmission) {
                    const detalhe = existingSubmission.detalhesQuestoes?.find((d: any) => d.questaoId === questao.id);
                    if (detalhe) {
                      if (alt.letra === detalhe.correta) {
                        statusStyle = { borderColor: cores.sucesso, borderWidth: 2 };
                        statusIcon = <Ionicons name="checkmark" size={20} color={cores.sucesso} />;
                      } else if (alt.letra === detalhe.resposta && !detalhe.acertou) {
                        statusStyle = { borderColor: cores.erro, borderWidth: 2 };
                        statusIcon = <Ionicons name="close" size={20} color={cores.erro} />;
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
                placeholderTextColor={cores.textoFraco}
                value={respostas[questao.id] || ''}
                onChangeText={(text) => handleTextChange(questao.id, text)}
                editable={!existingSubmission}
              />
            )}
          </View>
        ))}
      </ScrollView>

      {/* BOTÃO DE ENVIAR (Protegido contra cliques múltiplos) */}
      {!existingSubmission ? (
        <TouchableOpacity 
          style={[styles.submitButton, submitting && {opacity:0.5}]} 
          onPress={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color={cores.sobreAcento} /> : <Text style={styles.submitButtonText}>Enviar Respostas</Text>}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.backToExercises} onPress={() => router.back()}>
          <Text style={styles.backToExercisesText}>Voltar para Atividades</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const criarEstilos = (cores: CoresTema) => StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.fundo },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor:cores.fundo },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: cores.textoFraco, fontSize: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerTitle: { flex: 1, color: cores.texto, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  submittedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficieAlt, padding: 10, gap: 8, borderBottomWidth:1, borderBottomColor:cores.borda },
  submittedText: { fontWeight: 'bold', fontSize: 16 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  description: { color: cores.textoFraco, fontSize: 14, marginBottom: 20 },
  questaoCard: { backgroundColor: cores.superficie, borderRadius: 16, padding: 16, marginBottom: 16 },
  questaoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  questaoNumero: { width: 30, height: 30, borderRadius: 15, backgroundColor: cores.dourado, alignItems: 'center', justifyContent: 'center' },
  questaoNumeroText: { color: cores.sobreAcento, fontWeight: 'bold' },
  questaoPontos: { color: cores.textoFraco, fontSize: 12 },
  questaoEnunciado: { color: cores.texto, fontSize: 16, marginBottom: 16, lineHeight: 22 },
  alternativasContainer: { gap: 10 },
  alternativa: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.superficieAlt, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'transparent' },
  alternativaLetra: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  alternativaLetraText: { color: cores.texto, fontWeight: 'bold' },
  alternativaTexto: { flex: 1, color: cores.texto },
  statusIcon: { marginLeft: 8 },
  textInput: { backgroundColor: cores.superficieAlt, borderRadius: 12, padding: 12, color: cores.texto, minHeight: 50 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.dourado, margin: 16, padding: 16, borderRadius: 12 },
  submitButtonText: { color: cores.sobreAcento, fontSize: 18, fontWeight: 'bold' },
  backToExercises: { alignItems: 'center', paddingVertical: 16, margin: 16, backgroundColor: cores.superficie, borderRadius: 12, borderWidth: 1, borderColor: cores.borda },
  backToExercisesText: { color: cores.texto, fontSize: 16, fontWeight: '600' },
});
