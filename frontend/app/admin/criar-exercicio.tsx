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
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../src/services/api';
// Se você tiver tipos definidos para Equipe e Aluno, importe-os aqui. 
// Caso contrário, o código usará 'any' para evitar erros.
import { Turma } from '../../src/types'; 

const ALTERNATIVA_CORES = [
  { letra: 'A', cor: '#E74C3C' },
  { letra: 'B', cor: '#F39C12' },
  { letra: 'C', cor: '#27AE60' },
  { letra: 'D', cor: '#3498DB' },
  { letra: 'E', cor: '#9B59B6' },
];

interface QuestaoForm {
  id: string;
  numero: number;
  tipoResposta: 'MULTIPLA_ESCOLHA' | 'TEXTO';
  enunciado: string;
  alternativas: { letra: string; texto: string; cor: string }[];
  correta: string;
}

type TipoDestinatario = 'TURMA' | 'EQUIPE' | 'ALUNO';

export default function CriarExercicio() {
  const router = useRouter();
  
  // Dados das listas
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]); // Use o tipo correto se tiver
  const [alunos, setAlunos] = useState<any[]>([]);   // Use o tipo correto se tiver

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  
  // Formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontuacaoTotal, setPontuacaoTotal] = useState('10');
  const [habilidadesBNCC, setHabilidadesBNCC] = useState('');
  
  // Controle de Destinatário
  const [tipoDestinatario, setTipoDestinatario] = useState<TipoDestinatario>('TURMA');
  const [destinatarioId, setDestinatarioId] = useState('');
  
  const [questoes, setQuestoes] = useState<QuestaoForm[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    try {
      // Carrega Turmas
      const turmasData = await api.getTurmas();
      setTurmas(turmasData);

      // Tenta carregar Equipes (se a função existir na API)
      if ((api as any).getEquipes) {
        const equipesData = await (api as any).getEquipes();
        setEquipes(equipesData);
      }

      // Tenta carregar Alunos (se a função existir na API)
      if ((api as any).getAlunos) {
        const alunosData = await (api as any).getAlunos();
        setAlunos(alunosData);
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const addQuestao = () => {
    const novaQuestao: QuestaoForm = {
      id: `q-${Date.now()}`,
      numero: questoes.length + 1,
      tipoResposta: 'MULTIPLA_ESCOLHA',
      enunciado: '',
      alternativas: ALTERNATIVA_CORES.slice(0, 4).map((a) => ({
        letra: a.letra,
        texto: '',
        cor: a.cor,
      })),
      correta: '',
    };
    setQuestoes([...questoes, novaQuestao]);
  };

  const removeQuestao = (index: number) => {
    const newQuestoes = questoes.filter((_, i) => i !== index);
    newQuestoes.forEach((q, i) => {
      q.numero = i + 1;
    });
    setQuestoes(newQuestoes);
  };

  const updateQuestao = (index: number, field: keyof QuestaoForm, value: any) => {
    const newQuestoes = [...questoes];
    newQuestoes[index] = { ...newQuestoes[index], [field]: value };
    setQuestoes(newQuestoes);
  };

  const updateAlternativa = (qIndex: number, altIndex: number, texto: string) => {
    const newQuestoes = [...questoes];
    newQuestoes[qIndex].alternativas[altIndex].texto = texto;
    setQuestoes(newQuestoes);
  };

  const handleSave = async () => {
    // Validações Básicas
    if (!titulo.trim()) {
      Alert.alert('Erro', 'O título é obrigatório.');
      return;
    }
    if (questoes.length === 0) {
      Alert.alert('Erro', 'Adicione pelo menos uma questão.');
      return;
    }
    const pontos = Number(pontuacaoTotal.replace(/[^0-9.]/g, ''));
    if (!pontos || pontos <= 0) {
      Alert.alert('Erro', 'A pontuação total deve ser maior que zero.');
      return;
    }

    // Validações das Questões
    for (const q of questoes) {
      if (!q.enunciado.trim()) {
        Alert.alert('Erro', `A Questão ${q.numero} está sem enunciado.`);
        return;
      }
      if (q.tipoResposta === 'MULTIPLA_ESCOLHA' && !q.correta) {
        Alert.alert('Erro', `Selecione a alternativa correta na Questão ${q.numero}.`);
        return;
      }
      if (q.tipoResposta === 'TEXTO' && !q.correta.trim()) {
        Alert.alert('Erro', `Informe a resposta esperada na Questão ${q.numero}.`);
        return;
      }
    }

    setLoading(true); // Ativa o modal de carregamento

    try {
      const habilidades = habilidadesBNCC
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h);

      const valorPorQuestao = pontos / questoes.length;

      // Monta o objeto para o Backend
      // Nota: O backend precisa aceitar equipeId ou alunoId se selecionado
      const exercicioData = {
        titulo,
        descricao,
        modoCriacao: 'MANUAL',
        habilidadesBNCC: habilidades,
        pontosPorQuestao: valorPorQuestao,
        
        // Lógica de Destinatário
        turmaId: tipoDestinatario === 'TURMA' && destinatarioId ? destinatarioId : undefined,
        equipeId: tipoDestinatario === 'EQUIPE' && destinatarioId ? destinatarioId : undefined,
        alunoId: tipoDestinatario === 'ALUNO' && destinatarioId ? destinatarioId : undefined,

        questoes: questoes.map((q) => ({
          numero: q.numero,
          tipoResposta: q.tipoResposta,
          enunciado: q.enunciado,
          alternativas: q.alternativas.filter((a) => a.texto.trim()),
          correta: q.correta,
          pontuacaoMax: valorPorQuestao,
          habilidadesBNCC: habilidades,
        })),
      };

      await api.createExercicio(exercicioData);
      
      // Feedback visual claro
      Alert.alert('Sucesso!', 'Exercício salvo e enviado.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      
    } catch (error: any) {
      console.log("=== ERRO AO SALVAR ===");
      console.log(error);
      
      let mensagemErro = 'Não foi possível salvar. Verifique sua conexão.';
      
      if (error.response?.data?.detail) {
        const detalhe = error.response.data.detail;
        mensagemErro = typeof detalhe === 'string' ? detalhe : "Verifique os dados preenchidos.";
      }
      Alert.alert('Erro ao Salvar', mensagemErro);
    } finally {
      setLoading(false);
    }
  };

  // Renderização das opções de destinatário
  const renderDestinatarios = () => {
    let dados = [];
    let placeholder = "";

    if (tipoDestinatario === 'TURMA') {
      dados = turmas;
      placeholder = "Selecione uma Turma";
    } else if (tipoDestinatario === 'EQUIPE') {
      dados = equipes;
      placeholder = "Selecione uma Equipe";
    } else {
      dados = alunos;
      placeholder = "Selecione um Aluno";
    }

    if (loadingData)
