import { GoogleGenAI } from "@google/genai";

export const getGeminiClient = (): GoogleGenAI => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const ensurePaidKey = async (): Promise<boolean> => {
  try {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
      // Assume success after dialog close as per instruction
      return true;
    }
    return true;
  } catch (e) {
    console.error("Error selecting API key:", e);
    return false;
  }
};