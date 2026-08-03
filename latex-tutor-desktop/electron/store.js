const Store = require("electron-store");

const store = new Store({
  name: "latex-tutor-state",
  defaults: {
    completedLessons: [],
    freeModeFiles: {
      "main.tex": "\\documentclass{article}\n\\begin{document}\n\nOlá, mundo!\n\n\\end{document}\n"
    },
    lastActiveFile: "main.tex",
    setupDismissed: false
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
  return {
    files: store.get("freeModeFiles"),
    lastActiveFile: store.get("lastActiveFile")
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
}

module.exports = {
  getProgress,
  markLessonComplete,
  setSetupDismissed,
  getFreeModeFiles,
  saveFreeModeFile,
  deleteFreeModeFile
};
