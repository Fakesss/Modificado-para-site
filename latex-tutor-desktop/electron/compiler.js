const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { detectEngine } = require("./texEngine");

// One in-flight compile per "job" (one per visible Workspace: lessons/freemode/
// drawings). Starting a new compile for the same jobKey kills whatever was
// still running for it, so rapid typing never queues up stale compiles.
const activeJobs = new Map();

function cancelJob(jobKey) {
  const job = activeJobs.get(jobKey);
  if (!job) return;
  try {
    job.child.kill();
  } catch {
    // already exited
  }
  try {
    fs.rmSync(job.tmpDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
  activeJobs.delete(jobKey);
}

// Pulls the first "! <message>" style error out of a pdflatex/xelatex log so the
// UI can show something readable instead of the full raw log by default.
function extractErrors(log) {
  const lines = log.split(/\r?\n/);
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("! ")) {
      const context = lines.slice(i, i + 4).join("\n");
      errors.push(context.trim());
    }
  }
  return errors;
}

// Looks for the classic "File `foo.sty' not found" error so the UI can offer a
// direct shortcut to install that package instead of just showing raw errors.
function extractMissingPackage(log) {
  const match = log.match(/File `([\w-]+)\.(sty|cls)' not found/);
  return match ? match[1] : null;
}

const FRIENDLY_RULES = [
  [/Undefined control sequence/, () => "Este comando pode estar escrito incorretamente ou não existe."],
  [/Missing \$ inserted/, () => "Parece que falta um cifrão `$` para abrir ou fechar o modo matemático."],
  [/Missing \{ inserted/, () => "Está faltando abrir uma chave `{`."],
  [/Missing \} inserted/, () => "Está faltando fechar uma chave `}`."],
  [
    /\\begin\{(\w+)\} ended by \\end\{(\w+)\}/,
    (m) => `O ambiente "\\begin{${m[1]}}" foi fechado com "\\end{${m[2]}}" — os nomes precisam ser iguais.`
  ],
  [/Extra \\end\{(\w+)\}/, (m) => `Há um "\\end{${m[1]}}" sem um "\\begin{${m[1]}}" correspondente antes dele.`],
  [/Environment (\w+) undefined/, (m) => `O ambiente "${m[1]}" não existe (o pacote que o define pode não ter sido adicionado ainda).`],
  [/Runaway argument/, () => "Um comando ficou \"aberto\" sem ser fechado corretamente (chave, colchete ou cifrão faltando)."],
  [/Emergency stop/, () => "A compilação parou de vez — normalmente por causa de um erro anterior nesta lista."]
];

function friendlyMessage(rawFirstLine) {
  for (const [pattern, build] of FRIENDLY_RULES) {
    const m = rawFirstLine.match(pattern);
    if (m) return build(m);
  }
  return null;
}

// Turns the raw pdflatex/xelatex log into a list of {line, severity, message}
// diagnostics the editor can anchor squiggly underlines to. pdflatex reports
// the source line as "l.<N>" right after a "!" error block when it knows it;
// when it doesn't, line stays null and the message still shows in the panel.
function extractDiagnostics(log) {
  const lines = log.split(/\r?\n/);
  const diagnostics = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("! ")) continue;
    const rawFirstLine = lines[i].slice(2).trim();
    let line = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const lineMatch = lines[j].match(/^l\.(\d+)/);
      if (lineMatch) {
        line = Number(lineMatch[1]);
        break;
      }
      if (lines[j].startsWith("! ")) break;
    }
    diagnostics.push({
      line,
      severity: "error",
      message: friendlyMessage(rawFirstLine) ?? rawFirstLine,
      rawMessage: rawFirstLine
    });
  }
  // "LaTeX Warning: ..." lines are non-fatal — surfaced as lower-severity notices.
  for (const l of lines) {
    const warnMatch = l.match(/^LaTeX Warning: (.+)$/);
    if (warnMatch) {
      const lineMatch = warnMatch[1].match(/on input line (\d+)/);
      diagnostics.push({
        line: lineMatch ? Number(lineMatch[1]) : null,
        severity: "warning",
        message: warnMatch[1],
        rawMessage: warnMatch[1]
      });
    }
  }
  return diagnostics;
}

function compileLatex({ jobKey, files, mainFileName, engine = "pdflatex" }) {
  return new Promise((resolve) => {
    if (jobKey) cancelJob(jobKey);

    const engines = detectEngine();
    const binary = engine === "xelatex" ? engines.xelatex : engines.pdflatex;

    if (!binary) {
      resolve({
        success: false,
        missingEngine: true,
        log: "",
        errors: ["Nenhum motor LaTeX (pdflatex/xelatex) foi encontrado no sistema."],
        diagnostics: []
      });
      return;
    }

    let tmpDir;
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "latex-tutor-"));
      for (const [relPath, content] of Object.entries(files)) {
        const fullPath = path.join(tmpDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, "utf8");
      }
    } catch (err) {
      resolve({ success: false, log: String(err), errors: [String(err)], diagnostics: [] });
      return;
    }

    const args = [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-no-shell-escape",
      `-output-directory=${tmpDir}`,
      mainFileName
    ];

    const child = spawn(binary, args, { cwd: tmpDir });
    if (jobKey) activeJobs.set(jobKey, { child, tmpDir });

    let log = "";
    let killedByCancel = false;
    const killTimer = setTimeout(() => child.kill(), 30000);

    child.stdout.on("data", (d) => (log += d.toString()));
    child.stderr.on("data", (d) => (log += d.toString()));

    child.on("close", () => {
      clearTimeout(killTimer);
      if (jobKey) {
        if (activeJobs.get(jobKey)?.child === child) activeJobs.delete(jobKey);
        else killedByCancel = true;
      }

      if (killedByCancel) {
        // A newer compile for this jobKey already took over; this result is
        // stale and nobody should act on it.
        resolve({ success: false, cancelled: true, log: "", errors: [], diagnostics: [] });
        return;
      }

      const pdfPath = path.join(tmpDir, mainFileName.replace(/\.tex$/, ".pdf"));
      if (fs.existsSync(pdfPath)) {
        const pdfBuffer = fs.readFileSync(pdfPath);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve({ success: true, pdf: pdfBuffer, log, errors: [], diagnostics: extractDiagnostics(log) });
      } else {
        const errors = extractErrors(log);
        const missingPackage = extractMissingPackage(log);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve({ success: false, log, errors, missingPackage, diagnostics: extractDiagnostics(log) });
      }
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      if (jobKey) activeJobs.delete(jobKey);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      resolve({ success: false, log: String(err), errors: [String(err)], diagnostics: [] });
    });
  });
}

module.exports = { compileLatex };
