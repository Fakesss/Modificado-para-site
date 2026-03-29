// ... mantenha o restante do arquivo igual e atualize estas interfaces:

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
  equipeId?: string;   // 🚨 ADICIONADO
  usuarioId?: string;  // 🚨 ADICIONADO
  ativo: boolean;
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
  usuarioId?: string; // 🚨 ADICIONADO
  pontosPorQuestao: number;
  questoes?: Questao[];
}
