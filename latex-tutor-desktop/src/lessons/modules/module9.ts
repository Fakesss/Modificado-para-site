import type { Lesson } from "../types";

export const module9: Lesson[] = [
  {
    id: "m9-01-origem-eixos",
    moduleId: "m9",
    order: 1,
    title: "Onde fica a origem (0,0) e como os eixos funcionam",
    engine: "pdflatex",
    explanation:
      "Dentro de um \\begin{tikzpicture}, a origem (0,0) fica onde o desenho começa a ser posicionado no texto — " +
      "normalmente, na linha de base (baseline) de onde o tikzpicture foi colocado no documento, não em um canto " +
      "fixo da página. O eixo x cresce para a direita, e o eixo y cresce para CIMA (diferente da tela do " +
      "computador, onde y geralmente cresce para baixo!). Tudo que você desenha com coordenadas negativas aparece " +
      "à esquerda ou abaixo dessa origem.",
    example: {
      description: "Marcando a origem e mostrando para onde cada eixo cresce.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nTexto antes do desenho.\n\n\\begin{tikzpicture}\n  \\fill[red] (0,0) circle (2pt) node[below left] {origem (0,0)};\n  \\draw[->, thick] (0,0) -- (3,0) node[right] {x cresce $\\rightarrow$};\n  \\draw[->, thick] (0,0) -- (0,3) node[above] {y cresce $\\uparrow$};\n  \\fill[blue] (-1,-1) circle (2pt) node[below] {$(-1,-1)$};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\fill[red] (0,0) circle (2pt) node[below left] {origem};\n  \\draw[->] (0,0) -- (3,0);\n  \\draw[->] (0,0) -- (0,3);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Marque um ponto com coordenada negativa em x e outro com coordenada negativa em y, para ver onde eles aparecem.",
    challenge: "Desenhe os quatro pontos (2,2), (-2,2), (-2,-2) e (2,-2) e observe como cada um fica em um \"canto\" diferente da origem.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\fill[red] (0,0) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Coordenadas negativas em x vão para a esquerda da origem; negativas em y vão para baixo dela."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\fill[red] (0,0) circle (2pt);\n  \\fill (2,2) circle (2pt) node[right] {$(2,2)$};\n  \\fill (-2,2) circle (2pt) node[left] {$(-2,2)$};\n  \\fill (-2,-2) circle (2pt) node[left] {$(-2,-2)$};\n  \\fill (2,-2) circle (2pt) node[right] {$(2,-2)$};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["origem local do tikzpicture", "eixo y crescendo para cima"]
  },
  {
    id: "m9-02-locais-vs-pagina",
    moduleId: "m9",
    order: 2,
    title: "Coordenadas locais vs. coordenadas da página",
    engine: "pdflatex",
    explanation:
      "Coordenadas \"locais\" (como (2,3)) são relativas à origem DAQUELE tikzpicture específico — se você mover o " +
      "tikzpicture no texto, o desenho todo se move junto. Já `current page` é um nó especial que representa a " +
      "PÁGINA inteira, sempre no mesmo lugar físico independente de onde o tikzpicture está no texto — útil para " +
      "posicionar algo em um canto exato da folha, como uma marca d'água ou um carimbo.",
    example: {
      description: "Um desenho com coordenadas locais e outro fixado num canto físico da página.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nTexto normal.\n\n\\begin{tikzpicture}\n  \\draw[thick] (0,0) rectangle (2,2); % local: relativo a onde este tikzpicture está\n\\end{tikzpicture}\n\n\\begin{tikzpicture}[remember picture, overlay]\n  \\node at ([xshift=-1.5cm,yshift=1.5cm]current page.south east) {Canto da página};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nTexto normal.\n\n\\begin{tikzpicture}\n  \\draw[thick] (0,0) rectangle (2,2);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um segundo tikzpicture com [overlay] que escreve um texto em current page.north west (canto superior esquerdo da página).",
    challenge: "Coloque um texto \"Confidencial\" no canto inferior esquerdo físico da página, não importando onde o resto do conteúdo esteja.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nConteúdo do documento.\n\n\\end{document}\n",
    hints: ["current page.south west é o canto inferior esquerdo físico da folha.", "Não esqueça a opção [overlay] no tikzpicture que usa current page."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nConteúdo do documento.\n\n\\begin{tikzpicture}[overlay]\n  \\node[anchor=south west] at ([xshift=1cm,yshift=1cm]current page.south west) {Confidencial};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["current page", "overlay", "xshift", "yshift"]
  },
  {
    id: "m9-03-centimetros-unidades",
    moduleId: "m9",
    order: 3,
    title: "Usando centímetros como unidade",
    engine: "pdflatex",
    explanation:
      "Por padrão, um \"1\" em uma coordenada TikZ já significa 1 centímetro (a configuração x=1cm,y=1cm vem " +
      "ativada por padrão). Mesmo assim, é uma boa prática escrever a unidade explicitamente — (2cm,3cm) em vez de " +
      "(2,3) — principalmente ao usar xshift/yshift com current page, ou ao misturar com outras unidades como pt " +
      "ou mm, para não haver ambiguidade.",
    example: {
      description: "As mesmas coordenadas escritas sem e com unidade explícita.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[blue] (0,0) rectangle (3,2);       % assume cm\n  \\draw[red] (4cm,0cm) rectangle (7cm,2cm); % explícito em cm\n  \\draw[green!60!black] (8cm,0mm) rectangle (11cm,20mm); % misturando cm e mm\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) rectangle (3cm,2cm);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um segundo retângulo usando milímetros (mm) em vez de centímetros.",
    challenge: "Desenhe uma linha de exatamente 5cm de comprimento e outra de exatamente 50mm — elas devem ficar do mesmo tamanho.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["10mm equivalem a 1cm — então 50mm e 5cm são o mesmo tamanho."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[blue, thick] (0,0) -- (5cm,0);\n  \\draw[red, thick] (0,-0.5) -- (50mm,-0.5cm);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["cm", "mm", "pt"]
  },
  {
    id: "m9-04-posicionamento-relativo",
    moduleId: "m9",
    order: 4,
    title: "Posicionando elementos em relação a outros",
    engine: "pdflatex",
    explanation:
      "Com \\usetikzlibrary{positioning}, dá para posicionar um nó em relação a OUTRO nó em vez de calcular " +
      "coordenadas absolutas: \\node[right=1cm of A] {B}; coloca B a 1cm à direita de A. Funciona com right, left, " +
      "above, below, e combinações como above right.",
    example: {
      description: "Três caixas posicionadas relativamente uma à outra.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{positioning}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[draw] (a) {A};\n  \\node[draw, right=1cm of a] (b) {B};\n  \\node[draw, below=1cm of a] (c) {C};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{positioning}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[draw] (a) {A};\n  \\node[draw, right=1cm of a] (b) {B};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma caixa C abaixo de B (below=1cm of b).",
    challenge: "Crie quatro caixas em cruz: uma no centro, e uma acima, uma abaixo, uma à direita e uma à esquerda dela, todas posicionadas relativamente ao centro.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{positioning}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[draw] (centro) {Centro};\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Cada novo \\node precisa de um nome único entre parênteses, como (cima), para poder ser referenciado depois."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{positioning}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\node[draw] (centro) {Centro};\n  \\node[draw, above=1cm of centro] {Cima};\n  \\node[draw, below=1cm of centro] {Baixo};\n  \\node[draw, left=1cm of centro] {Esquerda};\n  \\node[draw, right=1cm of centro] {Direita};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\usetikzlibrary{positioning}", "right=of", "left=of", "above=of", "below=of"]
  },
  {
    id: "m9-05-ponto-medio",
    moduleId: "m9",
    order: 5,
    title: "Encontrando o ponto médio de uma linha",
    engine: "pdflatex",
    explanation:
      "Com \\usetikzlibrary{calc}, a sintaxe ($(A)!0.5!(B)$) calcula o ponto exatamente na metade do caminho entre " +
      "A e B (0.5 = 50%). Trocando 0.5 por outro número entre 0 e 1, você pega qualquer ponto ao longo do segmento " +
      "— por exemplo, 0.25 pega o ponto a um quarto do caminho.",
    example: {
      description: "Marcando o ponto médio de um segmento.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{calc}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\coordinate (A) at (0,0);\n  \\coordinate (B) at (4,2);\n  \\draw (A) -- (B);\n  \\fill (A) circle (2pt) node[below] {A};\n  \\fill (B) circle (2pt) node[above] {B};\n  \\fill[red] ($(A)!0.5!(B)$) circle (2pt) node[below right] {ponto médio};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{calc}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\coordinate (A) at (0,0);\n  \\coordinate (B) at (4,2);\n  \\draw (A) -- (B);\n  \\fill[red] ($(A)!0.5!(B)$) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Troque 0.5 por 0.25 e depois por 0.75 e observe o ponto se mover ao longo do segmento.",
    challenge: "Desenhe um triângulo e marque o ponto médio de cada um dos três lados.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{calc}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\coordinate (A) at (0,0);\n  \\coordinate (B) at (4,0);\n  \\coordinate (C) at (2,3);\n  \\draw (A) -- (B) -- (C) -- cycle;\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Repita ($(X)!0.5!(Y)$) para cada par de vértices: A-B, B-C e C-A."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\usetikzlibrary{calc}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\coordinate (A) at (0,0);\n  \\coordinate (B) at (4,0);\n  \\coordinate (C) at (2,3);\n  \\draw (A) -- (B) -- (C) -- cycle;\n  \\fill[red] ($(A)!0.5!(B)$) circle (2pt);\n  \\fill[red] ($(B)!0.5!(C)$) circle (2pt);\n  \\fill[red] ($(C)!0.5!(A)$) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["\\usetikzlibrary{calc}", "!razão!", "\\coordinate"]
  },
  {
    id: "m9-06-coordenadas-polares",
    moduleId: "m9",
    order: 6,
    title: "Coordenadas polares",
    engine: "pdflatex",
    explanation:
      "Em vez de (x,y), TikZ também aceita (ângulo:raio) — coordenadas polares. (30:2cm) é o ponto a 2cm de " +
      "distância da origem atual, na direção de 30 graus (medidos a partir do eixo x, girando no sentido " +
      "anti-horário). Muito útil para desenhar em círculo, como marcações de relógio ou pétalas.",
    example: {
      description: "Pontos em vários ângulos ao redor de um círculo.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) circle (2cm);\n  \\foreach \\ang in {0,45,...,315}\n    \\fill (\\ang:2cm) circle (2pt);\n  \\draw[->] (0,0) -- (30:2cm) node[above right] {$30^\\circ$};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) circle (2cm);\n  \\fill (0:2cm) circle (2pt);\n  \\fill (90:2cm) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione pontos em 180 e 270 graus também, completando os quatro \"quartos\" do círculo.",
    challenge: "Marque 12 pontos ao redor de um círculo, como os números de um relógio (a cada 30 graus).",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) circle (3cm);\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["\\foreach \\ang in {0,30,...,330} percorre os 12 ângulos de 30 em 30 graus."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw (0,0) circle (3cm);\n  \\foreach \\ang in {0,30,...,330}\n    \\fill (\\ang:3cm) circle (2pt);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["(ângulo:raio)"]
  },
  {
    id: "m9-07-overlay-remember-picture",
    moduleId: "m9",
    order: 7,
    title: "Trabalhando com overlay e remember picture",
    engine: "pdflatex",
    explanation:
      "overlay diz ao TikZ para ignorar o tamanho do desenho ao reservar espaço no texto — sem isso, um desenho " +
      "que \"vaza\" para fora da área normal bagunçaria o layout da página. remember picture serve para " +
      "referenciar, em um tikzpicture, um nó nomeado que foi criado em OUTRO tikzpicture (até em outra página) — " +
      "só funciona junto com overlay, e precisa estar ativado nos DOIS tikzpicture envolvidos.",
    example: {
      description: "Um nó nomeado em um lugar e referenciado em um overlay depois.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nTexto com um marcador \\tikz[remember picture] \\node (marca) {}; no meio da frase.\n\n\\begin{tikzpicture}[remember picture, overlay]\n  \\draw[->, red, thick] (marca) -- ++(2,1) node[right] {aqui!};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nTexto normal.\n\n\\begin{tikzpicture}[overlay]\n  \\node at (2,2) {Flutuando sobre o texto};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Remova [overlay] e observe como o layout da página muda — o tikzpicture passa a ocupar espaço reservado no fluxo do texto.",
    challenge: "Crie um tikzpicture com overlay que desenha um retângulo vermelho fino ao redor de toda a página (usando current page), sem afetar o texto normal.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nConteúdo normal do documento.\n\n\\end{document}\n",
    hints: ["\\draw[red] (current page.south west) rectangle (current page.north east); desenha um retângulo do tamanho da página."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nConteúdo normal do documento.\n\n\\begin{tikzpicture}[overlay]\n  \\draw[red, thin] ([xshift=0.5cm,yshift=0.5cm]current page.south west) rectangle ([xshift=-0.5cm,yshift=-0.5cm]current page.north east);\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["overlay", "remember picture", "\\tikz[...] \\node"]
  },
  {
    id: "m9-08-ancoras-current-page",
    moduleId: "m9",
    order: 8,
    title: "As âncoras de current page",
    engine: "pdflatex",
    explanation:
      "current page tem várias âncoras nomeadas: .south west (canto inferior esquerdo), .north east (canto " +
      "superior direito), .center (centro exato), .north, .south, .east, .west (meio de cada borda), entre " +
      "outras. Combine com xshift/yshift para se afastar um pouco desses pontos de referência.",
    example: {
      description: "Marcando as principais âncoras da página.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}[overlay]\n  \\node[fill=yellow!50] at (current page.center) {centro};\n  \\node[fill=yellow!50] at ([yshift=-1cm]current page.north) {topo};\n  \\node[fill=yellow!50] at ([yshift=1cm]current page.south) {base};\n  \\node[fill=yellow!50] at ([xshift=1cm]current page.west) {esquerda};\n  \\node[fill=yellow!50] at ([xshift=-1cm]current page.east) {direita};\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}[overlay]\n  \\node[fill=yellow!50] at (current page.center) {centro};\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um rótulo no canto superior direito (current page.north east), afastado 1cm de cada borda.",
    challenge: "Coloque um rótulo em cada um dos quatro cantos da página, todos afastados 1cm das bordas.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}[overlay]\n\n\\end{tikzpicture}\n\n\\end{document}\n",
    hints: ["Para afastar de um canto nas duas direções ao mesmo tempo, use xshift e yshift juntos: [xshift=-1cm,yshift=-1cm]current page.north east."],
    solution:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\n\\begin{tikzpicture}[overlay]\n  \\node at ([xshift=1cm,yshift=-1cm]current page.north west) {sup. esquerdo};\n  \\node at ([xshift=-1cm,yshift=-1cm]current page.north east) {sup. direito};\n  \\node at ([xshift=1cm,yshift=1cm]current page.south west) {inf. esquerdo};\n  \\node at ([xshift=-1cm,yshift=1cm]current page.south east) {inf. direito};\n\\end{tikzpicture}\n\n\\end{document}\n",
    commandsLearned: ["current page.north", "current page.south", "current page.east", "current page.west", "current page.center"]
  },
  {
    id: "m9-09-duas-compilacoes",
    moduleId: "m9",
    order: 9,
    title: "Por que alguns recursos precisam de mais de uma compilação",
    engine: "pdflatex",
    explanation:
      "LaTeX compila de cima para baixo, em um passe só — então, quando você usa remember picture para referenciar " +
      "a posição de um nó, na PRIMEIRA compilação essa posição ainda não foi calculada e salva. O LaTeX guarda essa " +
      "informação em um arquivo auxiliar (.aux) e só consegue USAR essa posição na PRÓXIMA compilação, quando o " +
      "arquivo já existe. Por isso, sumário (\\tableofcontents), referências cruzadas (\\ref) e remember picture " +
      "geralmente precisam de 2 compilações para aparecerem certinho — este app já compila as vezes necessárias " +
      "automaticamente, mas é bom entender por quê, caso você compile em outro programa algum dia.",
    example: {
      description: "Um remember picture que só fica correto depois da segunda compilação.",
      code: "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nPrimeira compilação: a seta pode não aparecer no lugar certo ainda.\n\n\\tikz[remember picture] \\node (alvo) {aqui};\n\n\\begin{tikzpicture}[remember picture, overlay]\n  \\draw[->, red] (alvo) -- ++(0,-1);\n\\end{tikzpicture}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{tikz}\n\\begin{document}\n\nTexto com \\tikz[remember picture] \\node (alvo) {marcador};.\n\n\\begin{tikzpicture}[remember picture, overlay]\n  \\draw[->, red] (alvo) -- ++(1,1);\n\\end{tikzpicture}\n\n\\end{document}\n",
    guidedInstructions: "Compile (clique em Atualizar) mais de uma vez seguida e observe se a seta se estabiliza.",
    challenge: "Explique com suas palavras (em um comentário %) por que \\tableofcontents também costuma precisar de duas compilações para mostrar os números de página certos.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% escreva sua explicação aqui como comentário\n\\tableofcontents\n\\section{Teste}\n\n\\end{document}\n",
    hints: ["Pense em qual informação (o número da página) só existe DEPOIS que o LaTeX já processou o documento inteiro uma vez."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n% Na primeira compilação, o LaTeX ainda não sabe em qual página cada\n% \\section vai cair - ele só descobre isso processando o documento\n% inteiro. Essa informação é salva no arquivo .aux, e só na segunda\n% compilação o \\tableofcontents consegue ler os números corretos.\n\\tableofcontents\n\\section{Teste}\n\n\\end{document}\n",
    commandsLearned: ["arquivo .aux", "compilação em múltiplos passes"]
  }
];
