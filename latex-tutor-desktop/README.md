# LaTeX Tutor (desktop, offline)

Aplicativo desktop para Windows que ensina LaTeX por níveis progressivos e também
oferece um modo livre para programar qualquer documento, com pré-visualização em
PDF ao vivo lado a lado com o editor (redimensionável e recolhível).

## O que já está pronto

- **Aprender**: 9 níveis progressivos, do "Olá, mundo" até TikZ e Beamer, cada um
  com explicação, código inicial e um desafio.
- **Modo Livre**: workspace com múltiplos arquivos `.tex`, salvos automaticamente.
- **Editor + Preview**: CodeMirror com destaque de sintaxe LaTeX + PDF renderizado
  via pdf.js. O painel de preview pode ser arrastado para redimensionar ou
  recolhido com um clique.
- **Pacotes**: aba com busca, tamanho e instalação de pacotes LaTeX adicionais.
  Usa o catálogo completo do `tlmgr` quando o motor está instalado; cai para um
  catálogo offline curado (tamanhos aproximados) caso contrário.
- **Configuração**: detecta se existe um motor LaTeX (`pdflatex`/`xelatex`) no
  computador e, se não houver, orienta a instalação do MiKTeX ou do TinyTeX.

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
3. Depois disso, a aba **Pacotes** usa o `tlmgr` (que já vem com o MiKTeX e o
   TinyTeX) para listar e instalar qualquer pacote adicional sob demanda, com
   busca e tamanho reais.

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
  electron/         # processo principal (compilação, detecção do motor, pacotes, estado salvo)
  src/               # interface (React + CodeMirror + pdf.js)
    lessons/          # conteúdo dos níveis
    components/
  resources/         # catálogo offline de pacotes (fallback)
```

## Limitações conhecidas

- Testado neste ambiente com uma distribuição TeX Live real (Linux) para validar
  todo o fluxo de compilação, detecção de pacote faltante e preview — mas o
  build final do instalador do Windows e a experiência com MiKTeX/TinyTeX no
  Windows ainda não foram testados numa máquina Windows real.
- O bundle do renderer é ~1 MB (mais o worker do pdf.js, ~2 MB) — pequeno para
  um app desktop, sem necessidade de otimização adicional por enquanto.
