const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { detectEngine } = require("./texEngine");

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

function compileLatex({ files, mainFileName, engine = "pdflatex" }) {
  return new Promise((resolve) => {
    const engines = detectEngine();
    const binary = engine === "xelatex" ? engines.xelatex : engines.pdflatex;

    if (!binary) {
      resolve({
        success: false,
        missingEngine: true,
        log: "",
        errors: ["Nenhum motor LaTeX (pdflatex/xelatex) foi encontrado no sistema."]
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
      resolve({ success: false, log: String(err), errors: [String(err)] });
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
    let log = "";
    const killTimer = setTimeout(() => child.kill(), 30000);

    child.stdout.on("data", (d) => (log += d.toString()));
    child.stderr.on("data", (d) => (log += d.toString()));

    child.on("close", () => {
      clearTimeout(killTimer);
      const pdfPath = path.join(tmpDir, mainFileName.replace(/\.tex$/, ".pdf"));
      if (fs.existsSync(pdfPath)) {
        const pdfBuffer = fs.readFileSync(pdfPath);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve({ success: true, pdf: pdfBuffer, log, errors: [] });
      } else {
        const errors = extractErrors(log);
        const missingPackage = extractMissingPackage(log);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        resolve({ success: false, log, errors, missingPackage });
      }
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      resolve({ success: false, log: String(err), errors: [String(err)] });
    });
  });
}

module.exports = { compileLatex };
