import type { Lesson } from "../types";

export const module1: Lesson[] = [
  {
    id: "m1-01-o-que-e-latex",
    moduleId: "m1",
    order: 1,
    title: "O que é LaTeX e como compilar",
    engine: "pdflatex",
    explanation:
      "LaTeX não é um editor de texto comum: você escreve comandos (que começam com \\) descrevendo o que o texto " +
      "significa (um título, uma seção, uma fórmula), e um programa chamado motor LaTeX (aqui, o pdflatex) lê esse " +
      "código e gera um PDF pronto e bem formatado. Sempre que você editar o código, é preciso compilar de novo " +
      "para ver o resultado atualizado — este app faz isso automaticamente enquanto você digita.",
    example: {
      description: "O menor documento LaTeX possível.",
      code: "\\documentclass{article}\n\n\\begin{document}\n\nOlá, mundo!\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\n\\begin{document}\n\nOlá, mundo!\n\n\\end{document}\n",
    guidedInstructions:
      "Troque o texto \"Olá, mundo!\" por uma frase sua e veja a pré-visualização atualizar sozinha do lado direito.",
    challenge: "Escreva um documento simples se apresentando em duas ou três frases.",
    challengeStarter: "\\documentclass{article}\n\n\\begin{document}\n\n% escreva aqui\n\n\\end{document}\n",
    hints: [
      "Todo documento precisa de \\documentclass no início.",
      "O texto que aparece no PDF fica sempre entre \\begin{document} e \\end{document}.",
      "Deixar uma linha em branco entre frases cria um novo parágrafo."
    ],
    solution:
      "\\documentclass{article}\n\n\\begin{document}\n\n% Aqui vai o texto de apresentação\nMeu nome é Daniel e sou professor de matemática.\nGosto de ensinar usando ferramentas visuais e tecnologia.\n\n\\end{document}\n",
    commandsLearned: ["\\documentclass", "\\begin{document}", "\\end{document}"]
  },
  {
    id: "m1-02-estrutura-basica",
    moduleId: "m1",
    order: 2,
    title: "Estrutura básica de um documento",
    engine: "pdflatex",
    explanation:
      "Um documento LaTeX tem duas partes: o preâmbulo (tudo antes de \\begin{document}, onde você configura o " +
      "documento e carrega pacotes) e o corpo (o conteúdo visível, entre \\begin{document} e \\end{document}). " +
      "Nada que estiver fora dessas duas áreas é exibido no PDF.",
    example: {
      description: "Documento com preâmbulo e corpo bem separados.",
      code: "\\documentclass{article}\n% --- preâmbulo: configurações e pacotes ---\n\\usepackage[utf8]{inputenc}\n\n\\begin{document}\n% --- corpo: o que aparece no PDF ---\nEste texto aparece no PDF.\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\begin{document}\n\nEste texto aparece no PDF.\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma segunda linha de texto no corpo e confirme que ela aparece no PDF.",
    challenge: "Adicione um comando \\usepackage extra no preâmbulo (por exemplo, \\usepackage{xcolor}) sem usá-lo ainda, e confirme que o documento continua compilando normalmente.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n% adicione um \\usepackage aqui\n\n\\begin{document}\n\nTexto de teste.\n\n\\end{document}\n",
    hints: [
      "\\usepackage{nome} sempre vai no preâmbulo, nunca dentro do \\begin{document}.",
      "Carregar um pacote sem usá-lo não gera erro."
    ],
    solution:
      "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{xcolor} % carregado, mesmo sem uso ainda\n\n\\begin{document}\n\nTexto de teste.\n\n\\end{document}\n",
    commandsLearned: ["\\usepackage"]
  },
  {
    id: "m1-03-titulo-autor-data",
    moduleId: "m1",
    order: 3,
    title: "Título, autor e data",
    engine: "pdflatex",
    explanation:
      "\\title, \\author e \\date definem as informações do documento, e \\maketitle (dentro do corpo) desenha " +
      "esse cabeçalho formatado. \\today insere a data atual automaticamente.",
    example: {
      description: "Página de título simples.",
      code: "\\documentclass{article}\n\n\\title{Lista de Exercícios}\n\\author{Prof. Daniel}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\nConteúdo do documento aqui.\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\n\\title{Meu Documento}\n\\author{Seu Nome}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\nConteúdo aqui.\n\n\\end{document}\n",
    guidedInstructions: "Troque o título e o autor pelos seus próprios dados.",
    challenge: "Crie um cabeçalho para uma \"Prova de Matemática — 7º Ano\" com uma data fixa (não use \\today).",
    challengeStarter: "\\documentclass{article}\n\n% defina \\title, \\author e \\date\n\n\\begin{document}\n\\maketitle\n\n\\end{document}\n",
    hints: [
      "Uma data fixa pode ser um texto normal, como \\date{15 de março de 2026}.",
      "Não esqueça de chamar \\maketitle dentro do \\begin{document}, ou o cabeçalho não aparece."
    ],
    solution:
      "\\documentclass{article}\n\n\\title{Prova de Matemática --- 7º Ano}\n\\author{Prof. Daniel}\n\\date{15 de março de 2026}\n\n\\begin{document}\n\\maketitle\n\n\\end{document}\n",
    commandsLearned: ["\\title", "\\author", "\\date", "\\maketitle", "\\today"]
  },
  {
    id: "m1-04-paragrafos-quebras",
    moduleId: "m1",
    order: 4,
    title: "Parágrafos e quebras de linha",
    engine: "pdflatex",
    explanation:
      "No LaTeX, uma linha em branco no código cria um novo parágrafo (com recuo automático). Uma única quebra de " +
      "linha no código NÃO cria uma nova linha no PDF — para forçar uma quebra de linha sem novo parágrafo, use " +
      "\\\\ ou \\newline. Para pular uma página inteira, use \\newpage.",
    example: {
      description: "Diferença entre parágrafo novo e quebra de linha forçada.",
      code: "\\documentclass{article}\n\\begin{document}\n\nEste é o primeiro parágrafo.\n\nEste é o segundo parágrafo (linha em branco antes).\n\nEsta linha\\\\ quebra sem criar um parágrafo novo.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\nPrimeiro parágrafo.\n\nSegundo parágrafo.\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma linha usando \\\\ no meio de um parágrafo para ver a diferença.",
    challenge: "Escreva um pequeno poema de 4 linhas onde cada linha termina com \\\\, formando um único parágrafo com quebras manuais.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% seu poema aqui\n\n\\end{document}\n",
    hints: ["Cada linha do poema deve terminar com \\\\ (menos a última).", "Não deixe linhas em branco entre os versos, senão vira um parágrafo novo."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\nMatemática é arte,\\\\\nnúmeros contam histórias,\\\\\ncada fórmula, uma parte\\\\\nde infinitas trajetórias.\n\n\\end{document}\n",
    commandsLearned: ["\\\\", "\\newline", "\\newpage"]
  },
  {
    id: "m1-05-comentarios",
    moduleId: "m1",
    order: 5,
    title: "Comentários com %",
    engine: "pdflatex",
    explanation:
      "Tudo depois de um % em uma linha é ignorado pelo LaTeX — serve para você deixar anotações no código sem " +
      "que apareçam no PDF, ou para \"desligar\" temporariamente um trecho sem apagá-lo.",
    example: {
      description: "Comentários explicando o código e desativando uma linha.",
      code: "\\documentclass{article}\n\\begin{document}\n\n% Este texto não aparece no PDF\nEste texto aparece normalmente.\n% \\section{Rascunho} este título está desativado por enquanto\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\n% escreva um comentário aqui\nTexto normal.\n\n\\end{document}\n",
    guidedInstructions: "Adicione um comentário explicando o que o texto abaixo dele faz.",
    challenge: "Escreva duas frases e \"comente\" (desative) uma delas com %, deixando só a outra visível no PDF.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\nFrase um.\nFrase dois.\n\n\\end{document}\n",
    hints: ["Colocar % no início da linha desativa a linha inteira.", "O % também funciona no meio da linha: tudo depois dele até o fim da linha é ignorado."],
    solution: "\\documentclass{article}\n\\begin{document}\n\nFrase um.\n% Frase dois. (desativada por enquanto)\n\n\\end{document}\n",
    commandsLearned: ["%"]
  },
  {
    id: "m1-06-interpretando-erros",
    moduleId: "m1",
    order: 6,
    title: "Como compilar e interpretar erros",
    engine: "pdflatex",
    explanation:
      "Quando algo dá errado, o app mostra o trecho problemático destacado no editor, com uma mensagem em português " +
      "simples, além de um log técnico completo (para quem quiser se aprofundar). Os erros mais comuns de " +
      "iniciante são: esquecer de fechar uma chave `}`, esquecer um \\end{...} de um \\begin{...}, ou escrever um " +
      "comando com o nome errado.",
    example: {
      description: "Um erro comum: chave não fechada (\\textbf{ sem o } no final).",
      code: "\\documentclass{article}\n\\begin{document}\n\nEste texto está \\textbf{em negrito\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\nEste texto está \\textbf{em negrito\n\n\\end{document}\n",
    guidedInstructions:
      "Veja o erro aparecer no painel abaixo do editor e na linha destacada. Corrija adicionando a chave `}` que falta e observe o erro desaparecer.",
    challenge: "Escreva um \\begin{center} sem o \\end{center} correspondente e observe como o app aponta o problema.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n\\begin{center}\nTexto centralizado\n\n\\end{document}\n",
    hints: [
      "O painel de erros mostra em qual linha está o problema e permite clicar para pular direto até ela.",
      "Ambientes (\\begin{x}) sempre precisam do \\end{x} correspondente, com o mesmo nome."
    ],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\begin{center}\nTexto centralizado\n\\end{center}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{center}", "\\end{center}"]
  }
];
