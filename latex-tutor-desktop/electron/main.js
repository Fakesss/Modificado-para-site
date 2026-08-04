const { app, BrowserWindow, ipcMain, shell, protocol, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { detectEngine, isInstalled } = require("./texEngine");
const { compileLatex } = require("./compiler");
const { listPackages, installPackage, uninstallPackage } = require("./packages");
const { savePdf, openPath, showInFolder } = require("./pdfExport");
const store = require("./store");

const isDev = process.env.NODE_ENV === "development";
const RENDERER_DIR = path.join(__dirname, "..", "dist", "renderer");

function resourcesPath() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", "resources");
}

// pdf.js's worker script is an ES module, and Chromium refuses to spawn module
// workers from plain file:// pages (CORS restriction on module scripts). Serving
// the built renderer from a custom "app://" scheme instead of loadFile() gives it
// a real origin, so the worker loads normally.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "KubiTeX",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL("app://bundle/index.html");
  }
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle("app", (request) => {
      const url = new URL(request.url);
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = path.join(RENDERER_DIR, decodeURIComponent(pathname));
      return net.fetch(pathToFileURL(filePath).toString());
    });
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// --- IPC: engine status & compilation ---

ipcMain.handle("engine:status", () => {
  const engines = detectEngine(true);
  return { installed: isInstalled(), engines };
});

ipcMain.handle("engine:open-install-page", (_evt, target) => {
  const urls = {
    miktex: "https://miktex.org/download",
    tinytex: "https://yihui.org/tinytex/"
  };
  const url = urls[target];
  if (url) shell.openExternal(url);
  return Boolean(url);
});

ipcMain.handle("compile", (_evt, payload) => compileLatex(payload));

// --- IPC: package manager ---

ipcMain.handle("packages:list", (_evt, query) => listPackages({ query, resourcesPath: resourcesPath() }));

ipcMain.handle("packages:install", async (evt, name) => {
  return installPackage(name, (chunk) => {
    evt.sender.send("packages:install-progress", { name, chunk });
  });
});

ipcMain.handle("packages:uninstall", async (evt, name) => {
  return uninstallPackage(name, (chunk) => {
    evt.sender.send("packages:install-progress", { name, chunk });
  });
});

// --- IPC: PDF export ---

ipcMain.handle("pdf:save", async (evt, { pdf, suggestedName }) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  return savePdf(win, Buffer.from(pdf), suggestedName || "documento");
});

ipcMain.handle("pdf:open", (_evt, filePath) => openPath(filePath));
ipcMain.handle("pdf:reveal", (_evt, filePath) => {
  showInFolder(filePath);
  return true;
});

// --- IPC: persisted state ---

ipcMain.handle("progress:get", () => store.getProgress());
ipcMain.handle("progress:complete-lesson", (_evt, lessonId) => store.markLessonComplete(lessonId));
ipcMain.handle("progress:dismiss-setup", (_evt, value) => store.setSetupDismissed(value));

ipcMain.handle("freemode:get-files", () => store.getFreeModeFiles());
ipcMain.handle("freemode:save-file", (_evt, relPath, content) => store.saveFreeModeFile(relPath, content));
ipcMain.handle("freemode:delete-file", (_evt, relPath) => store.deleteFreeModeFile(relPath));
