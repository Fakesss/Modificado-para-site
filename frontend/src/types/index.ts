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
}

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
  pergunta: string;
  tipo: string;
  alternativas?: string[];
  respostaCorreta?: string;
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
  usuarioId?: string; // 🚨 A trava de usuário
  alunoId?: string;   // 🚨 A trava extra pro padrão do seu Painel
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
  ordem: number;
  abaCategoria: string;
  pasta?: string;
  pontos?: number;
  turmaId?: string;
  equipeId?: string;
  usuarioId?: string; // 🚨 A trava de usuário
  alunoId?: string;   // 🚨 A trava extra pro padrão do seu Painel
  ativo: boolean;
  is_deleted?: boolean;
}
