import type { Lesson } from "../types";

export const module2: Lesson[] = [
  {
    id: "m2-01-negrito-italico-sublinhado",
    moduleId: "m2",
    order: 1,
    title: "Negrito, itálico e sublinhado",
    engine: "pdflatex",
    explanation:
      "\\textbf{...} deixa o texto em negrito, \\textit{...} em itálico, e \\underline{...} sublinha. Eles podem " +
      "ser combinados um dentro do outro.",
    example: {
      description: "Os três estilos básicos de ênfase.",
      code: "\\documentclass{article}\n\\begin{document}\n\nTexto \\textbf{em negrito}, texto \\textit{em itálico} e texto \\underline{sublinhado}.\n\nTambém dá para combinar: \\textbf{\\textit{negrito e itálico juntos}}.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\nEscreva uma frase \\textbf{com negrito}.\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma frase com itálico e outra sublinhada.",
    challenge: "Escreva o nome das três operações (adição, subtração, multiplicação) cada uma em um estilo diferente: negrito, itálico e sublinhado.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% adição, subtração e multiplicação\n\n\\end{document}\n",
    hints: ["\\textbf{}, \\textit{} e \\underline{} sempre precisam de chaves { } ao redor do texto."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\textbf{Adição}, \\textit{subtração} e \\underline{multiplicação}.\n\n\\end{document}\n",
    commandsLearned: ["\\textbf", "\\textit", "\\underline"]
  },
  {
    id: "m2-02-tamanhos-fonte",
    moduleId: "m2",
    order: 2,
    title: "Tamanhos de fonte",
    engine: "pdflatex",
    explanation:
      "Comandos como \\small, \\large, \\Large, \\huge mudam o tamanho do texto a partir de onde são escritos. " +
      "Para afetar só um trecho, coloque-o entre chaves: {\\Large texto grande}.",
    example: {
      description: "Vários tamanhos de fonte em sequência.",
      code: "\\documentclass{article}\n\\begin{document}\n\n{\\small Texto pequeno.}\n\nTexto normal.\n\n{\\large Texto grande.}\n\n{\\Huge Texto enorme.}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\n{\\large Um título maior}\n\nTexto normal do parágrafo.\n\n\\end{document}\n",
    guidedInstructions: "Experimente trocar \\large por \\Large, \\huge ou \\small e veja a diferença.",
    challenge: "Crie um cartaz simples com um título bem grande (\\Huge) e um subtítulo menor (\\large) logo abaixo.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% título e subtítulo\n\n\\end{document}\n",
    hints: ["Use chaves { } ao redor do trecho para o tamanho não afetar o resto do documento.", "A ordem do menor para o maior é: \\tiny, \\small, \\normalsize, \\large, \\Large, \\LARGE, \\huge, \\Huge."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n{\\Huge Feira de Matemática}\n\n{\\large 7º ao 9º ano --- Auditório principal}\n\n\\end{document}\n",
    commandsLearned: ["\\small", "\\large", "\\Large", "\\huge", "\\Huge"]
  },
  {
    id: "m2-03-alinhamento",
    moduleId: "m2",
    order: 3,
    title: "Alinhamento de texto",
    engine: "pdflatex",
    explanation:
      "Os ambientes \\begin{center}, \\begin{flushleft} e \\begin{flushright} alinham um bloco de texto ao centro, " +
      "à esquerda ou à direita. Por padrão, o texto já é justificado (alinhado nas duas margens).",
    example: {
      description: "Os três alinhamentos possíveis.",
      code: "\\documentclass{article}\n\\begin{document}\n\n\\begin{center}\nEste texto está centralizado.\n\\end{center}\n\n\\begin{flushright}\nEste texto está alinhado à direita.\n\\end{flushright}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\n\\begin{center}\nTítulo Centralizado\n\\end{center}\n\n\\end{document}\n",
    guidedInstructions: "Adicione um bloco \\begin{flushright}...\\end{flushright} com seu nome, como se fosse uma assinatura.",
    challenge: "Monte um cabeçalho de carta: nome alinhado à direita no topo e um título centralizado logo abaixo.",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% cabeçalho da carta\n\n\\end{document}\n",
    hints: ["\\begin{flushright} e \\end{flushright} precisam ter o mesmo nome no começo e no fim."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\begin{flushright}\nDaniel\n\\end{flushright}\n\n\\begin{center}\n\\Large Carta aos alunos\n\\end{center}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{center}", "\\begin{flushleft}", "\\begin{flushright}"]
  },
  {
    id: "m2-04-listas",
    moduleId: "m2",
    order: 4,
    title: "Listas numeradas e não numeradas",
    engine: "pdflatex",
    explanation:
      "\\begin{itemize} cria listas com marcadores (bolinhas), e \\begin{enumerate} cria listas numeradas " +
      "automaticamente. Em ambas, cada item começa com \\item. As listas podem ser aninhadas (uma dentro da outra).",
    example: {
      description: "Lista numerada com uma lista de marcadores dentro.",
      code: "\\documentclass{article}\n\\begin{document}\n\n\\begin{enumerate}\n  \\item Primeiro passo\n  \\item Segundo passo, que inclui:\n  \\begin{itemize}\n    \\item um detalhe\n    \\item outro detalhe\n  \\end{itemize}\n  \\item Terceiro passo\n\\end{enumerate}\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\begin{document}\n\n\\begin{itemize}\n  \\item Primeiro item\n  \\item Segundo item\n\\end{itemize}\n\n\\end{document}\n",
    guidedInstructions: "Troque itemize por enumerate e veja os marcadores virarem números.",
    challenge: "Faça uma lista numerada com os passos para resolver uma equação do 1º grau (pelo menos 3 passos).",
    challengeStarter: "\\documentclass{article}\n\\begin{document}\n\n% lista numerada\n\n\\end{document}\n",
    hints: ["Cada \\item vira um marcador ou número automaticamente — você não escreve os números à mão."],
    solution:
      "\\documentclass{article}\n\\begin{document}\n\n\\begin{enumerate}\n  \\item Isolar o termo com x de um lado da igualdade\n  \\item Isolar os números do outro lado\n  \\item Dividir os dois lados pelo coeficiente de x\n\\end{enumerate}\n\n\\end{document}\n",
    commandsLearned: ["\\begin{itemize}", "\\begin{enumerate}", "\\item"]
  },
  {
    id: "m2-05-cores",
    moduleId: "m2",
    order: 5,
    title: "Cores no texto",
    engine: "pdflatex",
    explanation:
      "Com o pacote xcolor, \\textcolor{cor}{texto} pinta um trecho de texto, e \\colorbox{cor}{texto} coloca um " +
      "fundo colorido atrás dele. Existem cores prontas (red, blue, green...) e também é possível criar cores " +
      "personalizadas.",
    example: {
      description: "Texto colorido e destacado com fundo.",
      code: "\\documentclass{article}\n\\usepackage{xcolor}\n\\begin{document}\n\nTexto \\textcolor{red}{vermelho} e \\textcolor{blue}{azul}.\n\nTexto com \\colorbox{yellow}{fundo amarelo}.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage{xcolor}\n\\begin{document}\n\nTexto \\textcolor{blue}{azul}.\n\n\\end{document}\n",
    guidedInstructions: "Troque a cor por green ou orange, e adicione um \\colorbox.",
    challenge: "Destaque a palavra \"importante\" com um \\colorbox amarelo dentro de uma frase.",
    challengeStarter:
      "\\documentclass{article}\n\\usepackage{xcolor}\n\\begin{document}\n\nEsta informação é importante.\n\n\\end{document}\n",
    hints: ["Não esqueça \\usepackage{xcolor} no preâmbulo, senão \\textcolor não funciona."],
    solution:
      "\\documentclass{article}\n\\usepackage{xcolor}\n\\begin{document}\n\nEsta informação é \\colorbox{yellow}{importante}.\n\n\\end{document}\n",
    commandsLearned: ["\\textcolor", "\\colorbox"]
  },
  {
    id: "m2-06-caixas-destaques",
    moduleId: "m2",
    order: 6,
    title: "Caixas e destaques",
    engine: "pdflatex",
    explanation:
      "\\fbox{texto} desenha uma caixa simples com borda ao redor de um texto, já disponível sem pacotes extras. " +
      "Para caixas mais elaboradas e coloridas, o pacote tcolorbox oferece o ambiente \\begin{tcolorbox}...\\end{tcolorbox}.",
    example: {
      description: "Uma caixa simples e uma caixa colorida com tcolorbox.",
      code: "\\documentclass{article}\n\\usepackage{tcolorbox}\n\\begin{document}\n\n\\fbox{Texto em uma caixa simples}\n\n\\begin{tcolorbox}[colback=blue!5, colframe=blue!50]\nDica: revise a matéria antes da prova!\n\\end{tcolorbox}\n\n\\end{document}\n"
    },
    guidedStarter: "\\documentclass{article}\n\\begin{document}\n\n\\fbox{Aviso importante}\n\n\\end{document}\n",
    guidedInstructions: "Adicione \\usepackage{tcolorbox} e crie uma caixa colorida com um recado.",
    challenge: "Crie uma caixa de \"Dica\" e outra de \"Atenção\" com cores diferentes usando tcolorbox.",
    challengeStarter: "\\documentclass{article}\n\\usepackage{tcolorbox}\n\\begin{document}\n\n% caixa de dica e caixa de atenção\n\n\\end{document}\n",
    hints: ["colback muda a cor de fundo e colframe a cor da borda.", "Você pode usar cor!número (como blue!10) para tons mais claros."],
    solution:
      "\\documentclass{article}\n\\usepackage{tcolorbox}\n\\begin{document}\n\n\\begin{tcolorbox}[colback=green!5, colframe=green!50]\nDica: revise antes da prova.\n\\end{tcolorbox}\n\n\\begin{tcolorbox}[colback=red!5, colframe=red!50]\nAtenção: não esqueça a calculadora.\n\\end{tcolorbox}\n\n\\end{document}\n",
    commandsLearned: ["\\fbox", "\\begin{tcolorbox}"]
  },
  {
    id: "m2-07-acentos-caracteres-especiais",
    moduleId: "m2",
    order: 7,
    title: "Caracteres especiais, acentos e pontuação",
    engine: "pdflatex",
    explanation:
      "Com \\usepackage[utf8]{inputenc}, você pode digitar acentos normalmente (á, ç, ã). Alguns caracteres têm " +
      "significado especial em LaTeX e precisam de \\ na frente para aparecerem literalmente: %, $, &, #, _ viram " +
      "\\%, \\$, \\&, \\#, \\_. Travessão (---) e aspas (``assim'') também têm sintaxe própria.",
    example: {
      description: "Acentos e símbolos especiais escapados corretamente.",
      code: "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\begin{document}\n\nO desconto é de 20\\% e custa R\\$ 50 --- uma pechincha!\n\n``Matemática é divertida'', dizia o professor.\n\n\\end{document}\n"
    },
    guidedStarter:
      "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\begin{document}\n\nO valor é 10\\%.\n\n\\end{document}\n",
    guidedInstructions: "Adicione uma frase usando R\\$ e um travessão (---).",
    challenge: "Escreva uma frase com um valor em porcentagem, um valor em reais e uma citação entre aspas duplas de LaTeX (``assim'').",
    challengeStarter: "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\begin{document}\n\n% sua frase aqui\n\n\\end{document}\n",
    hints: ["% sozinho iniciaria um comentário — por isso precisa escrever \\% para ele aparecer no texto.", "Aspas de abertura são duas crases `` e aspas de fechamento são duas apóstrofes ''."],
    solution:
      "\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\begin{document}\n\nA turma teve 90\\% de aprovação, um investimento de R\\$ 200 em material e, como dizia a coordenadora, ``o resultado valeu a pena''.\n\n\\end{document}\n",
    commandsLearned: ["\\%", "\\$", "\\&", "\\#", "\\_", "---", "``", "''"]
  }
];
