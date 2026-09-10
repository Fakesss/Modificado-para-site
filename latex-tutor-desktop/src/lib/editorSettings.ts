import type { EditorSettings } from "../types/global";

const DEFAULTS: EditorSettings = { autoCloseBrackets: true, tabAutocomplete: true };

let current: EditorSettings = DEFAULTS;
const listeners = new Set<(settings: EditorSettings) => void>();

export function getEditorSettings(): EditorSettings {
  return current;
}

export async function loadEditorSettings() {
  current = await window.api.settings.get();
  listeners.forEach((l) => l(current));
}

export async function updateEditorSettings(patch: Partial<EditorSettings>) {
  current = { ...current, ...patch };
  listeners.forEach((l) => l(current));
  current = await window.api.settings.set(patch);
  listeners.forEach((l) => l(current));
}

export function subscribeEditorSettings(cb: (settings: EditorSettings) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
