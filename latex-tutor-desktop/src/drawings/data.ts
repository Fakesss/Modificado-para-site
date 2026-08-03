export interface Drawing {
  id: string;
  title: string;
  category: string;
  engine: "pdflatex" | "xelatex";
  code: string;
}

export const drawingCategories = [
  "Geometria",
  "Plano cartesiano e gráficos",
  "Organização",
  "Atividades escolares"
];

export const drawings: Drawing[] = [
  {
    id: "triangulo-medidas",
    title: "Triângulo com medidas dos lados",
    category: "Geometria",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (4,0) -- (1.5,3) -- cycle;\n  \\node at (2,-0.4) {4 cm};\n  \\node at (3.2,1.7) {3.4 cm};\n  \\node at (0.3,1.7) {3.6 cm};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "angulo-medida",
    title: "Ângulo com medida indicada",
    category: "Geometria",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (4,0);\n  \\draw[->] (0,0) -- (3,2.2);\n  \\draw (0.8,0) arc (0:36:0.8);\n  \\node at (1.2,0.35) {$36^\\circ$};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "circunferencia-raio",
    title: "Circunferência com raio indicado",
    category: "Geometria",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) circle (2cm);\n  \\fill (0,0) circle (1.5pt) node[below] {O};\n  \\draw (0,0) -- (2,0) node[midway, above] {r};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "poligono-regular",
    title: "Polígono regular (hexágono)",
    category: "Geometria",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[regular polygon, regular polygon sides=6, draw, minimum size=3cm] at (0,0) {};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "solido-cubo",
    title: "Cubo em perspectiva",
    category: "Geometria",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  % face da frente\n  \\draw (0,0) rectangle (2,2);\n  % face de trás (deslocada) \n  \\draw (0.8,0.8) rectangle (2.8,2.8);\n  % arestas ligando as duas faces\n  \\draw (0,0) -- (0.8,0.8);\n  \\draw (2,0) -- (2.8,0.8);\n  \\draw (0,2) -- (0.8,2.8);\n  \\draw (2,2) -- (2.8,2.8);\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "plano-cartesiano-pontos",
    title: "Plano cartesiano com pontos marcados",
    category: "Plano cartesiano e gráficos",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!40, thin] (-3,-3) grid (3,3);\n  \\draw[->] (-3,0) -- (3,0) node[right] {$x$};\n  \\draw[->] (0,-3) -- (0,3) node[above] {$y$};\n  \\fill (2,2) circle (2pt) node[above right] {$A(2,2)$};\n  \\fill (-2,1) circle (2pt) node[above left] {$B(-2,1)$};\n  \\fill (1,-2) circle (2pt) node[below right] {$C(1,-2)$};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "grafico-funcao-quadratica",
    title: "Gráfico de função quadrática",
    category: "Plano cartesiano e gráficos",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\n\\begin{tikzpicture}\n\\begin{axis}[xlabel=$x$, ylabel=$y$, title={$f(x) = x^2 - 4$}]\n  \\addplot[domain=-3:3, thick, blue] {x^2 - 4};\n\\end{axis}\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "grafico-funcao-linear-comparacao",
    title: "Comparação de duas retas",
    category: "Plano cartesiano e gráficos",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\n\\begin{tikzpicture}\n\\begin{axis}[xlabel=$x$, ylabel=$y$, legend pos=north west]\n  \\addplot[domain=-3:3, thick, blue] {2*x + 1};\n  \\addplot[domain=-3:3, thick, red] {-x + 2};\n  \\legend{$y=2x+1$, $y=-x+2$}\n\\end{axis}\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "tabela-pronta",
    title: "Tabela de dados pronta",
    category: "Organização",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{lcc}\n  \\toprule\n  Aluno & Prova 1 & Prova 2 \\\\\n  \\midrule\n  Ana & 8.0 & 9.0 \\\\\n  Bruno & 7.5 & 6.0 \\\\\n  Carla & 9.5 & 8.5 \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n"
  },
  {
    id: "diagrama-blocos",
    title: "Diagrama de blocos",
    category: "Organização",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) rectangle (2.5,1) node[midway] {Entrada};\n  \\draw[->] (2.5,0.5) -- (3.5,0.5);\n  \\draw (3.5,0) rectangle (6,1) node[midway] {Processo};\n  \\draw[->] (6,0.5) -- (7,0.5);\n  \\draw (7,0) rectangle (9.5,1) node[midway] {Saída};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "fluxograma-decisao",
    title: "Fluxograma de decisão (par ou ímpar)",
    category: "Organização",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric, arrows.meta, positioning}\n\\begin{document}\n\n\\begin{tikzpicture}[node distance=1.8cm]\n  \\node[draw, rectangle] (start) {Número $n$};\n  \\node[draw, diamond, below=of start, aspect=2] (dec) {$n$ é par?};\n  \\node[draw, rectangle, below left=1cm and -0.5cm of dec] (sim) {É par};\n  \\node[draw, rectangle, below right=1cm and -0.5cm of dec] (nao) {É ímpar};\n  \\draw[->] (start) -- (dec);\n  \\draw[->] (dec) -- (sim) node[midway, left] {sim};\n  \\draw[->] (dec) -- (nao) node[midway, right] {não};\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "arvore-possibilidades",
    title: "Árvore de possibilidades",
    category: "Organização",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{trees}\n\\begin{document}\n\n\\begin{tikzpicture}[level distance=1.5cm, sibling distance=2cm]\n  \\node {Moeda}\n    child { node {Cara}\n      child { node {Cara} }\n      child { node {Coroa} }\n    }\n    child { node {Coroa}\n      child { node {Cara} }\n      child { node {Coroa} }\n    };\n\\end{tikzpicture}\n\n\\end{document}\n"
  },
  {
    id: "atividade-plano-quadriculado",
    title: "Atividade: plano quadriculado para o aluno desenhar",
    category: "Atividades escolares",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nDesenhe o triângulo de vértices $A(1,1)$, $B(5,1)$ e $C(3,4)$ na malha abaixo.\n\n\\begin{center}\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray!50, thin] (0,0) grid (6,6);\n  \\draw[->] (0,0) -- (6.5,0) node[right] {$x$};\n  \\draw[->] (0,0) -- (0,6.5) node[above] {$y$};\n\\end{tikzpicture}\n\\end{center}\n\n\\end{document}\n"
  },
  {
    id: "moldura-decorativa",
    title: "Moldura decorativa para folha de atividade",
    category: "Atividades escolares",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usepackage[a4paper, margin=2cm]{geometry}\n\\begin{document}\n\n\\begin{tikzpicture}[overlay]\n  \\draw[very thick, blue!60] ([xshift=1cm,yshift=-1cm]current page.north west) rectangle ([xshift=-1cm,yshift=1cm]current page.south east);\n\\end{tikzpicture}\n\n\\vspace{2cm}\n\\begin{center}\n\\Large Atividade de Matemática\n\\end{center}\n\n\\end{document}\n"
  },
  {
    id: "caixa-explicacao",
    title: "Caixa de explicação (\"Saiba mais\")",
    category: "Atividades escolares",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{tcolorbox}\n\\begin{document}\n\n\\begin{tcolorbox}[colback=blue!5, colframe=blue!60, title=Saiba mais]\nUma equação do 1º grau tem sempre a forma $ax + b = 0$, com $a \\neq 0$.\n\\end{tcolorbox}\n\n\\end{document}\n"
  },
  {
    id: "pagina-avaliacao",
    title: "Página de avaliação (cabeçalho de prova)",
    category: "Atividades escolares",
    engine: "pdflatex",
    code:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{center}\n\\Large Avaliação de Matemática\n\\end{center}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{7cm}{0.4pt} \\\\\n  Turma: & \\rule{3cm}{0.4pt} \\quad Data: \\rule{3cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{1cm}\n\\begin{enumerate}\n  \\item Quanto é $8 \\times 7$? \\vspace{1.5cm}\n  \\item Resolva $2x + 4 = 12$. \\vspace{1.5cm}\n\\end{enumerate}\n\n\\end{document}\n"
  }
];
