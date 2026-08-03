import type { Lesson } from "../types";

export const module4: Lesson[] = [
  {
    id: "m4-01-tabelas-simples",
    moduleId: "m4",
    order: 1,
    title: "Tabelas simples e alinhamento de colunas",
    engine: "pdflatex",
    explanation:
      "O ambiente tabular cria tabelas. A declaração {lcr} logo depois define o número de colunas e seu " +
      "alinhamento: l (esquerda), c (centro), r (direita). Dentro da tabela, & separa colunas e \\\\ separa linhas.",
    example: {
      description: "Tabela com três colunas alinhadas de formas diferentes.",
      code: "\\documentclass{article}\n\\begin{document}\n\n\\begin{tabular}{lcr}\n  Nome & Nota & Situação \\\\\n  Ana & 8.5 & Aprovada \\\\\n  Bruno & 4.0 & Recuperação \\\\\n\\end{tabular}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\n\\begin{tabular}{lc}\n  Nome & Nota \\\\\n  Ana & 8.5 \\\\\n\\end{tabular}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma terceira coluna e uma segunda linha de aluno.",
    challenge: "Monte uma tabela com 3 colunas (Aluno, Prova 1, Prova 2) e 3 alunos.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% tabela de notas\n\n\\end{document}\n",
    hints: ["O número de letras em {lcr} precisa bater com o número de colunas.", "Toda linha da tabela (menos a última) termina com \\\\."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\begin{tabular}{lcc}\n  Aluno & Prova 1 & Prova 2 \\\\\n  Ana & 8.0 & 9.0 \\\\\n  Bruno & 7.5 & 6.0 \\\\\n  Carla & 9.5 & 8.5 \\\\\n\\end{tabular}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{tabular}", "&", "\\\\"]
  },
  {
    id: "m4-02-bordas-profissionais",
    moduleId: "m4",
    order: 2,
    title: "Bordas com aparência profissional",
    engine: "pdflatex",
    explanation:
      "O pacote booktabs adiciona \\toprule, \\midrule e \\bottomrule: linhas horizontais mais elegantes que o \\hline " +
      "padrão, usadas no topo, entre o cabeçalho e os dados, e no final da tabela.",
    example: {
      description: "A mesma tabela de notas com bordas do booktabs.",
      code: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lcc}\n  \\toprule\n  Aluno & Prova 1 & Prova 2 \\\\\n  \\midrule\n  Ana & 8.0 & 9.0 \\\\\n  Bruno & 7.5 & 6.0 \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lc}\n  \\toprule\n  Nome & Nota \\\\\n  \\midrule\n  Ana & 8.5 \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n",
    guidedInstructions: "Adicione mais uma linha de aluno antes do \\bottomrule.",
    challenge: "Reescreva a tabela do exercício anterior (3 alunos, 2 provas) usando toprule/midrule/bottomrule em vez de nada.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n% tabela com bordas do booktabs\n\n\\end{document}\n",
    hints: ["\\midrule vai uma única vez, logo após a linha do cabeçalho.", "Evite usar \\hline junto com booktabs — o visual fica melhor só com toprule/midrule/bottomrule."],
    solution:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lcc}\n  \\toprule\n  Aluno & Prova 1 & Prova 2 \\\\\n  \\midrule\n  Ana & 8.0 & 9.0 \\\\\n  Bruno & 7.5 & 6.0 \\\\\n  Carla & 9.5 & 8.5 \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n",
    commandsLearned: ["\\toprule", "\\midrule", "\\bottomrule"]
  },
  {
    id: "m4-03-celulas-mescladas",
    moduleId: "m4",
    order: 3,
    title: "Células mescladas",
    engine: "pdflatex",
    explanation:
      "\\multicolumn{n}{alinhamento}{texto} mescla n colunas em uma célula só, útil para títulos que abrangem " +
      "várias colunas. Com o pacote multirow, \\multirow{n}{*}{texto} mescla células na vertical.",
    example: {
      description: "Um título mesclando duas colunas com multicolumn.",
      code: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lcc}\n  \\toprule\n  \\multicolumn{3}{c}{Boletim do 1º Bimestre} \\\\\n  \\midrule\n  Aluno & Prova & Trabalho \\\\\n  Ana & 8.0 & 9.0 \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lcc}\n  \\toprule\n  \\multicolumn{3}{c}{Título da tabela}\\\\\n  \\midrule\n  A & B & C \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n",
    guidedInstructions: "Troque o título mesclado e os valores da tabela.",
    challenge: "Crie uma tabela de horários com um título mesclado em 4 colunas no topo (\"Horário — Turma 7ºA\").",
    challengeStarter: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n% tabela de horário\n\n\\end{document}\n",
    hints: ["O número em \\multicolumn{n}{...} precisa bater com quantas colunas você quer mesclar."],
    solution:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lccc}\n  \\toprule\n  \\multicolumn{4}{c}{Horário --- Turma 7ºA} \\\\\n  \\midrule\n  Segunda & Terça & Quarta & Quinta \\\\\n  Matemática & Português & Ciências & Matemática \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n",
    commandsLearned: ["\\multicolumn", "\\multirow"]
  },
  {
    id: "m4-04-tabelas-coloridas",
    moduleId: "m4",
    order: 4,
    title: "Tabelas coloridas",
    engine: "pdflatex",
    explanation:
      "Carregando xcolor com a opção table (\\usepackage[table]{xcolor}), \\rowcolor{cor} pinta o fundo de uma " +
      "linha inteira da tabela, útil para destacar o cabeçalho ou alternar cores entre linhas.",
    example: {
      description: "Cabeçalho colorido e uma linha destacada.",
      code: "\\documentclass{article}\n\\usepackage[table]{xcolor}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lc}\n  \\rowcolor{blue!20}\n  Aluno & Nota \\\\\n  Ana & 8.5 \\\\\n  \\rowcolor{yellow!20}\n  Bruno & 4.0 \\\\\n\\end{tabular}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage[table]{xcolor}\n\\begin{document}\n\n\\begin{tabular}{lc}\n  \\rowcolor{blue!20}\n  Nome & Nota \\\\\n  Ana & 8.5 \\\\\n\\end{tabular}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma segunda linha de dados com uma cor diferente de \\rowcolor.",
    challenge: "Faça uma tabela de 3 linhas de dados onde alunos com nota abaixo de 6 aparecem com \\rowcolor vermelho claro.",
    challengeStarter: "\\documentclass{article}\n\\usepackage[table]{xcolor}\n\\begin{document}\n\n% tabela com linhas coloridas\n\n\\end{document}\n",
    hints: ["\\rowcolor precisa vir logo antes da linha que você quer colorir, dentro da tabela."],
    solution:
      "\\documentclass{article}\n\\usepackage[table]{xcolor}\n\\begin{document}\n\n\\begin{tabular}{lc}\n  \\rowcolor{blue!20}\n  Aluno & Nota \\\\\n  Ana & 8.0 \\\\\n  \\rowcolor{red!20}\n  Bruno & 4.5 \\\\\n  Carla & 7.0 \\\\\n\\end{tabular}\n\n\\end{document}\n",
    commandsLearned: ["\\rowcolor"]
  },
  {
    id: "m4-05-tabelas-grandes",
    moduleId: "m4",
    order: 5,
    title: "Tabelas grandes que quebram entre páginas",
    engine: "pdflatex",
    explanation:
      "Uma tabular normal não quebra entre páginas — se ela for maior que a página, o conteúdo é cortado. O " +
      "ambiente longtable (do pacote de mesmo nome) resolve isso, repetindo o cabeçalho automaticamente em cada página.",
    example: {
      description: "Uma tabela longa que se estende por mais de uma página.",
      code: "\\documentclass{article}\n\\usepackage{longtable}\n\\begin{document}\n\n\\begin{longtable}{lc}\n  Aluno & Nota \\\\\n  \\hline\n  \\endhead\n  Aluno 01 & 7.0 \\\\\n  Aluno 02 & 8.0 \\\\\n  Aluno 03 & 6.5 \\\\\n\\end{longtable}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{longtable}\n\\begin{document}\n\n\\begin{longtable}{lc}\n  Aluno & Nota \\\\\n  \\hline\n  \\endhead\n  Ana & 8.0 \\\\\n\\end{longtable}\n\n\\end{document}\n",
    guidedInstructions: "Adicione mais linhas de alunos à tabela longa.",
    challenge: "Crie uma longtable com uma lista de 10 alunos fictícios e suas notas.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{longtable}\n\\begin{document}\n\n% lista de 10 alunos\n\n\\end{document}\n",
    hints: ["\\endhead marca onde termina o cabeçalho que deve se repetir em cada página."],
    solution:
      "\\documentclass{article}\n\\usepackage{longtable}\n\\begin{document}\n\n\\begin{longtable}{lc}\n  Aluno & Nota \\\\\n  \\hline\n  \\endhead\n  Aluno 01 & 7.0 \\\\\n  Aluno 02 & 8.0 \\\\\n  Aluno 03 & 6.5 \\\\\n  Aluno 04 & 9.0 \\\\\n  Aluno 05 & 5.5 \\\\\n  Aluno 06 & 7.5 \\\\\n  Aluno 07 & 8.5 \\\\\n  Aluno 08 & 6.0 \\\\\n  Aluno 09 & 9.5 \\\\\n  Aluno 10 & 7.0 \\\\\n\\end{longtable}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{longtable}", "\\endhead"]
  },
  {
    id: "m4-06-quadros-atividades-provas",
    moduleId: "m4",
    order: 6,
    title: "Quadros de atividades e provas escolares",
    engine: "pdflatex",
    explanation:
      "Combinando tabelas, caixas (\\fbox) e listas, dá para montar cabeçalhos de prova (nome, data, turma) e " +
      "quadros de resposta profissionais — um dos usos mais práticos do LaTeX para professores.",
    example: {
      description: "Cabeçalho de prova com campos para o aluno preencher.",
      code: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{6cm}{0.4pt} \\\\\n  Turma: & \\rule{3cm}{0.4pt} \\quad Data: \\rule{3cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{1cm}\n\n\\begin{enumerate}\n  \\item Quanto é $7 \\times 8$?\n  \\item Resolva $2x + 4 = 10$.\n\\end{enumerate}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  Nome: & \\rule{6cm}{0.4pt} \\\\\n\\end{tabular}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma linha para Turma e Data, e uma questão de matemática logo abaixo.",
    challenge: "Monte um cabeçalho de prova completo (nome, turma, data) seguido de 3 questões numeradas.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n% cabeçalho de prova + questões\n\n\\end{document}\n",
    hints: ["\\rule{largura}{altura} desenha uma linha em branco para o aluno preencher.", "\\vspace{1cm} adiciona um espaço vertical entre o cabeçalho e as questões."],
    solution:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{6cm}{0.4pt} \\\\\n  Turma: & \\rule{3cm}{0.4pt} \\quad Data: \\rule{3cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{1cm}\n\n\\begin{enumerate}\n  \\item Quanto é $9 \\times 6$?\n  \\item Resolva $3x - 3 = 9$.\n  \\item Qual é a área de um quadrado de lado 5 cm?\n\\end{enumerate}\n\n\\end{document}\n",
    commandsLearned: ["\\rule", "\\vspace"]
  }
];
