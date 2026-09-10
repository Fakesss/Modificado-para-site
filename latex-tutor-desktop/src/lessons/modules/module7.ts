import type { Lesson } from "../types";

export const module7: Lesson[] = [
  {
    id: "m7-01-sumario-automatico",
    moduleId: "m7",
    order: 1,
    title: "Sumário automático",
    engine: "pdflatex",
    explanation:
      "\\tableofcontents gera um sumário automaticamente, usando os \\section, \\subsection etc. que você já " +
      "escreveu no documento. É preciso compilar duas vezes para os números de página aparecerem certinho da " +
      "primeira vez — este app já faz isso sozinho.",
    example: {
      description: "Um sumário gerado a partir de duas seções.",
      code: "\\documentclass{article}\n\\begin{document}\n\n\\tableofcontents\n\n\\section{Introdução}\nTexto da introdução.\n\n\\section{Desenvolvimento}\nTexto do desenvolvimento.\n\n\\subsection{Um detalhe}\nMais texto.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\n\\tableofcontents\n\n\\section{Introdução}\nTexto aqui.\n\n\\end{document}\n",
    guidedInstructions: "Adicione mais uma \\section e veja o sumário crescer automaticamente.",
    challenge: "Crie um documento com 3 seções e 1 subseção, com sumário no início.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n\\tableofcontents\n\n% suas seções aqui\n\n\\end{document}\n",
    hints: ["Você nunca escreve os números de página do sumário à mão — o LaTeX calcula sozinho."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\tableofcontents\n\n\\section{Introdução}\nTexto.\n\n\\section{Desenvolvimento}\nTexto.\n\n\\subsection{Detalhe}\nMais texto.\n\n\\section{Conclusão}\nTexto final.\n\n\\end{document}\n",
    commandsLearned: ["\\tableofcontents", "\\section", "\\subsection"]
  },
  {
    id: "m7-02-cabecalho-rodape",
    moduleId: "m7",
    order: 2,
    title: "Cabeçalho e rodapé personalizados",
    engine: "pdflatex",
    explanation:
      "O pacote fancyhdr permite personalizar cabeçalho e rodapé com \\pagestyle{fancy}, e comandos como \\lhead, " +
      "\\rhead, \\lfoot, \\rfoot (esquerda/direita, cabeçalho/rodapé) para definir o conteúdo de cada canto.",
    example: {
      description: "Cabeçalho com nome da escola e rodapé com numeração de página.",
      code: "\\documentclass{article}\n\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n\\lhead{Escola Modelo}\n\\rhead{Matemática}\n\\rfoot{Página \\thepage}\n\\begin{document}\n\nConteúdo do documento.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n\\lhead{Minha Escola}\n\\begin{document}\n\nTexto de teste.\n\n\\end{document}\n",
    guidedInstructions: "Adicione \\rhead com o nome da disciplina e \\rfoot com o número da página.",
    challenge: "Monte um cabeçalho completo: nome da escola à esquerda, turma à direita, e \"Página X\" no rodapé direito.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n\\begin{document}\n\nTexto.\n\n\\end{document}\n",
    hints: ["\\thepage insere o número da página atual automaticamente.", "Sempre inclua \\pagestyle{fancy} antes de usar \\lhead/\\rhead/\\lfoot/\\rfoot."],
    solution:
      "\\documentclass{article}\n\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n\\lhead{Escola Modelo}\n\\rhead{Turma 8ºB}\n\\rfoot{Página \\thepage}\n\\begin{document}\n\nTexto.\n\n\\end{document}\n",
    commandsLearned: ["\\pagestyle{fancy}", "\\lhead", "\\rhead", "\\lfoot", "\\rfoot", "\\thepage"]
  },
  {
    id: "m7-03-referencias-bibliograficas",
    moduleId: "m7",
    order: 3,
    title: "Referências bibliográficas",
    engine: "pdflatex",
    explanation:
      "Para citar fontes, uma opção simples é o ambiente thebibliography, onde cada \\bibitem{chave} define uma " +
      "referência que pode ser citada no texto com \\cite{chave}. Para trabalhos maiores, os pacotes biblatex ou " +
      "natbib automatizam isso a partir de um arquivo .bib separado.",
    example: {
      description: "Bibliografia simples com thebibliography.",
      code: "\\documentclass{article}\n\\begin{document}\n\nComo aponta~\\cite{silva2020}, o tema é relevante.\n\n\\begin{thebibliography}{9}\n\\bibitem{silva2020} SILVA, J. \\textit{Título do Livro}. Editora, 2020.\n\\end{thebibliography}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\nTexto citando uma fonte~\\cite{autor2021}.\n\n\\begin{thebibliography}{9}\n\\bibitem{autor2021} AUTOR, N. \\textit{Obra}. Editora, 2021.\n\\end{thebibliography}\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma segunda referência e cite-a em outra frase do texto.",
    challenge: "Crie um documento com duas citações no texto e as duas referências correspondentes na bibliografia.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% texto com citações\n\n\\begin{thebibliography}{9}\n% referências aqui\n\\end{thebibliography}\n\n\\end{document}\n",
    hints: ["A chave usada em \\cite{chave} precisa ser exatamente igual à chave em \\bibitem{chave}."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\nSegundo~\\cite{silva2020} e~\\cite{costa2019}, o assunto é bem documentado.\n\n\\begin{thebibliography}{9}\n\\bibitem{silva2020} SILVA, J. \\textit{Título A}. Editora, 2020.\n\\bibitem{costa2019} COSTA, M. \\textit{Título B}. Editora, 2019.\n\\end{thebibliography}\n\n\\end{document}\n",
    commandsLearned: ["\\cite", "\\begin{thebibliography}", "\\bibitem"]
  },
  {
    id: "m7-04-trabalho-academico",
    moduleId: "m7",
    order: 4,
    title: "Estrutura de um trabalho acadêmico completo",
    engine: "pdflatex",
    explanation:
      "Um trabalho típico junta tudo que você já aprendeu: título, sumário, seções organizadas, e bibliografia no " +
      "final — nessa ordem.",
    example: {
      description: "Esqueleto completo de um trabalho acadêmico curto.",
      code: "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\title{O Uso de Jogos no Ensino de Matemática}\n\\author{Prof. Daniel}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\section{Introdução}\nContextualização do tema.\n\n\\section{Desenvolvimento}\nArgumentos e exemplos.\n\n\\section{Conclusão}\nConsiderações finais.\n\n\\begin{thebibliography}{9}\n\\bibitem{ref1} AUTOR, N. \\textit{Obra}. Editora, 2020.\n\\end{thebibliography}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\title{Meu Trabalho}\n\\author{Seu Nome}\n\\date{\\today}\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\section{Introdução}\nTexto.\n\n\\end{document}\n",
    guidedInstructions: "Adicione as seções Desenvolvimento e Conclusão, e uma bibliografia com pelo menos uma referência.",
    challenge: "Monte um trabalho curto e completo sobre um assunto de sua escolha: título, sumário, 3 seções e bibliografia.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% seu trabalho completo aqui\n\n\\end{document}\n",
    hints: ["A ordem certa é: \\maketitle, depois \\tableofcontents, depois as seções, e a bibliografia por último."],
    solution:
      "\\documentclass{article}\n\\title{A Matemática no Dia a Dia}\n\\author{Prof. Daniel}\n\\date{\\today}\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\section{Introdução}\nA matemática está presente em situações cotidianas.\n\n\\section{Desenvolvimento}\nExemplos práticos de aplicação.\n\n\\section{Conclusão}\nReforço da importância do tema.\n\n\\begin{thebibliography}{9}\n\\bibitem{ref1} AUTOR, N. \\textit{Matemática Aplicada}. Editora, 2022.\n\\end{thebibliography}\n\n\\end{document}\n",
    commandsLearned: ["\\maketitle", "\\tableofcontents", "\\section"]
  },
  {
    id: "m7-05-lista-exercicios-prova",
    moduleId: "m7",
    order: 5,
    title: "Lista de exercícios e provas",
    engine: "pdflatex",
    explanation:
      "Juntando cabeçalho de identificação (tabela), questões numeradas (enumerate) e espaço para resposta " +
      "(\\vspace ou \\rule), dá para montar provas e listas de exercícios prontas para impressão.",
    example: {
      description: "Uma lista de exercícios com cabeçalho e espaço para resposta.",
      code: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{6cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{0.5cm}\n\\begin{enumerate}\n  \\item Quanto é $12 \\times 8$?\n\n  \\vspace{1.5cm}\n\n  \\item Resolva: $2x + 6 = 20$.\n\n  \\vspace{1.5cm}\n\\end{enumerate}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\n\\begin{enumerate}\n  \\item Quanto é $5 + 7$?\n\\end{enumerate}\n\n\\end{document}\n",
    guidedInstructions: "Adicione \\vspace{1.5cm} depois da questão, para deixar espaço de resposta.",
    challenge: "Monte uma lista de exercícios com cabeçalho (nome/turma) e 3 questões de matemática, cada uma com espaço para resposta.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n% lista de exercícios completa\n\n\\end{document}\n",
    hints: ["\\vspace{tamanho} cria um espaço vertical em branco — bom para o aluno responder por escrito."],
    solution:
      "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\n\\begin{tabular}{ll}\n  \\toprule\n  Nome: & \\rule{6cm}{0.4pt} \\quad Turma: \\rule{2cm}{0.4pt} \\\\\n  \\bottomrule\n\\end{tabular}\n\n\\vspace{0.5cm}\n\\begin{enumerate}\n  \\item Quanto é $9 \\times 7$? \\vspace{1cm}\n  \\item Resolva $4x = 20$. \\vspace{1cm}\n  \\item Qual o perímetro de um quadrado de lado 6 cm? \\vspace{1cm}\n\\end{enumerate}\n\n\\end{document}\n",
    commandsLearned: ["\\vspace", "\\rule", "\\begin{enumerate}"]
  },
  {
    id: "m7-06-plano-de-aula",
    moduleId: "m7",
    order: 6,
    title: "Plano de aula",
    engine: "pdflatex",
    explanation:
      "Um plano de aula organiza informações em seções claras: identificação, objetivos, conteúdo, metodologia e " +
      "avaliação — um uso direto de \\section e listas que você já domina.",
    example: {
      description: "Estrutura básica de um plano de aula.",
      code: "\\documentclass{article}\n\\begin{document}\n\n\\section*{Identificação}\nDisciplina: Matemática \\quad Turma: 8º Ano \\quad Duração: 50 min\n\n\\section*{Objetivos}\n\\begin{itemize}\n  \\item Compreender equações do 1º grau\n  \\item Resolver problemas contextualizados\n\\end{itemize}\n\n\\section*{Metodologia}\nAula expositiva seguida de exercícios em duplas.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\n\\section*{Identificação}\nDisciplina: Matemática\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma seção \\section*{Objetivos} com uma lista de pelo menos 2 itens.",
    challenge: "Monte um plano de aula com Identificação, Objetivos, Conteúdo e Avaliação.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% plano de aula completo\n\n\\end{document}\n",
    hints: ["\\section* (com asterisco) cria uma seção sem número — comum em documentos administrativos como este."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\section*{Identificação}\nDisciplina: Matemática \\quad Turma: 8º Ano\n\n\\section*{Objetivos}\n\\begin{itemize}\n  \\item Resolver equações do 1º grau\n\\end{itemize}\n\n\\section*{Conteúdo}\nEquações do 1º grau com uma incógnita.\n\n\\section*{Avaliação}\nLista de exercícios ao final da aula.\n\n\\end{document}\n",
    commandsLearned: ["\\section*"]
  },
  {
    id: "m7-07-apresentacoes-beamer",
    moduleId: "m7",
    order: 7,
    title: "Apresentações com Beamer",
    engine: "pdflatex",
    explanation:
      "A classe beamer transforma o documento em uma apresentação de slides. Cada \\begin{frame}...\\end{frame} " +
      "é um slide; \\frametitle define o título do slide atual, e \\frame{\\titlepage} gera automaticamente um " +
      "slide de capa com título/autor/data.",
    example: {
      description: "Uma apresentação de 2 slides com capa.",
      code: "\\documentclass{beamer}\n\n\\title{Equações do 1º Grau}\n\\author{Prof. Daniel}\n\n\\begin{document}\n\n\\frame{\\titlepage}\n\n\\begin{frame}\n  \\frametitle{O que é uma equação?}\n  \\begin{itemize}\n    \\item Uma igualdade com uma incógnita\n    \\item Exemplo: $2x + 3 = 7$\n  \\end{itemize}\n\\end{frame}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{beamer}\n\\title{Meu Tema}\n\\author{Seu Nome}\n\\begin{document}\n\n\\frame{\\titlepage}\n\n\\begin{frame}\n  \\frametitle{Primeiro slide}\n  Conteúdo aqui.\n\\end{frame}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um segundo slide com uma lista de itens.",
    challenge: "Crie uma apresentação de 3 slides sobre um conteúdo à sua escolha: capa + 2 slides de conteúdo.",
    challengeStarter: "\\documentclass{beamer}\n\\begin{document}\n\n% sua apresentação\n\n\\end{document}\n",
    hints: ["Cada slide fica dentro do seu próprio \\begin{frame}...\\end{frame}.", "\\frame{\\titlepage} só funciona se \\title e \\author já foram definidos antes."],
    solution:
      "\\documentclass{beamer}\n\\title{Frações}\n\\author{Prof. Daniel}\n\\begin{document}\n\n\\frame{\\titlepage}\n\n\\begin{frame}\n  \\frametitle{O que é uma fração?}\n  Representa uma parte de um todo, como $\\frac{1}{2}$.\n\\end{frame}\n\n\\begin{frame}\n  \\frametitle{Exemplos}\n  \\begin{itemize}\n    \\item $\\frac{1}{4}$ de uma pizza\n    \\item $\\frac{3}{4}$ de hora\n  \\end{itemize}\n\\end{frame}\n\n\\end{document}\n",
    commandsLearned: ["\\documentclass{beamer}", "\\begin{frame}", "\\frametitle", "\\frame{\\titlepage}"]
  }
];
