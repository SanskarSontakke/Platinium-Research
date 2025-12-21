
import { GoogleGenAI } from "@google/genai";

// Helper to get a fresh client instance with the latest API Key
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
         const delay = 2000 * Math.pow(2, i);
         await sleep(delay);
         continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Export raw helpers for legacy/direct usage if needed, but mostly used by Agent tools now
export const performWebSearch = async (query: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: query }] },
      config: { tools: [{ googleSearch: {} }] },
    });
    const text = response.text || "No results.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((c: any) => c.web).filter((w: any) => w);
    return { text, sources };
  });
};

export const performDeepReasoning = async (problem: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: [{ text: problem }] },
      config: { thinkingConfig: { thinkingBudget: 32768 } },
    });
    return response.text || "No reasoning generated.";
  });
};

export const analyzeImage = async (base64: string, mime: string, prompt: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    // Use the recommended gemini-3-flash-preview for multimodal tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64, mimeType: mime } }, 
          { text: `Analyze this image in detail. Task: ${prompt}` }
        ]
      }
    });
    return response.text || "No analysis generated.";
  });
};

export const getLiveClient = () => {
  const ai = getAiClient();
  return ai.live;
}

/**
 * Generate actual image using Gemini 2.5 Flash Image (Nano Banana)
 */
export const generateImageFlash = async (prompt: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: '1:1' } // Default square
      }
    });
    
    // Iterate through parts to find the image
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
        }
      }
    }
    throw new Error("No image data received from Gemini Flash.");
  });
};

/**
 * Generate actual image using Imagen 3 (Imagen 4.0 Generate)
 */
export const generateImageImagen = async (prompt: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/png'
      }
    });

    const img = response.generatedImages?.[0]?.image;
    if (img && img.imageBytes) {
      return { base64: img.imageBytes, mimeType: 'image/png' };
    }
    throw new Error("No image data received from Imagen.");
  });
};

/**
 * Generate EXPERT PROMPTS for tools like Midjourney, DALL-E 3, or Gemini Advanced.
 */
export const generateCreativePrompt = async (userConcept: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Use the smartest model for prompt engineering
      config: {
        temperature: 0.8,
        systemInstruction: `You are a world-class Prompt Engineer specialized in Generative Art.
        Your task is to take a simple user concept and convert it into highly detailed, technical image generation prompts.
        
        Output Format (Markdown):
        
        ### 🎨 Midjourney v6
        \`[The Prompt]\`
        
        ### 🌌 DALL-E 3
        \`[The Prompt]\`
        
        Do not explain. Just provide prompts.`
      },
      contents: { parts: [{ text: `User Concept: ${userConcept}` }] },
    });

    return response.text || "Could not generate prompts.";
  });
};

export const refinePrompt = async (originalPrompt: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `Refine this prompt for clarity and intent preservation.`,
      },
      contents: { parts: [{ text: originalPrompt }] },
    });
    return response.text?.trim() || originalPrompt;
  });
};

export const generateCitations = async (text: string, sources: string[], style: string = 'APA') => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `
        Task: Add inline citations [Author, Year].
        Sources:
        ${sources.length > 0 ? sources.join('\n') : "None."}
        
        Text:
        ${text}
      ` }] },
    });
    return response.text || text;
  });
};