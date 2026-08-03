export interface DiagnosticItem {
  line: number | null; // 1-indexed
  severity: "error" | "warning";
  message: string;
}

const RAW_ENVIRONMENTS = new Set(["verbatim", "verbatim*", "lstlisting", "minted", "Verbatim", "comment"]);

// Lightweight, LaTeX-aware static checks that run instantly on every keystroke,
// client-side, with no compile needed: unmatched { }, and \begin{x}/\end{x}
// pairs that don't close or don't match. Deliberately not a full LaTeX parser —
// just enough to catch the mistakes beginners actually make.
export function computeLocalDiagnostics(doc: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const lines = doc.split("\n");

  const braceStack: number[] = [];
  const envStack: { name: string; line: number }[] = [];
  const beginRe = /\\begin\{([^}]+)\}/g;
  const endRe = /\\end\{([^}]+)\}/g;

  for (let i = 0; i < lines.length; i++) {
    const rawEnv = envStack.length > 0 && RAW_ENVIRONMENTS.has(envStack[envStack.length - 1].name);
    const line = stripComment(lines[i]);

    if (!rawEnv) {
      for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        if (ch === "\\") {
          j++;
          continue;
        }
        if (ch === "{") braceStack.push(i + 1);
        else if (ch === "}") {
          if (braceStack.length === 0) {
            diagnostics.push({ line: i + 1, severity: "error", message: "Há uma chave `}` fechando algo que não foi aberto antes." });
          } else {
            braceStack.pop();
          }
        }
      }
    }

    const tokens: { type: "begin" | "end"; name: string; idx: number }[] = [];
    let m: RegExpExecArray | null;
    beginRe.lastIndex = 0;
    while ((m = beginRe.exec(line))) tokens.push({ type: "begin", name: m[1], idx: m.index });
    endRe.lastIndex = 0;
    while ((m = endRe.exec(line))) tokens.push({ type: "end", name: m[1], idx: m.index });
    tokens.sort((a, b) => a.idx - b.idx);

    for (const t of tokens) {
      if (t.type === "begin") {
        envStack.push({ name: t.name, line: i + 1 });
      } else {
        const top = envStack[envStack.length - 1];
        if (!top) {
          diagnostics.push({
            line: i + 1,
            severity: "error",
            message: `Há um "\\end{${t.name}}" sem um "\\begin{${t.name}}" correspondente antes dele.`
          });
        } else if (top.name !== t.name) {
          diagnostics.push({
            line: i + 1,
            severity: "error",
            message: `O ambiente "\\begin{${top.name}}" (linha ${top.line}) foi fechado com "\\end{${t.name}}" — os nomes devem ser iguais.`
          });
          envStack.pop();
        } else {
          envStack.pop();
        }
      }
    }
  }

  for (const line of braceStack) {
    diagnostics.push({ line, severity: "error", message: "Esta chave `{` não foi fechada em nenhum lugar depois." });
  }
  for (const env of envStack) {
    diagnostics.push({
      line: env.line,
      severity: "error",
      message: `O ambiente "\\begin{${env.name}}" iniciado aqui não foi encerrado com "\\end{${env.name}}".`
    });
  }

  return diagnostics;
}

function stripComment(line: string): string {
  let result = "";
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "\\") {
      result += line[j] + (line[j + 1] ?? "");
      j++;
      continue;
    }
    if (line[j] === "%") break;
    result += line[j];
  }
  return result;
}
