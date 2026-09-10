import { lessons } from "../lessons/curriculum";

function extractCommandName(token: string): string | null {
  const m = token.match(/^\\([a-zA-Z]+)/);
  return m ? `\\${m[1]}` : null;
}

const EXTRA_COMMANDS = [
  "\\alpha", "\\beta", "\\gamma", "\\delta", "\\epsilon", "\\theta", "\\lambda", "\\mu", "\\pi", "\\sigma", "\\phi", "\\omega",
  "\\Gamma", "\\Delta", "\\Theta", "\\Lambda", "\\Sigma", "\\Phi", "\\Omega",
  "\\left", "\\right", "\\big", "\\Big", "\\overline", "\\underline", "\\hat", "\\vec", "\\bar", "\\dot",
  "\\ldots", "\\cdots", "\\vdots", "\\ddots",
  "\\part", "\\chapter", "\\paragraph", "\\footnote", "\\emph", "\\texttt", "\\textsc",
  "\\centering", "\\raggedright", "\\raggedleft",
  "\\newcommand", "\\renewcommand", "\\input", "\\include", "\\appendix", "\\index", "\\printindex",
  "\\linespread", "\\setlength", "\\addtolength",
  "\\clearpage", "\\pagebreak", "\\nopagebreak",
  "\\footnotesize", "\\scriptsize", "\\tiny", "\\boxed"
];

const fromLessons = lessons
  .flatMap((l) => l.commandsLearned)
  .map(extractCommandName)
  .filter((x): x is string => x !== null);

// Sorted shortest-first (ties broken alphabetically) once, up front — filtering
// this by prefix later preserves that ordering, satisfying "sugerir por ordem
// de tamanho, do menor para o maior" without needing to re-sort per keystroke.
export const LATEX_COMMANDS: string[] = Array.from(new Set([...fromLessons, ...EXTRA_COMMANDS])).sort(
  (a, b) => a.length - b.length || a.localeCompare(b)
);

const MRU_KEY = "kubitex:command-mru";
const MRU_MAX = 50;

export function getMruList(): string[] {
  try {
    const raw = localStorage.getItem(MRU_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordCommandUsage(command: string) {
  if (!/^\\[a-zA-Z]+$/.test(command)) return;
  const list = getMruList().filter((c) => c !== command);
  list.unshift(command);
  localStorage.setItem(MRU_KEY, JSON.stringify(list.slice(0, MRU_MAX)));
}

// MRU matches (most-recently-used first) take priority; the curated list
// (already shortest-first) fills in the rest for prefixes with no history.
export function suggestCommands(prefix: string, limit = 10): string[] {
  if (!prefix.startsWith("\\") || prefix.length < 1) return [];
  const mru = getMruList().filter((c) => c.startsWith(prefix) && c !== prefix);
  const fallback = LATEX_COMMANDS.filter((c) => c.startsWith(prefix) && c !== prefix && !mru.includes(c));
  return [...mru, ...fallback].slice(0, limit);
}
