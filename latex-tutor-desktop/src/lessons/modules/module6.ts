import type { Lesson } from "../types";

export const module6: Lesson[] = [
  {
    id: "m6-01-pontos-segmentos",
    moduleId: "m6",
    order: 1,
    title: "Primeiros passos com TikZ: pontos e segmentos",
    engine: "pdflatex",
    explanation:
      "TikZ desenha usando coordenadas (x,y). O ambiente tikzpicture é onde tudo acontece, e \\draw (x1,y1) -- " +
      "(x2,y2); desenha uma linha reta (um segmento) entre dois pontos. \\fill (x,y) circle (2pt); desenha um " +
      "pontinho preenchido para marcar um ponto.",
    example: {
      description: "Dois pontos marcados e um segmento entre eles.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\fill (0,0) circle (2pt);\n  \\fill (3,2) circle (2pt);\n  \\draw (0,0) -- (3,2);\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (2,2);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione pontos marcados (\\fill ... circle (2pt);) nas duas pontas do segmento.",
    challenge: "Desenhe um segmento de (0,0) até (4,0) e outro de (0,0) até (0,3), formando um \"L\".",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Cada comando \\draw termina com ponto e vírgula ;.", "As coordenadas são sempre (x,y), com x e y separados por vírgula."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (4,0);\n  \\draw (0,0) -- (0,3);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{tikzpicture}", "\\draw", "\\fill", "circle"]
  },
  {
    id: "m6-02-setas-direcoes",
    moduleId: "m6",
    order: 2,
    title: "Setas e direções",
    engine: "pdflatex",
    explanation:
      "Adicionando a opção [->] (ou [<-], [<->]) antes das coordenadas, \\draw desenha uma seta em vez de uma " +
      "linha simples — perfeito para vetores e eixos.",
    example: {
      description: "Uma seta simples e uma seta dupla (bidirecional).",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (3,0);\n  \\draw[<->] (0,-1) -- (3,-1);\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (2,0);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma segunda seta apontando para cima, saindo do mesmo ponto (0,0).",
    challenge: "Desenhe duas setas representando um vetor \"ida e volta\" entre os pontos (0,0) e (3,2).",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["[->] vai dentro de colchetes, logo depois de \\draw."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (0,0) -- (3,2);\n  \\draw[<-] (0,-0.3) -- (3,1.7);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["->", "<-", "<->"]
  },
  {
    id: "m6-03-circulos-arcos",
    moduleId: "m6",
    order: 3,
    title: "Círculos e arcos",
    engine: "pdflatex",
    explanation:
      "\\draw (centro) circle (raio); desenha um círculo. Para colorir por dentro, adicione a opção fill=cor. " +
      "Arcos (pedaços de círculo) usam \\draw (ponto) arc (ângulo-inicial:ângulo-final:raio);.",
    example: {
      description: "Um círculo colorido e um arco.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[fill=blue!20] (0,0) circle (1.5cm);\n  \\draw (4,0) arc (0:180:1cm);\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) circle (1cm);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione a opção [fill=yellow!30] ao círculo para colori-lo por dentro.",
    challenge: "Desenhe dois círculos de tamanhos diferentes, um do lado do outro, com cores diferentes.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["O raio vem entre parênteses logo depois de circle."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[fill=blue!20] (0,0) circle (1cm);\n  \\draw[fill=red!20] (3,0) circle (1.8cm);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["circle", "arc", "fill="]
  },
  {
    id: "m6-04-quadrados-retangulos-triangulos",
    moduleId: "m6",
    order: 4,
    title: "Quadrados, retângulos e triângulos",
    engine: "pdflatex",
    explanation:
      "\\draw (canto-inferior-esquerdo) rectangle (canto-superior-direito); desenha um retângulo (ou quadrado, se " +
      "os lados forem iguais). Triângulos são desenhados ligando três pontos com -- e fechando com -- cycle, que " +
      "volta automaticamente ao ponto inicial.",
    example: {
      description: "Um quadrado colorido e um triângulo.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[fill=green!20] (0,0) rectangle (2,2);\n  \\draw (4,0) -- (6,0) -- (5,2) -- cycle;\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) rectangle (2,2);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um triângulo ao lado do quadrado usando três pontos e cycle.",
    challenge: "Desenhe um triângulo retângulo com catetos de 3cm e 4cm sobre os eixos, e marque os três vértices com pontos.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["cycle fecha a figura voltando ao primeiro ponto, sem precisar repeti-lo.", "Um triângulo retângulo com catetos 3 e 4 tem hipotenusa 5 (pelo Teorema de Pitágoras)."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (4,0) -- (0,3) -- cycle;\n  \\fill (0,0) circle (2pt);\n  \\fill (4,0) circle (2pt);\n  \\fill (0,3) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["rectangle", "cycle"]
  },
  {
    id: "m6-05-poligonos-regulares",
    moduleId: "m6",
    order: 5,
    title: "Polígonos regulares",
    engine: "pdflatex",
    explanation:
      "Com a biblioteca TikZ \"shapes.geometric\" carregada (\\usetikzlibrary{shapes.geometric}), o nó " +
      "regular polygon desenha pentágonos, hexágonos e outros polígonos com o número de lados que você escolher.",
    example: {
      description: "Um pentágono e um hexágono regulares.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[regular polygon, regular polygon sides=5, draw, minimum size=2cm] at (0,0) {};\n  \\node[regular polygon, regular polygon sides=6, draw, minimum size=2cm] at (4,0) {};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[regular polygon, regular polygon sides=5, draw, minimum size=2cm] at (0,0) {};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Mude regular polygon sides para 8 (octógono).",
    challenge: "Desenhe três polígonos regulares lado a lado: um triângulo (3 lados), um quadrado (4 lados) e um heptágono (7 lados).",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["regular polygon sides=N define o número de lados do polígono.", "at (x,y) define onde o centro do polígono fica."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{shapes.geometric}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[regular polygon, regular polygon sides=3, draw, minimum size=2cm] at (0,0) {};\n  \\node[regular polygon, regular polygon sides=4, draw, minimum size=2cm] at (3,0) {};\n  \\node[regular polygon, regular polygon sides=7, draw, minimum size=2cm] at (6,0) {};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\usetikzlibrary", "regular polygon", "\\node"]
  },
  {
    id: "m6-06-angulos-lados-congruentes",
    moduleId: "m6",
    order: 6,
    title: "Ângulos e marcação de lados congruentes",
    engine: "pdflatex",
    explanation:
      "Para marcar um ângulo, desenha-se um pequeno arco entre dois segmentos com o comando arc. Para indicar " +
      "lados congruentes (do mesmo tamanho) em uma figura geométrica, o costume é desenhar um tracinho igual " +
      "(um pequeno segmento perpendicular) no meio de cada lado congruente.",
    example: {
      description: "Um ângulo marcado com arco e dois lados marcados como congruentes.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (3,0) -- (1.5,2.5) -- cycle;\n  \\draw (0.6,0) arc (0:59:0.6); % marca o ângulo no vértice (0,0)\n  \\draw (0.7,1.15) -- (0.9,1.35); % tracinho de congruência no lado esquerdo\n  \\draw (2.3,1.15) -- (2.5,1.35); % tracinho de congruência no lado direito\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (3,0) -- (1.5,2.5) -- cycle;\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um pequeno arco em um dos vértices para marcar o ângulo ali.",
    challenge: "Desenhe um triângulo isósceles e marque os dois lados iguais com tracinhos de congruência.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (4,0) -- (2,3) -- cycle;\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["O arco de ângulo usa o mesmo comando arc que você já viu para desenhar pedaços de círculo.", "O tracinho de congruência é só um segmento bem curto, perpendicular ao lado."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) -- (4,0) -- (2,3) -- cycle;\n  \\draw (0.9,1.1) -- (1.1,0.9);\n  \\draw (2.9,1.1) -- (3.1,0.9);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["arc (ângulo)"]
  },
  {
    id: "m6-07-eixos-cartesianos",
    moduleId: "m6",
    order: 7,
    title: "Eixos cartesianos e pontos",
    engine: "pdflatex",
    explanation:
      "Um plano cartesiano em TikZ é feito com duas setas (eixo x e eixo y) e pontos marcados com \\fill. O " +
      "comando \\node também escreve rótulos de texto, como \"x\" e \"y\" nas pontas dos eixos.",
    example: {
      description: "Um plano cartesiano simples com um ponto marcado.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (-3,0) -- (3,0) node[right] {$x$};\n  \\draw[->] (0,-3) -- (0,3) node[above] {$y$};\n  \\fill (2,1) circle (2pt) node[above right] {$(2,1)$};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (-3,0) -- (3,0) node[right] {$x$};\n  \\draw[->] (0,-3) -- (0,3) node[above] {$y$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Marque o ponto (2,1) no plano com \\fill e um rótulo.",
    challenge: "Marque os pontos (2,3), (-1,2) e (0,-2) no plano cartesiano, cada um com seu rótulo.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (-3,0) -- (3,0) node[right] {$x$};\n  \\draw[->] (0,-3) -- (0,3) node[above] {$y$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["node[above right] {$(x,y)$} escreve um texto (com fórmula) ao lado do ponto marcado."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[->] (-3,0) -- (3,0) node[right] {$x$};\n  \\draw[->] (0,-3) -- (0,3) node[above] {$y$};\n  \\fill (2,3) circle (2pt) node[above right] {$(2,3)$};\n  \\fill (-1,2) circle (2pt) node[above left] {$(-1,2)$};\n  \\fill (0,-2) circle (2pt) node[below right] {$(0,-2)$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["node", "node[above]", "node[right]"]
  },
  {
    id: "m6-08-graficos-funcoes",
    moduleId: "m6",
    order: 8,
    title: "Gráficos de funções com pgfplots",
    engine: "pdflatex",
    explanation:
      "O pacote pgfplots (que usa TikZ por baixo) desenha gráficos de funções automaticamente com \\addplot, " +
      "dentro de um ambiente axis. Você só precisa escrever a fórmula da função, e ele calcula e desenha os pontos.",
    example: {
      description: "O gráfico da função x².",
      code: "\\documentclass{article}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\n\\begin{tikzpicture}\n\\begin{axis}[xlabel=$x$, ylabel=$y$]\n  \\addplot[domain=-3:3, thick, blue] {x^2};\n\\end{axis}\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\n\\begin{tikzpicture}\n\\begin{axis}\n  \\addplot[domain=-3:3] {x^2};\n\\end{axis}\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Troque a função por 2*x + 1 (uma reta) e veja o gráfico mudar.",
    challenge: "Plote duas funções no mesmo gráfico: x^2 e 2*x, com cores diferentes.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\n\\begin{tikzpicture}\n\\begin{axis}\n\n\\end{axis}\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Cada \\addplot novo desenha uma curva a mais no mesmo gráfico.", "domain=-3:3 define o intervalo de x usado para desenhar."],
    solution:
      "\\documentclass{article}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\begin{document}\n\n\\begin{tikzpicture}\n\\begin{axis}[xlabel=$x$, ylabel=$y$, legend pos=north west]\n  \\addplot[domain=-3:3, thick, blue] {x^2};\n  \\addplot[domain=-3:3, thick, red] {2*x};\n  \\legend{$x^2$, $2x$}\n\\end{axis}\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{axis}", "\\addplot", "domain="]
  },
  {
    id: "m6-09-malhas-diagramas",
    moduleId: "m6",
    order: 9,
    title: "Malhas (grids) e diagramas",
    engine: "pdflatex",
    explanation:
      "\\draw[step=1cm, gray, thin] (0,0) grid (5,5); desenha uma malha quadriculada, útil como fundo para " +
      "atividades de plano cartesiano ou desenho geométrico. Diagramas simples combinam retângulos e setas para " +
      "mostrar relações entre ideias.",
    example: {
      description: "Uma malha quadriculada e um pequeno diagrama de duas caixas ligadas por uma seta.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray, thin] (0,0) grid (4,4);\n\\end{tikzpicture}\n\n\\begin{tikzpicture}\n  \\draw (0,0) rectangle (2,1) node[midway] {Início};\n  \\draw[->] (2,0.5) -- (3,0.5);\n  \\draw (3,0) rectangle (5,1) node[midway] {Fim};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[step=1cm, gray, thin] (0,0) grid (4,4);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Mude o tamanho da malha para 6x6 quadradinhos.",
    challenge: "Desenhe um diagrama de 3 caixas em sequência (\"Passo 1\" → \"Passo 2\" → \"Passo 3\") ligadas por setas.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["node[midway] {texto} escreve um texto centralizado dentro do retângulo desenhado."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) rectangle (2,1) node[midway] {Passo 1};\n  \\draw[->] (2,0.5) -- (3,0.5);\n  \\draw (3,0) rectangle (5,1) node[midway] {Passo 2};\n  \\draw[->] (5,0.5) -- (6,0.5);\n  \\draw (6,0) rectangle (8,1) node[midway] {Passo 3};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["grid", "step="]
  },
  {
    id: "m6-10-fluxogramas-arvores",
    moduleId: "m6",
    order: 10,
    title: "Fluxogramas e árvores",
    engine: "pdflatex",
    explanation:
      "Com a biblioteca \\usetikzlibrary{trees}, os nós podem ser organizados automaticamente em uma estrutura de " +
      "árvore usando child {node {...}}. Isso é ótimo para árvores genealógicas, árvores de possibilidades e " +
      "fluxogramas de decisão simples.",
    example: {
      description: "Uma árvore com um nó raiz e dois filhos.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{trees}\n\\begin{document}\n\n\\begin{tikzpicture}[level distance=1.5cm, sibling distance=3cm]\n  \\node {Número}\n    child { node {Par} }\n    child { node {Ímpar} };\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{trees}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node {Raiz}\n    child { node {Filho 1} };\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um segundo filho ao nó raiz.",
    challenge: "Crie uma árvore de possibilidades para \"jogar uma moeda duas vezes\" (raiz → cara/coroa → cara/coroa em cada ramo).",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{trees}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node {Início};\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Cada child { node {texto} } pode ter os próprios filhos aninhados dentro dele."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{trees}\n\\begin{document}\n\n\\begin{tikzpicture}[level distance=1.5cm, sibling distance=2cm]\n  \\node {Início}\n    child { node {Cara}\n      child { node {Cara} }\n      child { node {Coroa} }\n    }\n    child { node {Coroa}\n      child { node {Cara} }\n      child { node {Coroa} }\n    };\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\usetikzlibrary{trees}", "child", "level distance", "sibling distance"]
  }
];
