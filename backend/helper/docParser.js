import { PDFParse } from "pdf-parse";
import fs from "fs/promises";
import mammoth from "mammoth";

export async function pdfParser(filePath) {
  let result;
  let parser;
  try {
    const buffer = await fs.readFile(filePath);
    parser = new PDFParse({ data: buffer });
    result = await parser.getText();
  } finally {
    if (parser) await parser.destroy();
  }
  return result.text;
}

export async function docxParser(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}
