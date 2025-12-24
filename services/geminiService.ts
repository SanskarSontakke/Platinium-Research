
import { GoogleGenAI, Modality } from "@google/genai";

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

/**
 * Transcribes audio bytes using Gemini's multimodal capabilities with context awareness.
 * @param base64Data The raw audio data
 * @param mimeType The audio mime type
 * @param context Optional text context (e.g. current draft, chat history) to help resolve technical terms
 */
export const transcribeAudio = async (base64Data: string, mimeType: string, context: string = "") => {
  return retryOperation(async () => {
    const ai = getAiClient();
    
    // Construct a context-aware prompt with stronger instructions for technical accuracy
    const prompt = `
      You are an expert transcriber assisting with a technical research project.
      
      Task: Transcribe the spoken words in this audio exactly.
      
      ${context ? `### RELEVANT PROJECT CONTEXT\nThe following text contains technical terms, acronyms, and names likely to appear in the audio:\n"""\n${context}\n"""\n` : ''}
      
      ### TRANSCRIPTION RULES:
      1. **Terminology**: Prioritize spellings found in the CONTEXT for any ambiguous terms or homophones (e.g., "Bohrium" vs "boring", "React" vs "react").
      2. **Output**: Return ONLY the transcribed text. Do not add "Transcribed text:" or timestamps.
      3. **Noise**: If the audio contains only silence or background noise, return an empty string.
      4. **Language**: Detect the language automatically and transcribe as-is.
      5. **Punctuation**: Add natural punctuation (periods, commas) for readability.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt }
        ]
      }
    });
    return response.text?.trim() || "";
  });
};

/**
 * Generates speech from text using the TTS model
 */
export const generateSpeech = async (text: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) throw new Error("No speech audio data received.");
    return audioData;
  });
};

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

export const generateImageFlash = async (prompt: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: { aspectRatio: '1:1' }
      }
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
        }
      }
    }
    throw new Error("No image data received.");
  });
};

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
    throw new Error("No image data received.");
  });
};

export const generateCreativePrompt = async (userConcept: string) => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      config: {
        temperature: 0.8,
        systemInstruction: `You are a world-class Prompt Engineer. Convert user concepts into detailed prompts.`
      },
      contents: { parts: [{ text: `User Concept: ${userConcept}` }] },
    });
    return response.text || "Could not generate prompts.";
  });
};

export const generateCitations = async (text: string, sources: string[], style: string = 'APA') => {
  return retryOperation(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Task: Add inline citations. Style: ${style}. Sources: ${sources.join(', ')}. Text: ${text}` }] },
    });
    return response.text || text;
  });
};
