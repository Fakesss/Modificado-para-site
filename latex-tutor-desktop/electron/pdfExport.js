const { dialog, shell } = require("electron");
const fs = require("fs");

async function savePdf(win, pdfBuffer, suggestedName) {
  const defaultName = suggestedName.toLowerCase().endsWith(".pdf") ? suggestedName : `${suggestedName}.pdf`;
  const result = await dialog.showSaveDialog(win, {
    title: "Salvar PDF",
    defaultPath: defaultName,
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (result.canceled || !result.filePath) return { success: false, cancelled: true };

  let filePath = result.filePath;
  if (!filePath.toLowerCase().endsWith(".pdf")) filePath += ".pdf";

  try {
    fs.writeFileSync(filePath, pdfBuffer);
    return { success: true, filePath };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

module.exports = {
  savePdf,
  openPath: (filePath) => shell.openPath(filePath),
  showInFolder: (filePath) => shell.showItemInFolder(filePath)
};
