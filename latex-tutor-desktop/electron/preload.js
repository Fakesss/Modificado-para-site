const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  engine: {
    status: () => ipcRenderer.invoke("engine:status"),
    openInstallPage: (target) => ipcRenderer.invoke("engine:open-install-page", target)
  },
  compile: (payload) => ipcRenderer.invoke("compile", payload),
  packages: {
    list: (query) => ipcRenderer.invoke("packages:list", query),
    install: (name) => ipcRenderer.invoke("packages:install", name),
    uninstall: (name) => ipcRenderer.invoke("packages:uninstall", name),
    onInstallProgress: (cb) => {
      const listener = (_evt, data) => cb(data);
      ipcRenderer.on("packages:install-progress", listener);
      return () => ipcRenderer.removeListener("packages:install-progress", listener);
    }
  },
  pdf: {
    save: (pdf, suggestedName) => ipcRenderer.invoke("pdf:save", { pdf, suggestedName }),
    open: (filePath) => ipcRenderer.invoke("pdf:open", filePath),
    reveal: (filePath) => ipcRenderer.invoke("pdf:reveal", filePath)
  },
  progress: {
    get: () => ipcRenderer.invoke("progress:get"),
    completeLesson: (lessonId) => ipcRenderer.invoke("progress:complete-lesson", lessonId),
    dismissSetup: (value) => ipcRenderer.invoke("progress:dismiss-setup", value)
  },
  freeMode: {
    getFiles: () => ipcRenderer.invoke("freemode:get-files"),
    saveFile: (relPath, content) => ipcRenderer.invoke("freemode:save-file", relPath, content),
    deleteFile: (relPath) => ipcRenderer.invoke("freemode:delete-file", relPath),
    setOpenTabs: (openTabs, activeFile) => ipcRenderer.invoke("freemode:set-open-tabs", openTabs, activeFile)
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (settings) => ipcRenderer.invoke("settings:set", settings)
  },
  app: {
    onFlushBeforeClose: (cb) => {
      const listener = () => cb();
      ipcRenderer.on("app:flush-before-close", listener);
      return () => ipcRenderer.removeListener("app:flush-before-close", listener);
    },
    confirmFlushComplete: () => ipcRenderer.send("app:flush-complete")
  },
  images: {
    list: () => ipcRenderer.invoke("images:list"),
    add: () => ipcRenderer.invoke("images:add"),
    delete: (name) => ipcRenderer.invoke("images:delete", name),
    read: (name) => ipcRenderer.invoke("images:read", name)
  },
  pdfWindow: {
    open: () => ipcRenderer.invoke("pdf-window:open"),
    close: () => ipcRenderer.invoke("pdf-window:close"),
    updateData: (pdf) => ipcRenderer.send("pdf-window:update-data", pdf),
    onData: (cb) => {
      const listener = (_evt, data) => cb(data ? new Uint8Array(data) : null);
      ipcRenderer.on("pdf-window:data", listener);
      return () => ipcRenderer.removeListener("pdf-window:data", listener);
    },
    onStateChanged: (cb) => {
      const listener = (_evt, isOpen) => cb(isOpen);
      ipcRenderer.on("pdf-window:state-changed", listener);
      return () => ipcRenderer.removeListener("pdf-window:state-changed", listener);
    }
  }
});
