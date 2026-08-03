const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { detectEngine } = require("./texEngine");

function bundledCatalogPath(resourcesPath) {
  return path.join(resourcesPath, "tlpdb-sample.json");
}

let bundledCache = null;
function loadBundledCatalog(resourcesPath) {
  if (bundledCache) return bundledCache;
  try {
    const raw = fs.readFileSync(bundledCatalogPath(resourcesPath), "utf8");
    bundledCache = JSON.parse(raw).packages;
  } catch {
    bundledCache = [];
  }
  return bundledCache;
}

function extrasByName(resourcesPath) {
  const map = new Map();
  for (const p of loadBundledCatalog(resourcesPath)) map.set(p.name, p);
  return map;
}

function enrich(pkg, extras) {
  const extra = extras.get(pkg.name);
  return {
    ...pkg,
    example: extra?.example ?? `\\usepackage{${pkg.name}}`,
    xelatexOnly: Boolean(extra?.xelatexOnly)
  };
}

// tlmgr's `--data` output is comma-separated; text fields may contain commas so
// they are quoted. This is a small tolerant parser rather than a strict CSV lib,
// since exact quoting behavior can vary a little across tlmgr releases.
function parseDataLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024, timeout: 20000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

// --- TeX Live / TinyTeX (tlmgr) ---

async function listPackagesViaTlmgr(tlmgrPath) {
  const stdout = await runCommand(tlmgrPath, ["list", "--data", "name,size,shortdesc"]);
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const packages = [];
  for (const line of lines) {
    const [name, size, shortdesc] = parseDataLine(line);
    if (!name) continue;
    const sizeKB = Number(size);
    packages.push({
      name: name.trim(),
      sizeKB: Number.isFinite(sizeKB) ? sizeKB : null,
      shortdesc: (shortdesc || "").trim()
    });
  }
  return packages;
}

async function listInstalledSetTlmgr(tlmgrPath) {
  try {
    const stdout = await runCommand(tlmgrPath, ["list", "--only-installed", "--data", "name"]);
    return new Set(stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

// --- MiKTeX (mpm / unified "miktex" CLI) ---
//
// MiKTeX's package-listing output isn't as consistently documented as tlmgr's,
// and we have no MiKTeX install available to verify the exact format against,
// so this parser is intentionally tolerant: it accepts a couple of plausible
// line shapes and simply returns an empty list (triggering the bundled-catalog
// fallback) if none match, rather than throwing.
function parseMiktexListLine(line) {
  // "i  package-name  Some description" or "   package-name  Some description"
  const match = line.match(/^([i \-])\s+(\S+)\s+(.*)$/);
  if (!match) return null;
  const [, flag, name, rest] = match;
  return { name, shortdesc: rest.trim(), installedFlag: flag === "i" };
}

async function listPackagesViaMiktex(engines) {
  const attempts = [];
  if (engines.miktex) attempts.push([engines.miktex, ["packages", "list"]]);
  if (engines.mpm) attempts.push([engines.mpm, ["--list"]]);

  for (const [bin, args] of attempts) {
    try {
      const stdout = await runCommand(bin, args);
      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const packages = [];
      const installed = new Set();
      for (const line of lines) {
        const parsed = parseMiktexListLine(line);
        if (!parsed) continue;
        packages.push({ name: parsed.name, sizeKB: null, shortdesc: parsed.shortdesc });
        if (parsed.installedFlag) installed.add(parsed.name);
      }
      if (packages.length > 0) return { packages, installed };
    } catch {
      // try the next candidate command
    }
  }
  return { packages: [], installed: new Set() };
}

async function runPackageAction(engines, name, action) {
  // action: "install" | "remove". Tries the modern unified "miktex" CLI first,
  // then falls back to the classic "mpm" syntax if that command isn't
  // recognized — we can't verify which one is present ahead of time.
  const attempts = [];
  if (engines.miktex) attempts.push([engines.miktex, ["packages", action, name]]);
  if (engines.mpm) attempts.push([engines.mpm, [`--${action === "install" ? "install" : "uninstall"}=${name}`]]);

  let lastError = "";
  for (const [bin, args] of attempts) {
    const result = await new Promise((resolve) => {
      const child = spawn(bin, args);
      let log = "";
      child.stdout?.on("data", (d) => (log += d.toString()));
      child.stderr?.on("data", (d) => (log += d.toString()));
      child.on("close", (code) => resolve({ success: code === 0, message: log }));
      child.on("error", (err) => resolve({ success: false, message: String(err) }));
    });
    if (result.success) return result;
    lastError = result.message;
  }
  return { success: false, message: lastError || "Nenhum comando do MiKTeX respondeu." };
}

// --- Unified API ---

async function listPackages({ query = "", resourcesPath }) {
  const engines = detectEngine();
  let packages = [];
  let source = "bundled";
  let installed = new Set();

  if (engines.packageManager === "tlmgr") {
    try {
      const [all, installedSet] = await Promise.all([
        listPackagesViaTlmgr(engines.tlmgr),
        listInstalledSetTlmgr(engines.tlmgr)
      ]);
      if (all.length > 0) {
        packages = all;
        installed = installedSet;
        source = "tlmgr";
      }
    } catch {
      // fall through to bundled catalog below
    }
  } else if (engines.packageManager === "miktex") {
    try {
      const result = await listPackagesViaMiktex(engines);
      if (result.packages.length > 0) {
        packages = result.packages;
        installed = result.installed;
        source = "miktex";
      }
    } catch {
      // fall through to bundled catalog below
    }
  }

  if (packages.length === 0) {
    packages = loadBundledCatalog(resourcesPath).map((p) => ({
      name: p.name,
      sizeKB: p.sizeKB,
      shortdesc: p.shortdesc,
      approximate: true
    }));
  }

  const extras = extrasByName(resourcesPath);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? packages.filter((p) => p.name.toLowerCase().includes(q) || (p.shortdesc || "").toLowerCase().includes(q))
    : packages;

  return {
    source,
    packageManager: engines.packageManager,
    total: packages.length,
    packages: filtered.slice(0, 500).map((p) => enrich({ ...p, installed: installed.has(p.name) }, extras))
  };
}

function installPackage(name, onData) {
  return new Promise(async (resolve) => {
    const engines = detectEngine();
    if (engines.packageManager === "tlmgr") {
      const child = spawn(engines.tlmgr, ["install", name]);
      let log = "";
      child.stdout.on("data", (d) => {
        log += d.toString();
        onData?.(d.toString());
      });
      child.stderr.on("data", (d) => {
        log += d.toString();
        onData?.(d.toString());
      });
      child.on("close", (code) => resolve({ success: code === 0, message: log }));
      child.on("error", (err) => resolve({ success: false, message: String(err) }));
      return;
    }
    if (engines.packageManager === "miktex") {
      onData?.(`Instalando ${name} via MiKTeX...\n`);
      const result = await runPackageAction(engines, name, "install");
      resolve(result);
      return;
    }
    resolve({
      success: false,
      message:
        "Nenhum gerenciador de pacotes (tlmgr ou MiKTeX) foi encontrado. Instale o MiKTeX ou o TinyTeX na aba Configuração primeiro."
    });
  });
}

function uninstallPackage(name, onData) {
  return new Promise(async (resolve) => {
    const engines = detectEngine();
    if (engines.packageManager === "tlmgr") {
      const child = spawn(engines.tlmgr, ["remove", name]);
      let log = "";
      child.stdout.on("data", (d) => {
        log += d.toString();
        onData?.(d.toString());
      });
      child.stderr.on("data", (d) => {
        log += d.toString();
        onData?.(d.toString());
      });
      child.on("close", (code) => resolve({ success: code === 0, message: log }));
      child.on("error", (err) => resolve({ success: false, message: String(err) }));
      return;
    }
    if (engines.packageManager === "miktex") {
      onData?.(`Removendo ${name}...\n`);
      const result = await runPackageAction(engines, name, "remove");
      resolve(result);
      return;
    }
    resolve({ success: false, message: "Nenhum gerenciador de pacotes encontrado." });
  });
}

module.exports = { listPackages, installPackage, uninstallPackage };
