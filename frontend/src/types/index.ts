export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'ALUNO_LIDER' | 'ALUNO';
  turmaId?: string;
  equipeId?: string;
  ativo: boolean;
  streakDias: number;
  streakUltimoLoginData?: string;
  pontosTotais: number;
}

export interface Turma {
  id: string;
  nome: string;
  anoLetivo: number;
  ativa: boolean;
}

export interface Equipe {
  id: string;
  nome: string;
  cor: string;
  turmaId?: string;
  pontosTotais: number;
}

export interface RankingItem {
  id: string;
  nome: string;
  cor: string;
  pontosTotais: number;
  posicao: number;
}

export interface Conteudo {
  id: string;
  tipo: 'VIDEO' | 'LINK' | 'MATERIAL';
  titulo: string;
  descricao?: string;
  urlVideo?: string;
  arquivo?: string;
  ordem: number;
  abaCategoria: string;
  turmaId?: string;
  ativo: boolean;
}

export interface Alternativa {
  letra: string;
  texto: string;
  cor: string;
}

export interface Questao {
  id: string;
  exercicioId: string;
  numero: number;
  tipoResposta: 'MULTIPLA_ESCOLHA' | 'TEXTO';
  enunciado: string;
  imagemBase64?: string;
  alternativas: Alternativa[];
  correta: string;
  pontuacaoMax: number;
  habilidadesBNCC: string[];
}

export interface Exercicio {
  id: string;
  titulo: string;
  descricao?: string;
  modoCriacao: 'PDF' | 'MANUAL';
  pdfArquivo?: string;
  habilidadesBNCC: string[];
  ativo: boolean;
  turmaId?: string;
  equipeId?: string;
  pontosPorQuestao: number;
  questoes?: Questao[];
}

export interface ProgressoVideo {
  id: string;
  conteudoId: string;
  usuarioId: string;
  tempoAssistidoSeg: number;
  duracaoSeg: number;
  concluido: boolean;
  dataConclusao?: string;
  pontosGerados: number;
}

export interface Submissao {
  id: string;
  exercicioId: string;
  usuarioId: string;
  data: string;
  acertos: number;
  erros: number;
  nota: number;
  pontosGerados: number;
  detalhesQuestoes: DetalheQuestao[];
}

export interface DetalheQuestao {
  questaoId: string;
  numero: number;
  resposta: string;
  correta: string;
  acertou: boolean;
  habilidadesBNCC: string[];
}
