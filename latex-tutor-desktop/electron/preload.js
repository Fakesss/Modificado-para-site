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
    deleteFile: (relPath) => ipcRenderer.invoke("freemode:delete-file", relPath)
  }
});
