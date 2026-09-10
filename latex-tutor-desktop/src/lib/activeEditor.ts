// Whichever Workspace (Lessons or Modo Livre) the user last had open registers
// itself here. This lets other tabs that aren't themselves an editor — like
// Pacotes — act on "the current document" without deep prop-drilling, since
// only one Workspace is ever the meaningful target at a time.
export interface ActiveEditorAPI {
  engine: "pdflatex" | "xelatex";
  addPackage: (pkgName: string) => { added: boolean; alreadyPresent: boolean };
  insertSnippet: (code: string) => void;
}

let current: ActiveEditorAPI | null = null;
const listeners = new Set<() => void>();

export function registerActiveEditor(api: ActiveEditorAPI) {
  current = api;
  listeners.forEach((l) => l());
}

export function getActiveEditor(): ActiveEditorAPI | null {
  return current;
}

export function onActiveEditorChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function buildUsepackageInsert(docCode: string, pkgName: string): { code: string; alreadyPresent: boolean } {
  const already = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{\\s*${pkgName}\\s*\\}`).test(docCode);
  if (already) return { code: docCode, alreadyPresent: true };

  const lines = docCode.split("\n");
  let insertAt = 0;
  let lastUsepackage = -1;
  let docClassLine = -1;
  lines.forEach((line, idx) => {
    if (/^\s*\\usepackage/.test(line)) lastUsepackage = idx;
    if (docClassLine === -1 && /^\s*\\documentclass/.test(line)) docClassLine = idx;
  });
  if (lastUsepackage !== -1) insertAt = lastUsepackage + 1;
  else if (docClassLine !== -1) insertAt = docClassLine + 1;

  lines.splice(insertAt, 0, `\\usepackage{${pkgName}}`);
  return { code: lines.join("\n"), alreadyPresent: false };
}
