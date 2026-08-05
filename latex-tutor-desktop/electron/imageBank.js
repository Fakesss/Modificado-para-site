const fs = require("fs");
const path = require("path");
const { app, dialog } = require("electron");

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf", ".eps"];
const PREVIEWABLE_MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

function imagesDir() {
  const dir = path.join(app.getPath("userData"), "free-mode-images");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Guards against a tampered/unexpected `name` (e.g. containing ".." or a path
// separator) ever escaping the image bank directory via delete/read.
function isSafeName(name) {
  return typeof name === "string" && name.length > 0 && !name.includes("/") && !name.includes("\\") && !name.includes("..");
}

function listImages() {
  const dir = imagesDir();
  return fs
    .readdirSync(dir)
    .filter((name) => ALLOWED_EXTENSIONS.includes(path.extname(name).toLowerCase()))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, sizeKB: Math.max(1, Math.round(stat.size / 1024)) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// If a file with the same name was already uploaded, append " (2)", " (3)"...
// before the extension rather than silently overwriting the earlier upload.
function uniqueName(dir, originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let candidate = originalName;
  let i = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base} (${i})${ext}`;
    i++;
  }
  return candidate;
}

async function addImages(win) {
  const result = await dialog.showOpenDialog(win, {
    title: "Escolher imagens",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "pdf", "eps"] }]
  });
  if (result.canceled) return { added: 0, images: listImages() };

  const dir = imagesDir();
  let added = 0;
  for (const sourcePath of result.filePaths) {
    const name = uniqueName(dir, path.basename(sourcePath));
    fs.copyFileSync(sourcePath, path.join(dir, name));
    added++;
  }
  return { added, images: listImages() };
}

function deleteImage(name) {
  if (isSafeName(name)) {
    const target = path.join(imagesDir(), name);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  return listImages();
}

function readImageDataUrl(name) {
  if (!isSafeName(name)) return null;
  const ext = path.extname(name).toLowerCase();
  const mime = PREVIEWABLE_MIME[ext];
  const target = path.join(imagesDir(), name);
  if (!mime || !fs.existsSync(target)) return null; // no browser-renderable preview for .pdf/.eps
  const data = fs.readFileSync(target).toString("base64");
  return `data:${mime};base64,${data}`;
}

// Compiling with \includegraphics needs the actual image file sitting next to
// the .tex source, so every compile job copies the whole bank into its temp
// directory alongside the written .tex files.
function copyImagesInto(tmpDir) {
  const dir = imagesDir();
  for (const name of fs.readdirSync(dir)) {
    const src = path.join(dir, name);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(tmpDir, name));
    }
  }
}

module.exports = { listImages, addImages, deleteImage, readImageDataUrl, copyImagesInto };
