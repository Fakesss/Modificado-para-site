export interface Lesson {
  id: string;
  level: number;
  title: string;
  engine: "pdflatex" | "xelatex";
  explanation: string;
  starterCode: string;
  challenge: string;
}

export const lessons: Lesson[] = [
  {
    id: "01-primeiros-passos",
    level: 1,
    title: "Primeiros passos",
    engine: "pdflatex",
    explanation:
      "Todo documento LaTeX começa com \\documentclass, que define o tipo de documento (aqui, 'article'). " +
      "O conteúdo visível fica sempre entre \\begin{document} e \\end{document}. Linhas em branco separam parágrafos.",
    starterCode:
      "\\documentclass{article}\n\n\\begin{document}\n\nOlá, mundo! Este é o meu primeiro documento em LaTeX.\n\n\\end{document}\n",
    challenge: "Adicione mais um parágrafo contando por que você quer aprender LaTeX."
  },
  {
    id: "02-estrutura",
    level: 2,
    title: "Título, autor e seções",
    engine: "pdflatex",
    explanation:
      "\\title, \\author e \\date definem os metadados exibidos por \\maketitle. " +
      "\\section e \\subsection organizam o texto em partes numeradas automaticamente.",
    starterCode:
      "\\documentclass{article}\n\n\\title{Meu Primeiro Documento}\n\\author{Daniel}\n\\date{\\today}\n\n\\begin{document}\n\n\\maketitle\n\n\\section{Introdução}\nAqui eu explico do que se trata o documento.\n\n\\subsection{Motivação}\nUm parágrafo dentro da subseção.\n\n\\end{document}\n",
    challenge: "Adicione uma segunda \\section chamada \"Conclusão\"."
  },
  {
    id: "03-matematica",
    level: 3,
    title: "Modo matemático",
    engine: "pdflatex",
    explanation:
      "Fórmulas entre $...$ aparecem no meio do texto (inline). Entre \\[ ... \\] ou no ambiente equation, " +
      "aparecem centralizadas em destaque. \\frac{a}{b} faz frações e ^ / _ fazem expoentes e índices.",
    starterCode:
      "\\documentclass{article}\n\\usepackage{amsmath}\n\n\\begin{document}\n\nA fórmula de Bhaskara é $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.\n\nEm destaque:\n\\[\n  E = mc^2\n\\]\n\n\\end{document}\n",
    challenge: "Escreva a fórmula da área de um círculo ($A = \\pi r^2$) em modo inline."
  },
  {
    id: "04-listas-tabelas",
    level: 4,
    title: "Listas e tabelas",
    engine: "pdflatex",
    explanation:
      "itemize cria listas com marcadores, enumerate cria listas numeradas. " +
      "O ambiente tabular desenha tabelas: cada 'c'/'l'/'r' na declaração de colunas define o alinhamento, " +
      "'&' separa colunas e '\\\\' quebra a linha.",
    starterCode:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\n\\begin{document}\n\n\\begin{itemize}\n  \\item Primeiro item\n  \\item Segundo item\n\\end{itemize}\n\n\\begin{tabular}{lcc}\n  \\toprule\n  Nome & Nota 1 & Nota 2 \\\\\n  \\midrule\n  Ana & 8.5 & 9.0 \\\\\n  Bruno & 7.0 & 8.0 \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\end{document}\n",
    challenge: "Troque itemize por enumerate e adicione uma terceira linha na tabela."
  },
  {
    id: "05-imagens",
    level: 5,
    title: "Figuras e imagens",
    engine: "pdflatex",
    explanation:
      "O pacote graphicx adiciona \\includegraphics. O ambiente figure posiciona a imagem como uma figura numerada, " +
      "com \\caption para a legenda. Sem um arquivo de imagem disponível, este exemplo desenha um retângulo com \\rule para simular uma imagem.",
    starterCode:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\n\\begin{document}\n\n\\begin{figure}[h]\n  \\centering\n  \\rule{4cm}{3cm} % substitua por \\includegraphics{arquivo.png}\n  \\caption{Uma figura de exemplo.}\n\\end{figure}\n\n\\end{document}\n",
    challenge: "Mude o tamanho do retângulo e o texto da legenda."
  },
  {
    id: "06-cores-codigo",
    level: 6,
    title: "Cores e blocos de código",
    engine: "pdflatex",
    explanation:
      "xcolor permite usar \\textcolor{cor}{texto}. O pacote listings formata blocos de código com destaque de sintaxe, " +
      "útil para documentar programas dentro do seu LaTeX.",
    starterCode:
      "\\documentclass{article}\n\\usepackage{xcolor}\n\\usepackage{listings}\n\n\\begin{document}\n\nTexto \\textcolor{blue}{azul} e \\textcolor{red}{vermelho}.\n\n\\begin{lstlisting}[language=Python]\ndef ola():\n    print(\"Olá, LaTeX!\")\n\\end{lstlisting}\n\n\\end{document}\n",
    challenge: "Troque as cores e o código de exemplo para uma linguagem diferente."
  },
  {
    id: "07-referencias",
    level: 7,
    title: "Referências cruzadas e citações",
    engine: "pdflatex",
    explanation:
      "\\label marca um ponto do documento e \\ref recupera o número dele (seção, figura, equação...). " +
      "Isso evita atualizar números manualmente quando o documento muda.",
    starterCode:
      "\\documentclass{article}\n\n\\begin{document}\n\n\\section{Introdução}\\label{sec:intro}\n\nVeja a Seção~\\ref{sec:conclusao} para saber mais.\n\n\\section{Conclusão}\\label{sec:conclusao}\n\nComo dito na Seção~\\ref{sec:intro}, referências cruzadas são úteis.\n\n\\end{document}\n",
    challenge: "Adicione uma terceira seção e referencie-a a partir da introdução."
  },
  {
    id: "08-tikz",
    level: 8,
    title: "Desenhos com TikZ",
    engine: "pdflatex",
    explanation:
      "TikZ desenha formas geométricas com coordenadas. \\draw desenha linhas/formas, " +
      "e opções como [thick, blue] controlam a aparência. É a base para gráficos e diagramas em LaTeX.",
    starterCode:
      "\\documentclass{article}\n\\usepackage{tikz}\n\n\\begin{document}\n\n\\begin{tikzpicture}\n  \\draw[thick, blue] (0,0) circle (1.5cm);\n  \\draw[thick, red] (-2,0) -- (2,0);\n  \\draw[thick, red] (0,-2) -- (0,2);\n\\end{tikzpicture}\n\n\\end{document}\n",
    challenge: "Adicione um triângulo usando três comandos \\draw com linhas retas."
  },
  {
    id: "09-apresentacao",
    level: 9,
    title: "Sua primeira apresentação (Beamer)",
    engine: "pdflatex",
    explanation:
      "A classe beamer transforma o LaTeX em slides. Cada \\begin{frame}...\\end{frame} é um slide, " +
      "e \\frametitle define o título do slide atual.",
    starterCode:
      "\\documentclass{beamer}\n\n\\title{Minha Primeira Apresentação}\n\\author{Daniel}\n\n\\begin{document}\n\n\\frame{\\titlepage}\n\n\\begin{frame}\n  \\frametitle{Introdução}\n  \\begin{itemize}\n    \\item Primeiro ponto\n    \\item Segundo ponto\n  \\end{itemize}\n\\end{frame}\n\n\\end{document}\n",
    challenge: "Adicione um segundo slide com mais um tópico."
  }
];
