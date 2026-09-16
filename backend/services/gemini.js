import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function askGemini(prompt) {
  try {
    return await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });
  } catch (err) {
    console.log(err);
    const error = new Error("AI Service Error");
    error.code = "AI_SERVICE_ERROR";
    throw error;
  }
}

export async function createEmbeddings(text) {
  try {
    return await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
    });
  } catch (err) {
    console.log(err);
    const error = new Error("AI Service Error");
    error.code = "AI_SERVICE_ERROR";
    throw error;
  }
}
