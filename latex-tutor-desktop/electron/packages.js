const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const { detectEngine } = require("./texEngine");

function bundledCatalogPath(resourcesPath) {
  return path.join(resourcesPath, "tlpdb-sample.json");
}

function loadBundledCatalog(resourcesPath) {
  try {
    const raw = fs.readFileSync(bundledCatalogPath(resourcesPath), "utf8");
    return JSON.parse(raw).packages;
  } catch {
    return [];
  }
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

function runTlmgr(tlmgrPath, args) {
  return new Promise((resolve, reject) => {
    execFile(tlmgrPath, args, { maxBuffer: 64 * 1024 * 1024, timeout: 20000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function listPackagesViaTlmgr(tlmgrPath) {
  const stdout = await runTlmgr(tlmgrPath, ["list", "--data", "name,size,shortdesc"]);
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

async function listInstalledSet(tlmgrPath) {
  try {
    const stdout = await runTlmgr(tlmgrPath, ["list", "--only-installed", "--data", "name"]);
    return new Set(stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function listPackages({ query = "", resourcesPath }) {
  const { tlmgr } = detectEngine();
  let packages = [];
  let source = "bundled";
  let installed = new Set();

  if (tlmgr) {
    try {
      const [all, installedSet] = await Promise.all([
        listPackagesViaTlmgr(tlmgr),
        listInstalledSet(tlmgr)
      ]);
      if (all.length > 0) {
        packages = all;
        installed = installedSet;
        source = "tlmgr";
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

  const q = query.trim().toLowerCase();
  const filtered = q
    ? packages.filter((p) => p.name.toLowerCase().includes(q) || (p.shortdesc || "").toLowerCase().includes(q))
    : packages;

  return {
    source,
    total: packages.length,
    packages: filtered
      .slice(0, 500)
      .map((p) => ({ ...p, installed: installed.has(p.name) }))
  };
}

function installPackage(name, onData) {
  return new Promise((resolve) => {
    const { tlmgr } = detectEngine();
    if (!tlmgr) {
      resolve({ success: false, message: "tlmgr não encontrado. Instale o MiKTeX ou o TinyTeX primeiro." });
      return;
    }
    const child = spawn(tlmgr, ["install", name]);
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
  });
}

module.exports = { listPackages, installPackage };
