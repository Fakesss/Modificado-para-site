const { app, BrowserWindow, ipcMain, shell, protocol, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { detectEngine, isInstalled } = require("./texEngine");
const { compileLatex } = require("./compiler");
const { listPackages, installPackage, uninstallPackage } = require("./packages");
const { savePdf, openPath, showInFolder } = require("./pdfExport");
const store = require("./store");
const { listImages, addImages, deleteImage, readImageDataUrl } = require("./imageBank");

const isDev = process.env.NODE_ENV === "development";
const RENDERER_DIR = path.join(__dirname, "..", "dist", "renderer");

// Single floating PDF preview window (there's only ever one, mirroring
// whichever tab is currently active in the main window).
let pdfWin = null;

function notifyPdfWindowState(isOpen) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (w !== pdfWin) w.webContents.send("pdf-window:state-changed", isOpen);
  });
}

function openPdfWindow() {
  if (pdfWin && !pdfWin.isDestroyed()) {
    pdfWin.focus();
    return true;
  }
  pdfWin = new BrowserWindow({
    width: 700,
    height: 900,
    title: "KubiTeX - Pré-visualização do PDF",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (isDev) {
    pdfWin.loadURL("http://localhost:5173/#pdf-popout");
  } else {
    pdfWin.loadURL("app://bundle/index.html#pdf-popout");
  }
  pdfWin.on("closed", () => {
    pdfWin = null;
    notifyPdfWindowState(false);
  });
  // Wait for the popout page to finish loading (and register its own
  // "pdf-window:data" listener) before telling the main window it's open —
  // otherwise the resend of the current PDF that follows could arrive before
  // anyone in that window is listening for it.
  pdfWin.webContents.once("did-finish-load", () => notifyPdfWindowState(true));
  return true;
}

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

  // Free Mode debounces disk writes by ~500ms, so a close right after typing
  // could otherwise drop the last keystrokes. Hold the window open just long
  // enough for the renderer to flush pending saves, with a timeout in case it
  // never responds (e.g. the page crashed).
  let readyToDestroy = false;
  let flushRequested = false;
  win.on("close", (event) => {
    if (readyToDestroy) return;
    event.preventDefault();
    // The floating PDF window has nothing to flush; just don't leave it
    // orphaned (window-all-closed wouldn't fire while it's still open).
    if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close();
    if (flushRequested) return;
    flushRequested = true;
    win.webContents.send("app:flush-before-close");
    const forceTimer = setTimeout(() => {
      readyToDestroy = true;
      win.close();
    }, 2000);
    ipcMain.once("app:flush-complete", () => {
      clearTimeout(forceTimer);
      readyToDestroy = true;
      win.close();
    });
  });
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
ipcMain.handle("freemode:set-open-tabs", (_evt, openTabs, activeFile) => store.setOpenTabs(openTabs, activeFile));

ipcMain.handle("settings:get", () => store.getEditorSettings());
ipcMain.handle("settings:set", (_evt, settings) => store.setEditorSettings(settings));

// --- IPC: image bank ---

ipcMain.handle("images:list", () => listImages());
ipcMain.handle("images:add", (evt) => addImages(BrowserWindow.fromWebContents(evt.sender)));
ipcMain.handle("images:delete", (_evt, name) => deleteImage(name));
ipcMain.handle("images:read", (_evt, name) => readImageDataUrl(name));

// --- IPC: detachable PDF preview window ---

ipcMain.handle("pdf-window:open", () => openPdfWindow());
ipcMain.handle("pdf-window:close", () => {
  if (pdfWin && !pdfWin.isDestroyed()) pdfWin.close();
  return true;
});
ipcMain.on("pdf-window:update-data", (_evt, pdf) => {
  if (pdfWin && !pdfWin.isDestroyed()) pdfWin.webContents.send("pdf-window:data", pdf);
});
