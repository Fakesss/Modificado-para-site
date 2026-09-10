import type { Lesson } from "../types";

export const module5: Lesson[] = [
  {
    id: "m5-01-inserir-imagens",
    moduleId: "m5",
    order: 1,
    title: "Inserir imagens",
    engine: "pdflatex",
    explanation:
      "O pacote graphicx adiciona \\includegraphics{arquivo}, que insere uma imagem (PNG, JPG ou PDF) salva na " +
      "mesma pasta do seu documento. Como este app ainda não tem um arquivo de imagem de exemplo, os exercícios " +
      "aqui usam \\rule{largura}{altura} para simular o espaço de uma imagem — na sua vida real, é só trocar o " +
      "\\rule por \\includegraphics{nome-do-arquivo.png}.",
    example: {
      description: "Onde uma imagem real entraria (simulada com \\rule).",
      code: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\nAqui está uma imagem:\n\n\\rule{5cm}{4cm} % troque por: \\includegraphics{arquivo.png}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\rule{4cm}{3cm} % substitua por \\includegraphics{arquivo.png}\n\n\\end{document}\n",
    guidedInstructions: "Mude o tamanho do retângulo (que está representando a imagem) para 6cm por 4cm.",
    challenge: "Escreva uma frase introduzindo uma \"foto\" (retângulo) de 8cm por 5cm.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n% frase + imagem simulada\n\n\\end{document}\n",
    hints: ["A sintaxe é \\rule{largura}{altura}, sempre em cm ou outra unidade.", "No seu computador, use \\includegraphics{nome.png} com o arquivo na mesma pasta do .tex."],
    solution:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\nVeja a foto da atividade:\n\n\\rule{8cm}{5cm} % troque por \\includegraphics{foto.png}\n\n\\end{document}\n",
    commandsLearned: ["\\includegraphics", "\\usepackage{graphicx}"]
  },
  {
    id: "m5-02-tamanho-posicao",
    moduleId: "m5",
    order: 2,
    title: "Tamanho e posicionamento de imagens",
    engine: "pdflatex",
    explanation:
      "\\includegraphics[width=5cm]{arquivo} controla a largura da imagem (a altura ajusta proporcionalmente). " +
      "Para centralizar, envolva o comando em \\begin{center}...\\end{center}. width=\\textwidth faz a imagem " +
      "ocupar toda a largura útil da página.",
    example: {
      description: "Imagem simulada, centralizada, com largura controlada.",
      code: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\begin{center}\n\\rule{0.5\\textwidth}{4cm} % \\includegraphics[width=0.5\\textwidth]{arquivo.png}\n\\end{center}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\rule{6cm}{4cm}\n\n\\end{document}\n",
    guidedInstructions: "Envolva a imagem simulada em \\begin{center}...\\end{center} para centralizá-la.",
    challenge: "Crie uma imagem simulada ocupando metade da largura da página (0.5\\textwidth) e centralizada.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n% imagem centralizada com metade da largura\n\n\\end{document}\n",
    hints: ["\\textwidth é a largura útil da página — 0.5\\textwidth é metade dela."],
    solution:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\begin{center}\n\\rule{0.5\\textwidth}{4cm}\n\\end{center}\n\n\\end{document}\n",
    commandsLearned: ["width=", "\\textwidth", "\\begin{center}"]
  },
  {
    id: "m5-03-legendas-figure",
    moduleId: "m5",
    order: 3,
    title: "Legendas com o ambiente figure",
    engine: "pdflatex",
    explanation:
      "O ambiente figure envolve uma imagem e permite adicionar \\caption{texto} (a legenda numerada " +
      "automaticamente) e \\label{nome} (para referenciá-la depois com \\ref ou \\eqref-like \\ref).",
    example: {
      description: "Uma figura com legenda e referência cruzada.",
      code: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\nVeja a Figura~\\ref{fig:exemplo}.\n\n\\begin{figure}[h]\n  \\centering\n  \\rule{5cm}{4cm}\n  \\caption{Um gráfico de exemplo.}\n  \\label{fig:exemplo}\n\\end{figure}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\begin{figure}[h]\n  \\centering\n  \\rule{4cm}{3cm}\n  \\caption{Minha figura}\n\\end{figure}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um \\label à figura e cite-a com \\ref antes dela.",
    challenge: "Crie duas figuras com legendas diferentes e cite as duas no texto usando \\ref.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n% duas figuras com legenda\n\n\\end{document}\n",
    hints: ["\\centering substitui o \\begin{center}...\\end{center} dentro de uma figure.", "\\label precisa vir depois de \\caption para referenciar o número certo."],
    solution:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\nAs Figuras~\\ref{fig:um} e~\\ref{fig:dois} ilustram o conteúdo.\n\n\\begin{figure}[h]\n  \\centering\n  \\rule{4cm}{3cm}\n  \\caption{Primeira figura.}\n  \\label{fig:um}\n\\end{figure}\n\n\\begin{figure}[h]\n  \\centering\n  \\rule{4cm}{3cm}\n  \\caption{Segunda figura.}\n  \\label{fig:dois}\n\\end{figure}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{figure}", "\\caption", "\\centering", "\\ref"]
  },
  {
    id: "m5-04-imagens-lado-a-lado",
    moduleId: "m5",
    order: 4,
    title: "Várias imagens lado a lado",
    engine: "pdflatex",
    explanation:
      "Para colocar duas imagens uma ao lado da outra, use duas \\minipage (uma caixa que ocupa uma fração da " +
      "largura da página) dentro da mesma figure, ou o pacote subcaption para subfiguras com legenda própria.",
    example: {
      description: "Duas imagens simuladas lado a lado com minipage.",
      code: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\begin{figure}[h]\n  \\centering\n  \\begin{minipage}{0.45\\textwidth}\n    \\centering\n    \\rule{4cm}{3cm}\n    \\caption{Antes}\n  \\end{minipage}\n  \\hfill\n  \\begin{minipage}{0.45\\textwidth}\n    \\centering\n    \\rule{4cm}{3cm}\n    \\caption{Depois}\n  \\end{minipage}\n\\end{figure}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\begin{minipage}{0.45\\textwidth}\n  \\centering\n  \\rule{4cm}{3cm}\n\\end{minipage}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma segunda minipage ao lado da primeira, separadas por \\hfill.",
    challenge: "Coloque três imagens simuladas lado a lado, cada uma ocupando cerca de 30% da largura.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n% três imagens lado a lado\n\n\\end{document}\n",
    hints: ["\\hfill entre as minipages distribui o espaço em branco entre elas.", "A soma das larguras das minipages não deve passar de 1\\textwidth (100%)."],
    solution:
      "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\n\\begin{minipage}{0.3\\textwidth}\n  \\centering\\rule{3cm}{2cm}\n\\end{minipage}\n\\hfill\n\\begin{minipage}{0.3\\textwidth}\n  \\centering\\rule{3cm}{2cm}\n\\end{minipage}\n\\hfill\n\\begin{minipage}{0.3\\textwidth}\n  \\centering\\rule{3cm}{2cm}\n\\end{minipage}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{minipage}", "\\hfill"]
  },
  {
    id: "m5-05-formas-geometricas-simples",
    moduleId: "m5",
    order: 5,
    title: "Formas geométricas simples sem pacotes extras",
    engine: "pdflatex",
    explanation:
      "Antes de aprender TikZ (no próximo módulo), dá para criar formas bem simples com o que você já conhece: " +
      "\\rule desenha retângulos e quadrados preenchidos. Para formas mais elaboradas (círculos, triângulos, " +
      "ângulos), o módulo de TikZ é o caminho certo.",
    example: {
      description: "Um quadrado e um retângulo feitos com \\rule.",
      code: "\\documentclass{article}\n\\begin{document}\n\nQuadrado: \\rule{2cm}{2cm}\n\nRetângulo: \\rule{5cm}{2cm}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\nQuadrado: \\rule{2cm}{2cm}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um retângulo bem fino e comprido (por exemplo, \\rule{8cm}{0.2cm}).",
    challenge: "Desenhe \"degraus\" com 3 retângulos de larguras crescentes (2cm, 4cm, 6cm), um abaixo do outro.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% três retângulos em degrau\n\n\\end{document}\n",
    hints: ["Coloque cada \\rule em uma linha separada, com uma linha em branco entre elas para virarem blocos distintos."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\rule{2cm}{1cm}\n\n\\rule{4cm}{1cm}\n\n\\rule{6cm}{1cm}\n\n\\end{document}\n",
    commandsLearned: ["\\rule"]
  }
];
