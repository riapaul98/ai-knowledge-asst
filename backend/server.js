import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs/promises";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { askGemini, createEmbeddings } from "./services/gemini.js";
import createPrompt from "./prompts/geminiPrompt.js";
import { getDBClient, runClientQuery, runQuery } from "./helper/dbHelper.js";
import {
  chunkOverlap,
  chunkSize,
  SIMILARITY_THRESHOLD,
  TOP_K,
} from "./config/constants.js";
import crypto from "node:crypto";
import { docxParser, pdfParser } from "./helper/docParser.js";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: chunkSize,
  chunkOverlap: chunkOverlap,
});
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

function getNormalizedData(content) {
  return content.trim().replace(/\s+/g, " ").toLowerCase();
}

app.get("/documents", async (req, res) => {
  try {
    const docList = await runQuery(`SELECT id, filename FROM documents`);
    return res.status(200).json({
      success: true,
      message: "Documents fetched successfully!",
      data: { documentList: docList.rows },
    });
  } catch (err) {
    console.log(err);
    if (err.code === "DB_SERVICE_ERROR") {
      return res.status(500).json({
        success: false,
        message: "DB service is temporarily unavailable. Please try again.",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch documents!" });
  }
});

app.post("/upload", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "File upload failed!" });
    }
    if (
      !req.file.originalname.toLowerCase().endsWith(".txt") &&
      !req.file.originalname.toLowerCase().endsWith(".pdf") &&
      !req.file.originalname.toLowerCase().endsWith(".docx")
    ) {
      return res.status(400).json({
        success: false,
        message:
          "File type not supported. Upload '.txt', '.pdf', '.docx' files only",
      });
    }
    let text;
    if (req.file.originalname.toLowerCase().endsWith(".pdf")) {
      text = await pdfParser(req.file.path);
    } else if (req.file.originalname.toLowerCase().endsWith(".docx")) {
      text = await docxParser(req.file.path);
    } else if (req.file.originalname.toLowerCase().endsWith(".txt")) {
      text = await fs.readFile(req.file.path, "utf-8");
    }
    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Uploaded file is empty or failed to extract file contents!",
      });
    }

    const contentHash = crypto.createHash("sha256").update(text).digest("hex");
    const existingDocFile = await runQuery(
      `SELECT id, filename FROM documents WHERE content_hash = $1`,
      [contentHash],
    );
    if (existingDocFile.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Document already exists!" });
    }
    const chunks = await splitter.splitText(text);

    const client = await getDBClient();
    try {
      await runClientQuery(client, "BEGIN");
      const docRes = await runClientQuery(
        client,
        "INSERT INTO documents (filename, content_hash) VALUES ($1, $2) RETURNING id",
        [req.file.originalname, contentHash],
      );
      const documentId = docRes.rows[0].id;

      for (const chunk of chunks) {
        const result = await createEmbeddings(chunk);
        const chunkEmbed = result.embeddings[0].values;
        const chunkVector = `[${chunkEmbed.join(",")}]`;
        await runClientQuery(
          client,
          "INSERT INTO document_chunks (document_id, content, embedding) VALUES ($1, $2, $3)",
          [documentId, chunk, chunkVector],
        );
      }
      await runClientQuery(client, "COMMIT");
      return res.status(200).json({
        success: true,
        message: "Documents processed successfully",
        data: {
          documentId,
          chunksStored: chunks.length,
        },
      });
    } catch (err) {
      console.log(err.message);
      try {
        await runClientQuery(client, "ROLLBACK");
      } catch (rollbackErr) {
        console.log(rollbackErr);
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.log(err.message);
    if (err.code === "DB_SERVICE_ERROR") {
      return res.status(500).json({
        success: false,
        message: "DB service is temporarily unavailable. Please try again.",
      });
    }
    if (err.code === "AI_SERVICE_ERROR") {
      return res.status(500).json({
        success: false,
        message: "AI service is temporarily unavailable. Please try again.",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Error in file upload!" });
  } finally {
    try {
      if (req.file) {
        await fs.unlink(req.file.path);
      }
    } catch (err) {
      console.log(err.message);
    }
  }
});

app.post("/ask", async (req, res) => {
  try {
    const { question, documentId } = req.body;
    if (typeof question !== "string" || question.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Query is missing!" });
    }
    if (
      documentId &&
      (typeof documentId !== "number" ||
        !Number.isInteger(documentId) ||
        documentId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Selected document id is missing or invalid!",
      });
    }
    const embeddingResp = await createEmbeddings(question);
    const questionVector = `[${embeddingResp.embeddings[0].values.join(",")}]`;
    const documentIdCondition = documentId
      ? "AND document_chunks.document_id = $2"
      : "";
    const vectorQueryValues = documentId
      ? [questionVector, documentId]
      : [questionVector];
    const kwQueryValues = documentId ? [question, documentId] : [question];

    const vectorSimilarResult = await runQuery(
      `SELECT document_chunks.id AS chunk_id, documents.filename, document_chunks.document_id, document_chunks.content, document_chunks.embedding <=> $1 AS distance FROM document_chunks JOIN documents ON document_chunks.document_id = documents.id  WHERE document_chunks.embedding <=> $1 < ${SIMILARITY_THRESHOLD} ${documentIdCondition} ORDER BY distance LIMIT ${TOP_K}`,
      vectorQueryValues,
    );
    const keywordMatchResult = await runQuery(
      `SELECT document_chunks.id AS chunk_id, documents.filename, document_chunks.document_id, document_chunks.content FROM document_chunks JOIN documents on document_chunks.document_id = documents.id WHERE to_tsvector('english', document_chunks.content) @@ plainto_tsquery('english', $1) ${documentIdCondition}`,
      kwQueryValues,
    );
    const combinedVectorKwResult = [
      ...vectorSimilarResult.rows.map((row) => {
        return { ...row, matchType: "vector" };
      }),
      ...keywordMatchResult.rows.map((row) => {
        return { ...row, matchType: "keyword" };
      }),
    ];
    //removing duplicate doc id and chunk id between vector + kw matching combined result
    const docChunkIdMap = new Map();
    const uniqueVectoKwIDResult = combinedVectorKwResult.filter((result) => {
      const docChunkIdKey = `${result.document_id}-${result.chunk_id}`;
      if (!docChunkIdMap.has(docChunkIdKey)) {
        docChunkIdMap.set(docChunkIdKey, result);
        return true;
      }
      const hybridRow = docChunkIdMap.get(docChunkIdKey);
      if (result.matchType !== hybridRow.matchType)
        hybridRow.matchType = "hybrid";
      return false;
    });
    //removing duplicate content between vector + kw matching combined result
    const contentMap = new Map();
    const deDuplicateResult = uniqueVectoKwIDResult.filter((result) => {
      const normalizedContent = getNormalizedData(result.content);
      if (!contentMap.has(normalizedContent)) {
        contentMap.set(normalizedContent, result);
        return true;
      }
      const hybridContent = contentMap.get(normalizedContent);
      if (result.matchType !== hybridContent.matchType)
        hybridContent.matchType = "hybrid";
      return false;
    });

    if (deDuplicateResult.length === 0) {
      return res.status(200).json({
        success: true,
        message: "There is no relevant information for your query.",
        data: {
          response: null,
          sources: [],
        },
      });
    }
    const sources = deDuplicateResult.map(({ content, ...rest }) => rest);

    const context = deDuplicateResult
      .map((result) => result.content)
      .join("\n\n");
    const prompt = createPrompt(question, context);
    const aiResp = await askGemini(prompt);
    res.status(200).json({
      success: true,
      message: "Answer generated successfully",
      data: { response: aiResp.text, sources },
    });
  } catch (err) {
    console.log(err);
    if (err.code === "AI_SERVICE_ERROR") {
      return res.status(500).json({
        success: false,
        message: "AI service is temporarily unavailable. Please try again.",
      });
    }
    if (err.code === "DB_SERVICE_ERROR") {
      return res.status(500).json({
        success: false,
        message: "DB service is temporarily unavailable. Please try again.",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "error in processing the question" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
