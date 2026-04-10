export interface User {
  id?: string;
  _id?: string;
  nome: string;
  email: string;
  role?: string;
  turmaId?: string;
  equipeId?: string;
  pontosTotais?: number;
  streakDias?: number;
  ultimoAcesso?: string;
  perfil?: string;
  senha?: string;
  ativo?: boolean;
}

export interface Usuario extends User {}

export interface Turma {
  id: string;
  nome: string;
}

export interface Equipe {
  id: string;
  nome: string;
  cor: string;
  turmaId?: string;
}

export interface RankingItem {
  id: string;
  nome: string;
  cor: string;
  pontosTotais: number;
  posicao?: number;
}

export interface Questao {
  id: string;
  // Propriedades do formato antigo
  pergunta?: string;
  tipo?: string;
  respostaCorreta?: string;
  // Propriedades do formato novo
  numero?: number;
  tipoResposta?: string;
  enunciado?: string;
  imagemBase64?: string;
  alternativas?: any; 
  correta?: string;
  pontuacaoMax?: number;
  habilidadesBNCC?: string[];
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
  usuarioId?: string;
  alunoId?: string;
  pontosPorQuestao: number;
  questoes?: Questao[];
}

export interface Conteudo {
  id: string;
  tipo: 'VIDEO' | 'LINK' | 'MATERIAL';
  titulo: string;
  descricao?: string;
  urlVideo?: string;
  arquivo?: string;
  thumbnail?: string; 
  ordem: number;
  abaCategoria: string;
  pasta?: string;
  pontos?: number;
  turmaId?: string;
  equipeId?: string;
  usuarioId?: string;
  alunoId?: string;
  ativo: boolean;
  is_deleted?: boolean;
}
