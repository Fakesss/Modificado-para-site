import type { Lesson } from "../types";

export const module3: Lesson[] = [
  {
    id: "m3-01-modo-matematico",
    moduleId: "m3",
    order: 1,
    title: "Modo matemático e operações básicas",
    engine: "pdflatex",
    explanation:
      "Fórmulas ficam entre $...$ quando aparecem no meio do texto (inline), ou entre \\[ ... \\] quando devem " +
      "aparecer centralizadas e em destaque. Dentro do modo matemático, +, -, = funcionam normalmente, e * vira " +
      "\\times ou \\cdot para multiplicação, e / pode ser usado para divisão simples.",
    example: {
      description: "Fórmula no meio do texto e em destaque.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\nA soma $2 + 3 = 5$ é básica, mas em destaque fica assim:\n\\[\n  7 \\times 6 = 42\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\nA conta $4 + 5 = 9$ está no meio do texto.\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma fórmula em destaque com \\[ ... \\] usando \\times.",
    challenge: "Escreva as quatro operações básicas (soma, subtração, multiplicação, divisão) como fórmulas inline na mesma frase.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% quatro operações\n\n\\end{document}\n",
    hints: ["Use \\times para multiplicação dentro do modo matemático.", "$...$ é para fórmulas curtas no meio do texto."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\nTemos $3+2=5$, $9-4=5$, $6 \\times 7 = 42$ e $10 / 2 = 5$.\n\n\\end{document}\n",
    commandsLearned: ["$...$", "\\[...\\]", "\\times", "\\cdot"]
  },
  {
    id: "m3-02-fracoes",
    moduleId: "m3",
    order: 2,
    title: "Frações",
    engine: "pdflatex",
    explanation: "\\frac{numerador}{denominador} escreve uma fração. Frações podem conter outras frações ou expressões complexas dentro.",
    example: {
      description: "Frações simples e uma fração dentro de outra.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\frac{1}{2} + \\frac{1}{3} = \\frac{5}{6}\n\\]\n\n\\[\n  \\frac{\\frac{1}{2}}{4} = \\frac{1}{8}\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\frac{1}{2}\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Escreva a soma de duas frações diferentes.",
    challenge: "Escreva a fórmula da área do trapézio: $A = \\frac{(B+b) \\cdot h}{2}$.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% área do trapézio\n\n\\end{document}\n",
    hints: ["\\frac sempre recebe duas chaves seguidas: uma para cima, outra para baixo."],
    solution: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  A = \\frac{(B+b) \\cdot h}{2}\n\\]\n\n\\end{document}\n",
    commandsLearned: ["\\frac"]
  },
  {
    id: "m3-03-potencias-raizes",
    moduleId: "m3",
    order: 3,
    title: "Potências, índices e raízes",
    engine: "pdflatex",
    explanation:
      "^ eleva a uma potência (x^2) e _ escreve um índice (x_1). Se o expoente/índice tiver mais de um caractere, " +
      "use chaves: x^{10}. \\sqrt{x} faz raiz quadrada, e \\sqrt[3]{x} faz raiz cúbica (ou de qualquer índice).",
    example: {
      description: "Potências, índices e raízes de vários tipos.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  x^2 + y^{10} - a_1 + a_{12} \\qquad \\sqrt{16} = 4 \\qquad \\sqrt[3]{27} = 3\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  x^2\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Adicione um índice (como a_1) e uma raiz quadrada na mesma linha.",
    challenge: "Escreva a fórmula de Bhaskara completa: $x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% fórmula de Bhaskara\n\n\\end{document}\n",
    hints: ["\\pm escreve o símbolo ±.", "Expoentes com mais de um caractere precisam de chaves: b^{2}, não b2."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  x = \\dfrac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\\]\n\n\\end{document}\n",
    commandsLearned: ["^", "_", "\\sqrt", "\\pm"]
  },
  {
    id: "m3-04-equacoes-numeradas",
    moduleId: "m3",
    order: 4,
    title: "Equações e numeração automática",
    engine: "pdflatex",
    explanation:
      "O ambiente equation (do amsmath) escreve uma fórmula em destaque e numera ela automaticamente — útil para " +
      "referenciar \"a equação 3\" depois no texto. Para uma fórmula em destaque sem número, use \\[ ... \\] " +
      "ou equation*.",
    example: {
      description: "Equação numerada automaticamente.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\nA equação~\\eqref{eq:soma} mostra uma soma simples.\n\n\\begin{equation}\n  2 + 2 = 4 \\label{eq:soma}\n\\end{equation}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\begin{equation}\n  x + 1 = 2\n\\end{equation}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um \\label na equação e use \\eqref para citá-la em uma frase antes dela.",
    challenge: "Escreva duas equações numeradas em sequência (equation) e cite as duas no texto usando \\eqref.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% duas equações numeradas\n\n\\end{document}\n",
    hints: ["\\label deve vir logo depois da fórmula, dentro do mesmo ambiente equation.", "\\eqref{nome} usa o mesmo nome que você deu no \\label{nome}."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\nAs equações~\\eqref{eq:um} e~\\eqref{eq:dois} mostram exemplos.\n\n\\begin{equation}\n  x + 2 = 5 \\label{eq:um}\n\\end{equation}\n\n\\begin{equation}\n  2x = 10 \\label{eq:dois}\n\\end{equation}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{equation}", "\\label", "\\eqref"]
  },
  {
    id: "m3-05-sistemas",
    moduleId: "m3",
    order: 5,
    title: "Sistemas de equações",
    engine: "pdflatex",
    explanation:
      "O ambiente cases (do amsmath) agrupa várias equações com uma chave grande à esquerda, o formato clássico " +
      "de sistemas de equações. Cada linha termina com \\\\, e o & separa a equação de um comentário opcional.",
    example: {
      description: "Um sistema de duas equações.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n\\begin{cases}\n  x + y = 10 \\\\\n  x - y = 2\n\\end{cases}\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n\\begin{cases}\n  x + y = 10\n\\end{cases}\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma segunda equação ao sistema, terminando a primeira linha com \\\\.",
    challenge: "Escreva um sistema de três equações com x, y e z.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% sistema com três equações\n\n\\end{document}\n",
    hints: ["Cada linha do cases termina com \\\\, menos a última."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n\\begin{cases}\n  x + y + z = 6 \\\\\n  x - y = 1 \\\\\n  z = 2\n\\end{cases}\n\\]\n\n\\end{document}\n",
    commandsLearned: ["\\begin{cases}"]
  },
  {
    id: "m3-06-matrizes",
    moduleId: "m3",
    order: 6,
    title: "Matrizes",
    engine: "pdflatex",
    explanation:
      "Os ambientes pmatrix, bmatrix e vmatrix (do amsmath) desenham matrizes com parênteses, colchetes ou barras " +
      "verticais. Use & para separar colunas e \\\\ para separar linhas, igual em uma tabela.",
    example: {
      description: "Matriz 2x2 com parênteses e outra com colchetes.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}\n  \\qquad\n  B = \\begin{bmatrix} 0 & -1 \\\\ 1 & 0 \\end{bmatrix}\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  A = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Troque os números da matriz identidade e experimente trocar pmatrix por bmatrix.",
    challenge: "Escreva uma matriz 3x3 qualquer usando bmatrix.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% matriz 3x3\n\n\\end{document}\n",
    hints: ["Cada linha da matriz termina com \\\\, e os números da mesma linha são separados por &."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  M = \\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{bmatrix}\n\\]\n\n\\end{document}\n",
    commandsLearned: ["\\begin{pmatrix}", "\\begin{bmatrix}", "\\begin{vmatrix}"]
  },
  {
    id: "m3-07-somatorios-produtorios",
    moduleId: "m3",
    order: 7,
    title: "Somatórios e produtórios",
    engine: "pdflatex",
    explanation:
      "\\sum_{i=1}^{n} escreve o símbolo de somatório com limites inferior e superior, e \\prod_{i=1}^{n} faz o " +
      "mesmo para produtório. Em \\[ ... \\] os limites aparecem acima e abaixo do símbolo; inline eles ficam menores.",
    example: {
      description: "Somatório e produtório com limites.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\sum_{i=1}^{5} i = 1+2+3+4+5 = 15\n  \\qquad\n  \\prod_{i=1}^{4} i = 1 \\cdot 2 \\cdot 3 \\cdot 4 = 24\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\sum_{i=1}^{3} i\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Mude o limite superior do somatório para 10.",
    challenge: "Escreva o somatório de $i^2$ para $i$ de 1 até $n$.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% somatório de i ao quadrado\n\n\\end{document}\n",
    hints: ["O limite inferior fica em _{...} e o superior em ^{...}, logo depois de \\sum."],
    solution: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\sum_{i=1}^{n} i^2\n\\]\n\n\\end{document}\n",
    commandsLearned: ["\\sum", "\\prod"]
  },
  {
    id: "m3-08-limites-derivadas",
    moduleId: "m3",
    order: 8,
    title: "Limites e derivadas",
    engine: "pdflatex",
    explanation:
      "\\lim_{x \\to a} escreve um limite. Derivadas costumam ser escritas com frações: \\frac{d}{dx} ou, para a " +
      "derivada de uma função específica, f'(x) (usando um apóstrofo simples).",
    example: {
      description: "Um limite e uma derivada.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1\n\\]\n\n\\[\n  f(x) = x^2 \\quad \\Rightarrow \\quad f'(x) = 2x\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\lim_{x \\to 0} x^2\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Troque o limite para x tendendo ao infinito, usando \\infty.",
    challenge: "Escreva a definição da derivada como um limite: $f'(x) = \\lim_{h \\to 0} \\dfrac{f(x+h)-f(x)}{h}$.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% definição de derivada\n\n\\end{document}\n",
    hints: ["\\to escreve a seta →, e \\infty escreve o símbolo de infinito ∞."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  f'(x) = \\lim_{h \\to 0} \\frac{f(x+h)-f(x)}{h}\n\\]\n\n\\end{document}\n",
    commandsLearned: ["\\lim", "\\to", "\\infty"]
  },
  {
    id: "m3-09-integrais",
    moduleId: "m3",
    order: 9,
    title: "Integrais",
    engine: "pdflatex",
    explanation:
      "\\int escreve o símbolo de integral. Para integrais definidas, use \\int_{a}^{b}. Não esqueça do dx no " +
      "final, escrito como texto normal (ou \\, dx para um pequeno espaço antes dele).",
    example: {
      description: "Integral indefinida e definida.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\int x^2 \\, dx = \\frac{x^3}{3} + C\n\\]\n\n\\[\n  \\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}\n\\]\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\int x \\, dx\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Adicione os limites de integração 0 e 2 (integral definida).",
    challenge: "Escreva a integral definida de $2x$ de 1 até 3, igualada ao seu resultado (8).",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% integral definida\n\n\\end{document}\n",
    hints: ["O limite inferior vai em _{...} e o superior em ^{...}, logo depois de \\int."],
    solution: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  \\int_{1}^{3} 2x \\, dx = 8\n\\]\n\n\\end{document}\n",
    commandsLearned: ["\\int"]
  },
  {
    id: "m3-10-conjuntos-intervalos-alinhamento",
    moduleId: "m3",
    order: 10,
    title: "Conjuntos, intervalos e alinhamento de cálculos",
    engine: "pdflatex",
    explanation:
      "Símbolos de conjuntos comuns: \\in (pertence), \\notin (não pertence), \\subset (está contido), \\cup " +
      "(união), \\cap (interseção), \\emptyset (vazio). Para alinhar vários passos de um cálculo pelo sinal de " +
      "igual, use o ambiente align (do amsmath), com & marcando onde alinhar e \\\\ separando as linhas.",
    example: {
      description: "Símbolos de conjunto e um cálculo alinhado em várias linhas.",
      code: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  A = \\{1, 2, 3\\}, \\quad 2 \\in A, \\quad 5 \\notin A, \\quad A \\cup B, \\quad A \\cap B\n\\]\n\n\\begin{align}\n  2x + 4 &= 10 \\\\\n  2x &= 6 \\\\\n  x &= 3\n\\end{align}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\[\n  A = \\{1, 2, 3\\}\n\\]\n\n\\end{document}\n",
    guidedInstructions: "Adicione $2 \\in A$ e $5 \\notin A$ na mesma linha.",
    challenge: "Resolva a equação $3x - 6 = 0$ passo a passo usando o ambiente align, alinhado pelo sinal de igual.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n% resolução passo a passo\n\n\\end{document}\n",
    hints: ["No align, coloque & bem antes do sinal de = em cada linha para tudo alinhar certinho.", "Chaves { } dentro de conjuntos precisam de \\{ e \\} (escapadas), senão viram agrupamento."],
    solution:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\n\\begin{align}\n  3x - 6 &= 0 \\\\\n  3x &= 6 \\\\\n  x &= 2\n\\end{align}\n\n\\end{document}\n",
    commandsLearned: ["\\in", "\\notin", "\\subset", "\\cup", "\\cap", "\\emptyset", "\\begin{align}"]
  }
];
