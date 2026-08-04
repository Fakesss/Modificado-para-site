# KubiTeX (desktop, offline)

_Pronuncia-se "Kú-bi-tés"._

Aplicativo desktop para Windows que ensina LaTeX por uma trilha progressiva de
módulos e também oferece um modo livre para programar qualquer documento, com
pré-visualização em PDF ao vivo lado a lado com o editor (redimensionável e
recolhível).

## O que já está pronto

- **Aprender**: 9 módulos (Primeiros passos, Formatação de texto, Matemática,
  Tabelas, Imagens, TikZ, Documentos completos, Malhas e planos para
  professores, Posicionamento e coordenadas no TikZ) somando quase 70 aulas.
  Cada aula tem explicação, exemplo pronto (com botão para inserir no editor),
  exercício guiado, desafio com dicas e solução comentada, lista dos comandos
  aprendidos, e progresso salvo automaticamente.
- **Modo Livre**: workspace com múltiplos arquivos `.tex`, salvos automaticamente.
- **Desenhos**: biblioteca de mais de 15 modelos prontos em TikZ (triângulos,
  ângulos, plano cartesiano, gráficos, fluxogramas, árvores, cabeçalho de
  prova...) para visualizar, copiar o código ou usar direto no Modo Livre.
- **Editor + Preview**: CodeMirror com destaque de sintaxe LaTeX, erros
  destacados diretamente na linha problemática (sublinhado + marcador na régua,
  nunca o texto todo), e um painel de erros/avisos que pode ser minimizado,
  fechado (deixando só um indicador pequeno e clicável) ou configurado para não
  abrir sozinho. PDF renderizado via pdf.js, com zoom dinâmico (roda do mouse +
  Ctrl, gesto de pinça no touchpad, sempre centralizado no cursor), arrastar
  para navegar pela página ampliada, e botões de ajustar à largura/à página.
- **Ferramenta de coordenadas**: modo especial na pré-visualização com régua,
  malha configurável (espaçamento, cor da grade), leitura da posição do cursor
  em centímetros, medição de distância/ponto médio entre dois cliques, e
  geração automática do código `\draw` (nas duas variantes — coordenadas locais
  e posição absoluta via `current page`) pronto para copiar ou inserir direto
  no editor.
- **Compilação automática e rápida**: atualiza ~450ms depois que você para de
  digitar, cancela a compilação anterior ao editar de novo, mostra um indicador
  de status (Editando/Compilando/Atualizado/Erro), mantém a última versão válida
  visível quando o código atual tem erro, e pode ser desligada (botão de
  atualizar manual sempre disponível).
- **Baixar PDF**: gera a versão mais recente e abre a caixa de diálogo do
  Windows para escolher nome/local do arquivo, com opções de abrir o PDF ou
  mostrá-lo na pasta depois de salvar.
- **Pacotes**: busca por nome, descrição, tamanho e exemplo de uso; instalar,
  remover e adicionar automaticamente o `\usepackage{}` correspondente ao
  documento que você estiver editando. Quando falta um pacote, o próprio editor
  destaca a linha do `\usepackage`, explica se ele está faltando ou apenas
  incompatível com o motor atual (pdflatex vs. XeLaTeX), e oferece um botão
  para instalar ali mesmo — com barra de progresso e recompilação automática ao
  terminar. Usa o catálogo completo do `tlmgr` (TeX Live/TinyTeX) ou do MiKTeX
  quando disponível; cai para um catálogo offline curado caso contrário, sempre
  deixando claro qual fonte está sendo usada.
- **Configuração**: detecta se existe um motor LaTeX (`pdflatex`/`xelatex`) e um
  gerenciador de pacotes (`tlmgr` ou MiKTeX) no computador e, se não houver,
  orienta a instalação do MiKTeX ou do TinyTeX.

## Por que o app não baixa o LaTeX "inteiro" sozinho

O catálogo oficial do LaTeX (CTAN) tem mais de 6000 pacotes e dezenas de GB.
Em vez de embutir tudo isso no instalador, o app:

1. Não embute nenhum motor LaTeX diretamente no instalador (isso exigiria
   redistribuir binários de terceiros e infla o instalador em centenas de MB
   a vários GB).
2. Na primeira execução, se não encontrar `pdflatex`/`xelatex`, mostra uma tela
   de configuração com links oficiais para o **MiKTeX** (recomendado) ou o
   **TinyTeX** (mais leve) — a instalação em si acontece uma única vez, fora do
   app, com o instalador oficial de cada distribuição.
3. Depois disso, a aba **Pacotes** usa o `tlmgr` ou o gerenciador do MiKTeX
   (o que estiver disponível) para listar e instalar qualquer pacote adicional
   sob demanda, com busca e tamanho reais.

### Sobre o suporte ao MiKTeX

MiKTeX não usa o `tlmgr` do TeX Live — ele tem seu próprio gerenciador
(`mpm`, ou o comando unificado `miktex packages ...` nas versões mais novas).
Como este ambiente de desenvolvimento não tem MiKTeX instalado para testar
contra um caso real, o código tenta os dois formatos de comando conhecidos e
usa o primeiro que funcionar. O caminho via `tlmgr` (TeX Live/TinyTeX) foi
validado de ponta a ponta neste ambiente com uma instalação real; o caminho do
MiKTeX ainda precisa ser confirmado numa máquina Windows real — se algo não
funcionar exatamente como esperado por lá, o app sempre cai de volta para o
catálogo offline com uma mensagem clara, e o botão "instalar pelo nome exato"
continua disponível como alternativa.

## Rodando em desenvolvimento

```bash
cd latex-tutor-desktop
npm install
npm run dev
```

Isso sobe o Vite (renderer) e o Electron apontando para ele, com DevTools aberto.

## Gerando o instalador do Windows

Este sandbox de desenvolvimento é Linux e não tem Wine, então não é possível
gerar o `.exe` final aqui. Duas formas de obtê-lo:

- **GitHub Actions (recomendado)**: o workflow
  `.github/workflows/latex-tutor-windows-build.yml` builda automaticamente em um
  runner `windows-latest` a cada push em `latex-tutor-desktop/**` na branch
  `main`, e disponibiliza o instalador `.exe` como artifact para download. Também
  pode ser disparado manualmente pela aba Actions do GitHub ("Run workflow").
- **Localmente, no Windows**: com Node.js instalado, rode:
  ```bash
  npm install
  npm run dist:win
  ```
  O instalador fica em `release/`.

## Estrutura

```
latex-tutor-desktop/
  electron/          # processo principal: compilação (cancelável), detecção do
                      # motor/gerenciador de pacotes, exportação de PDF, estado salvo
  src/
    components/       # Workspace, editor, preview, abas (Aprender/Modo Livre/
                      # Desenhos/Pacotes/Configuração)
    lessons/           # currículo: types.ts + modules/module1..9.ts
    drawings/          # catálogo da biblioteca de desenhos TikZ
    lib/               # registro do "editor ativo" e checagem local de erros LaTeX
  resources/          # catálogo offline de pacotes (fallback, com exemplos de uso)
```

## Limitações conhecidas

- Testado neste ambiente com uma distribuição TeX Live real (Linux) para validar
  todo o fluxo de compilação, erros/avisos destacados na linha certa, detecção
  de pacote faltante, exportação de PDF e preview — mas o build final do
  instalador do Windows e a experiência específica com MiKTeX/TinyTeX no
  Windows ainda não foram testados numa máquina Windows real.
- O suporte a pacotes via MiKTeX (`mpm`/`miktex packages`) foi implementado de
  forma defensiva (tenta os dois formatos de comando conhecidos) já que não há
  como testar contra uma instalação real do MiKTeX neste ambiente — veja a
  seção acima.
- O bundle do renderer é ~1 MB (mais o worker do pdf.js, ~2 MB) — pequeno para
  um app desktop, sem necessidade de otimização adicional por enquanto.
