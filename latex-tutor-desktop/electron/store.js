const Store = require("electron-store");

const store = new Store({
  name: "latex-tutor-state",
  defaults: {
    completedLessons: [],
    freeModeFiles: {
      "main.tex": "\\documentclass{article}\n\\begin{document}\n\nOlá, mundo!\n\n\\end{document}\n"
    },
    lastActiveFile: "main.tex",
    openTabs: ["main.tex"],
    setupDismissed: false,
    editorSettings: {
      autoCloseBrackets: true,
      tabAutocomplete: true
    }
  }
});

function getProgress() {
  return {
    completedLessons: store.get("completedLessons"),
    setupDismissed: store.get("setupDismissed")
  };
}

function markLessonComplete(lessonId) {
  const list = new Set(store.get("completedLessons"));
  list.add(lessonId);
  store.set("completedLessons", Array.from(list));
  return Array.from(list);
}

function setSetupDismissed(value) {
  store.set("setupDismissed", value);
}

function getFreeModeFiles() {
  const files = store.get("freeModeFiles");
  const openTabs = (store.get("openTabs") || []).filter((f) => f in files);
  return {
    files,
    lastActiveFile: store.get("lastActiveFile"),
    openTabs: openTabs.length > 0 ? openTabs : Object.keys(files).slice(0, 1)
  };
}

function saveFreeModeFile(relPath, content) {
  const files = store.get("freeModeFiles");
  files[relPath] = content;
  store.set("freeModeFiles", files);
  store.set("lastActiveFile", relPath);
}

function deleteFreeModeFile(relPath) {
  const files = store.get("freeModeFiles");
  delete files[relPath];
  store.set("freeModeFiles", files);
  const openTabs = (store.get("openTabs") || []).filter((f) => f !== relPath);
  store.set("openTabs", openTabs);
}

function setOpenTabs(openTabs, activeFile) {
  store.set("openTabs", openTabs);
  if (activeFile) store.set("lastActiveFile", activeFile);
}

function getEditorSettings() {
  return store.get("editorSettings");
}

function setEditorSettings(settings) {
  store.set("editorSettings", { ...store.get("editorSettings"), ...settings });
  return store.get("editorSettings");
}

module.exports = {
  getProgress,
  markLessonComplete,
  setSetupDismissed,
  getFreeModeFiles,
  saveFreeModeFile,
  deleteFreeModeFile,
  setOpenTabs,
  getEditorSettings,
  setEditorSettings
};
