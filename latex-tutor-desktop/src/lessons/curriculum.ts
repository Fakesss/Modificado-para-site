import type { Lesson, Module } from "./types";
import { module1 } from "./modules/module1";
import { module2 } from "./modules/module2";
import { module3 } from "./modules/module3";
import { module4 } from "./modules/module4";
import { module5 } from "./modules/module5";
import { module6 } from "./modules/module6";
import { module7 } from "./modules/module7";
import { module8 } from "./modules/module8";
import { module9 } from "./modules/module9";

export type { Lesson, Module } from "./types";

export const modules: Module[] = [
  { id: "m1", title: "Primeiros passos", description: "O básico para escrever e compilar seu primeiro documento em LaTeX." },
  { id: "m2", title: "Formatação de texto", description: "Negrito, itálico, cores, listas e os detalhes que deixam o texto com cara de documento pronto." },
  { id: "m3", title: "Matemática", description: "Frações, potências, equações, matrizes, limites, integrais e toda a notação matemática." },
  { id: "m4", title: "Tabelas e organização", description: "Tabelas simples, coloridas, mescladas e quadros prontos para provas e atividades." },
  { id: "m5", title: "Imagens e figuras", description: "Inserir, posicionar, legendar e organizar imagens no documento." },
  { id: "m6", title: "Desenhos com TikZ", description: "Formas geométricas, plano cartesiano, gráficos de função, fluxogramas e árvores." },
  { id: "m7", title: "Documentos completos", description: "Trabalhos, provas, planos de aula, referências e apresentações de slides." },
  {
    id: "m8",
    title: "Malhas e planos para professores",
    description: "Malhas quadriculadas, coordenadas estilo A1/B2, planos cartesianos e atividades prontas para imprimir."
  },
  {
    id: "m9",
    title: "Posicionamento e coordenadas no TikZ",
    description: "Origem, eixos, coordenadas locais vs. da página, ponto médio, coordenadas polares e overlay."
  }
];

export const lessons: Lesson[] = [
  ...module1,
  ...module2,
  ...module3,
  ...module4,
  ...module5,
  ...module6,
  ...module7,
  ...module8,
  ...module9
];

export function lessonsByModule(moduleId: string): Lesson[] {
  return lessons.filter((l) => l.moduleId === moduleId).sort((a, b) => a.order - b.order);
}
