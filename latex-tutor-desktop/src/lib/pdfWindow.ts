let detached = false;
const listeners = new Set<(detached: boolean) => void>();

export function isPdfWindowDetached(): boolean {
  return detached;
}

export function subscribePdfWindowState(cb: (detached: boolean) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function openPdfWindow() {
  window.api.pdfWindow.open();
}

export function closePdfWindow() {
  window.api.pdfWindow.close();
}

export function sendPdfData(pdf: Uint8Array | null) {
  window.api.pdfWindow.updateData(pdf);
}

// The main process reports when the popout window opens/closes — including
// when the user closes it directly via the OS window controls — so every
// Workspace can swap its inline preview for the "open elsewhere" placeholder.
window.api.pdfWindow.onStateChanged((isOpen) => {
  detached = isOpen;
  listeners.forEach((l) => l(detached));
});
