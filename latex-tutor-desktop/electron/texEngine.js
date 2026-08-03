const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Directories where MiKTeX / TinyTeX typically place their binaries on Windows,
// checked as a fallback when the executables are not on PATH yet (common right
// after a fresh install, before the user restarts their session).
function candidateDirsWindows() {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const roaming = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  return [
    path.join(localAppData, "Programs", "MiKTeX", "miktex", "bin", "x64"),
    path.join("C:", "Program Files", "MiKTeX", "miktex", "bin", "x64"),
    path.join(roaming, "TinyTeX", "bin", "windows"),
    path.join(home, "AppData", "Roaming", "TinyTeX", "bin", "windows"),
    path.join("C:", "texlive", "2024", "bin", "windows"),
    path.join("C:", "texlive", "2023", "bin", "windows")
  ];
}

function exeName(bin) {
  return process.platform === "win32" ? `${bin}.exe` : bin;
}

function tryRun(fullPath) {
  try {
    execFileSync(fullPath, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function findOnPath(bin) {
  const name = exeName(bin);
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return name; // resolvable via PATH as-is
  } catch {
    return null;
  }
}

function findBinary(bin) {
  const onPath = findOnPath(bin);
  if (onPath) return onPath;

  if (process.platform === "win32") {
    for (const dir of candidateDirsWindows()) {
      const full = path.join(dir, exeName(bin));
      if (fs.existsSync(full) && tryRun(full)) return full;
    }
  }
  return null;
}

let cached = null;

function detectEngine(force = false) {
  if (cached && !force) return cached;
  cached = {
    pdflatex: findBinary("pdflatex"),
    xelatex: findBinary("xelatex"),
    tlmgr: findBinary("tlmgr")
  };
  return cached;
}

function isInstalled() {
  const e = detectEngine();
  return Boolean(e.pdflatex || e.xelatex);
}

module.exports = { detectEngine, isInstalled };
