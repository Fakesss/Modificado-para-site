import type { Lesson } from "../types";

export const module8: Lesson[] = [
  {
    id: "m8-01-malha-basica",
    moduleId: "m8",
    order: 1,
    title: "Malha quadriculada básica",
    engine: "pdflatex",
    explanation:
      "\\draw[step=1cm, gray] (0,0) grid (largura,altura); desenha uma malha quadriculada — a base para praticamente " +
      "todo material didático de geometria, plano cartesiano ou atividades de contagem. step define o tamanho de " +
      "cada quadradinho.",
    example: {
      description: "Uma malha simples de 6 por 4 quadrados.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (6,4);\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (4,4);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Mude o tamanho da malha para 8 por 6 quadrados.",
    challenge: "Crie uma malha quadrada de 10x10 (boa para atividades de contagem com alunos do fundamental 1).",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["O segundo par de coordenadas em \\draw (0,0) grid (x,y); define quantos quadrados de largura (x) e altura (y)."],
    solution: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (10,10);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["grid", "step="]
  },
  {
    id: "m8-02-malha-letras-numeros",
    moduleId: "m8",
    order: 2,
    title: "Malha com letras nas colunas e números nas linhas (estilo A1, B2, C3)",
    engine: "pdflatex",
    explanation:
      "Para identificar cada quadrado com um \"endereço\" (como no jogo de batalha naval ou em mapas), colocamos " +
      "letras acima das colunas e números ao lado das linhas usando \\foreach para repetir \\node automaticamente " +
      "em vez de escrever cada rótulo à mão.",
    example: {
      description: "Malha 5x4 com colunas A-E e linhas 1-4.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (5,4);\n  \\foreach \\x [count=\\i from 1] in {A,B,C,D,E}\n    \\node at (\\i-0.5, 4.3) {\\x};\n  \\foreach \\y [count=\\i from 1] in {1,2,3,4}\n    \\node at (-0.3, 4.5-\\i) {\\y};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (5,4);\n  \\foreach \\x [count=\\i from 1] in {A,B,C,D,E}\n    \\node at (\\i-0.5, 4.3) {\\x};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione o \\foreach dos números das linhas (copie do exemplo) para completar o \"endereço\" de cada quadrado.",
    challenge: "Crie uma malha 6x6 com colunas A-F e linhas 1-6 (tamanho de tabuleiro de batalha naval simplificado).",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (6,6);\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: [
      "[count=\\i from 1] cria um contador \\i que aumenta 1 a cada repetição do \\foreach, começando em 1.",
      "Para uma malha 6x6, a lista de letras precisa ter 6 itens: A,B,C,D,E,F."
    ],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (6,6);\n  \\foreach \\x [count=\\i from 1] in {A,B,C,D,E,F}\n    \\node at (\\i-0.5, 6.3) {\\x};\n  \\foreach \\y [count=\\i from 1] in {1,2,3,4,5,6}\n    \\node at (-0.3, 6.5-\\i) {\\y};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\foreach", "count="]
  },
  {
    id: "m8-03-identificacao-dentro-quadrados",
    moduleId: "m8",
    order: 3,
    title: "Escrevendo identificação dentro dos quadrados",
    engine: "pdflatex",
    explanation:
      "Para colocar um texto ou número centralizado DENTRO de um quadrado específico da malha, use \\node at " +
      "(x,y) {texto}; com as coordenadas do CENTRO daquele quadrado (meio inteiro, como 1.5 ou 2.5).",
    example: {
      description: "Três quadrados da malha preenchidos com texto.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (5,4);\n  \\node at (0.5,3.5) {X};\n  \\node at (2.5,1.5) {5};\n  \\node at (4.5,0.5) {\\checkmark};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (5,4);\n  \\node at (0.5,3.5) {X};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione números de 1 a 3 em três quadrados diferentes da malha.",
    challenge: "Preencha uma malha 4x4 com os números de 1 a 16, um em cada quadrado, em ordem.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (4,4);\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: [
      "As coordenadas do centro do quadrado da coluna i, linha j (contando de baixo, começando em 0) são (i+0.5, j+0.5).",
      "Você pode usar \\foreach com um contador para não precisar escrever os 16 \\node à mão."
    ],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray] (0,0) grid (4,4);\n  \\foreach \\n [count=\\i from 0] in {1,...,16}\n    \\node at (\\i-4*int(\\i/4)+0.5, 3.5-int(\\i/4)) {\\n};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\node at"]
  },
  {
    id: "m8-04-plano-cartesiano-coordenadas",
    moduleId: "m8",
    order: 4,
    title: "Plano cartesiano com coordenadas (1,2), (3,5)...",
    engine: "pdflatex",
    explanation:
      "Um plano cartesiano completo tem dois eixos perpendiculares (x e y) e pontos marcados em coordenadas " +
      "(x,y). Combinando o que você já sabe (eixos com seta e \\fill para marcar pontos), dá para montar planos " +
      "cartesianos prontos para atividades de localização de pontos.",
    example: {
      description: "Plano cartesiano com três pontos marcados e rotulados.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (0,0) grid (6,6);\n  \\draw[->] (0,0) -- (6.5,0) node[right] {$x$};\n  \\draw[->] (0,0) -- (0,6.5) node[above] {$y$};\n  \\fill (1,2) circle (2pt) node[above right] {$(1,2)$};\n  \\fill (3,5) circle (2pt) node[above right] {$(3,5)$};\n  \\fill (5,1) circle (2pt) node[above right] {$(5,1)$};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (0,0) grid (6,6);\n  \\draw[->] (0,0) -- (6.5,0) node[right] {$x$};\n  \\draw[->] (0,0) -- (0,6.5) node[above] {$y$};\n  \\fill (1,2) circle (2pt) node[above right] {$(1,2)$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Marque também os pontos (3,5) e (5,1), cada um com seu rótulo.",
    challenge: "Marque os quatro vértices de um retângulo: (1,1), (5,1), (5,4) e (1,4), e ligue-os com \\draw para desenhar o retângulo.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (0,0) grid (6,6);\n  \\draw[->] (0,0) -- (6.5,0) node[right] {$x$};\n  \\draw[->] (0,0) -- (0,6.5) node[above] {$y$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Você pode desenhar o retângulo com \\draw (1,1) -- (5,1) -- (5,4) -- (1,4) -- cycle;"],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (0,0) grid (6,6);\n  \\draw[->] (0,0) -- (6.5,0) node[right] {$x$};\n  \\draw[->] (0,0) -- (0,6.5) node[above] {$y$};\n  \\draw[thick, blue] (1,1) -- (5,1) -- (5,4) -- (1,4) -- cycle;\n  \\fill (1,1) circle (2pt) node[below left] {$(1,1)$};\n  \\fill (5,1) circle (2pt) node[below right] {$(5,1)$};\n  \\fill (5,4) circle (2pt) node[above right] {$(5,4)$};\n  \\fill (1,4) circle (2pt) node[above left] {$(1,4)$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["grid", "\\fill ... circle", "node[above right]"]
  },
  {
    id: "m8-05-pontos-no-cruzamento",
    moduleId: "m8",
    order: 5,
    title: "Pontos exatamente sobre o encontro das linhas",
    engine: "pdflatex",
    explanation:
      "Uma dúvida comum: os pontos do plano cartesiano ficam sempre nos CRUZAMENTOS das linhas da malha (números " +
      "inteiros), nunca dentro dos quadrados. Isso é diferente da Lição 3 (identificação dentro do quadrado). " +
      "Aqui praticamos marcar TODOS os cruzamentos de uma malha para reforçar essa diferença visualmente.",
    example: {
      description: "Todos os cruzamentos de uma malha 4x4 marcados com pontos.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!50] (0,0) grid (4,4);\n  \\foreach \\x in {0,1,2,3,4}\n    \\foreach \\y in {0,1,2,3,4}\n      \\fill (\\x,\\y) circle (1.5pt);\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!50] (0,0) grid (3,3);\n  \\foreach \\x in {0,1,2,3}\n    \\foreach \\y in {0,1,2,3}\n      \\fill (\\x,\\y) circle (1.5pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Aumente a malha para 5x5 e ajuste os dois \\foreach para cobrir os novos cruzamentos.",
    challenge: "Marque apenas os cruzamentos onde x é igual a y (a \"diagonal\") em uma malha 5x5, destacando-os em vermelho.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!50] (0,0) grid (5,5);\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Para a diagonal, um único \\foreach \\x in {0,...,5} \\fill[red] (\\x,\\x) circle (2pt); já resolve — não precisa do segundo loop."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!50] (0,0) grid (5,5);\n  \\foreach \\x in {0,1,2,3,4,5}\n    \\fill[red] (\\x,\\x) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\foreach ... \\foreach (loops aninhados)"]
  },
  {
    id: "m8-06-eixos-escala-negativos",
    moduleId: "m8",
    order: 6,
    title: "Eixos, escala e números negativos",
    engine: "pdflatex",
    explanation:
      "Um plano cartesiano completo (os quatro quadrantes) precisa de eixos que se estendam para coordenadas " +
      "negativas também. A malha e os eixos funcionam do mesmo jeito — só ajustamos os limites de \\draw ... grid " +
      "e das setas dos eixos para incluir valores negativos.",
    example: {
      description: "Plano cartesiano completo com os quatro quadrantes.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-4,-4) grid (4,4);\n  \\draw[->, thick] (-4.5,0) -- (4.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,-4.5) -- (0,4.5) node[above] {$y$};\n  \\fill (2,3) circle (2pt) node[above right] {$(2,3)$};\n  \\fill (-3,2) circle (2pt) node[above left] {$(-3,2)$};\n  \\fill (-2,-3) circle (2pt) node[below left] {$(-2,-3)$};\n  \\fill (3,-2) circle (2pt) node[below right] {$(3,-2)$};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-3,-3) grid (3,3);\n  \\draw[->, thick] (-3.5,0) -- (3.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,-3.5) -- (0,3.5) node[above] {$y$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Marque um ponto em cada um dos quatro quadrantes (positivo-positivo, negativo-positivo, etc).",
    challenge: "Desenhe o plano cartesiano completo e marque os pontos (-4,4), (4,4), (4,-4) e (-4,-4), ligando-os para formar um quadrado.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-5,-5) grid (5,5);\n  \\draw[->, thick] (-5.5,0) -- (5.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,-5.5) -- (0,5.5) node[above] {$y$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Um ponto \"negativo-positivo\" tem x negativo e y positivo, como (-3,2)."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-5,-5) grid (5,5);\n  \\draw[->, thick] (-5.5,0) -- (5.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,-5.5) -- (0,5.5) node[above] {$y$};\n  \\draw[thick, blue] (-4,4) -- (4,4) -- (4,-4) -- (-4,-4) -- cycle;\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["grid com coordenadas negativas"]
  },
  {
    id: "m8-07-personalizando-malha",
    moduleId: "m8",
    order: 7,
    title: "Personalizando espessura, cor e numeração da malha",
    engine: "pdflatex",
    explanation:
      "As opções dentro dos colchetes de \\draw controlam a aparência: thin/thick/very thick mudam a espessura, " +
      "qualquer cor do xcolor funciona (blue, red, cor!porcentagem para tons claros), e dashed/dotted mudam o " +
      "estilo da linha. Combine isso com \\foreach para numerar os eixos automaticamente.",
    example: {
      description: "Malha grossa azul com eixos numerados automaticamente.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, blue!30, very thick] (0,0) grid (5,5);\n  \\draw[->, thick] (0,0) -- (5.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,0) -- (0,5.5) node[above] {$y$};\n  \\foreach \\n in {1,2,3,4,5}\n    \\node at (\\n,-0.3) {\\n};\n  \\foreach \\n in {1,2,3,4,5}\n    \\node at (-0.3,\\n) {\\n};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray, thin] (0,0) grid (5,5);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Troque a malha para tracejada (dashed) e cor verde claro (green!30).",
    challenge: "Crie uma malha vermelha pontilhada (dotted) com eixos numerados de 1 a 6.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["dashed e dotted vão dentro dos colchetes junto com a cor, separados por vírgula: [step=1cm, red!50, dotted]."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, red!50, dotted] (0,0) grid (6,6);\n  \\draw[->, thick] (0,0) -- (6.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,0) -- (0,6.5) node[above] {$y$};\n  \\foreach \\n in {1,2,3,4,5,6}\n    \\node at (\\n,-0.3) {\\n};\n  \\foreach \\n in {1,2,3,4,5,6}\n    \\node at (-0.3,\\n) {\\n};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["thick", "very thick", "dashed", "dotted", "cor!porcentagem"]
  },
  {
    id: "m8-08-atividade-pronta-imprimir",
    moduleId: "m8",
    order: 8,
    title: "Montando uma atividade pronta para imprimir",
    engine: "pdflatex",
    explanation:
      "Juntando tudo deste módulo com o que você já sabia (cabeçalho de identificação, enunciados numerados), dá " +
      "para montar uma folha de atividade completa: cabeçalho + instrução + malha ou plano cartesiano + espaço de " +
      "resposta, pronta para imprimir e usar em sala.",
    example: {
      description: "Atividade completa: localizar pontos no plano cartesiano.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{7cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{0.5cm}\n\\textbf{Atividade:} Marque os pontos A(2,3), B(-1,4) e C(0,-2) no plano abaixo.\n\n\\begin{center}\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-4,-4) grid (4,4);\n  \\draw[->, thick] (-4.5,0) -- (4.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,-4.5) -- (0,4.5) node[above] {$y$};\n\\end{tikzpicture}\n\\end{center}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{7cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{0.5cm}\n\\textbf{Atividade:} Marque o ponto A(2,3) no plano abaixo.\n\n\\begin{center}\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-4,-4) grid (4,4);\n  \\draw[->, thick] (-4.5,0) -- (4.5,0) node[right] {$x$};\n  \\draw[->, thick] (0,-4.5) -- (0,4.5) node[above] {$y$};\n\\end{tikzpicture}\n\\end{center}\n\n\\end{document}\n",
    guidedInstructions: "Adicione mais dois pontos ao enunciado da atividade (B e C) para o aluno marcar.",
    challenge: "Monte uma atividade completa (cabeçalho + enunciado + malha quadriculada 8x8) pedindo para o aluno desenhar um triângulo unindo três quadrados específicos.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\usepackage{booktabs}\n\\begin{document}\n\n% cabeçalho + atividade + malha\n\n\\end{document}\n",
    hints: ["Reaproveite a tabela de cabeçalho de nome/turma que você já usou nos módulos de tabelas e documentos completos."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{7cm}{0.4pt} \\\\\n  Turma: & \\rule{3cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{0.5cm}\n\\textbf{Atividade:} Ligue os pontos (1,1), (6,1) e (3,6) para formar um triângulo na malha abaixo.\n\n\\begin{center}\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (0,0) grid (8,8);\n\\end{tikzpicture}\n\\end{center}\n\n\\end{document}\n",
    commandsLearned: ["combinação de tabela + texto + tikzpicture"]
  }
];
