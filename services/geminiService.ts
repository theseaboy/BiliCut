import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { TranscriptSegment, Highlight, VideoData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// We cache the chat session to maintain history
let chatSession: Chat | null = null;

export const initializeChat = (transcript: TranscriptSegment[]) => {
  // Limit context size to avoid token overflow for very long videos
  const context = transcript.slice(0, 300).map(t => `[${t.timestamp}] ${t.text}`).join("\n");
  
  const systemInstruction = `
    You are an AI learning assistant for a video. 
    You have access to the transcript (or a summary) of the video provided below.
    Answer the user's questions based primarily on this transcript.
    If the answer is not in the transcript, use your general knowledge but mention that it wasn't explicitly in the video.
    Keep answers concise, helpful, and encouraging.
    
    TRANSCRIPT/CONTENT SUMMARY:
    ${context}
  `;

  chatSession = ai.chats.create({
    model: 'gemini-2.5-flash-latest',
    config: {
      systemInstruction: systemInstruction,
    },
  });
};

export const sendMessageToGemini = async (message: string): Promise<string> => {
  if (!chatSession) {
    throw new Error("Chat session not initialized");
  }

  try {
    const response: GenerateContentResponse = await chatSession.sendMessage({ message });
    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while processing your request.";
  }
};

/**
 * Generates highlights and a simulated transcript when official data is missing.
 * Uses metadata (Title, Description, Category, Author) to hallucinate a plausible structure.
 */
export const generateVideoContent = async (
  title: string, 
  description: string, 
  duration: number,
  category: string = "General",
  author: string = "Creator"
): Promise<{ highlights: Highlight[]; transcript: TranscriptSegment[] }> => {

  const prompt = `
    I have a Bilibili video but NO subtitles. I need you to generate a *simulated* transcript and highlights based on the metadata.
    
    Video Details:
    - Title: "${title}"
    - Author: "${author}"
    - Category: "${category}"
    - Duration: ${duration} seconds
    - Description: "${description.slice(0, 1000)}"

    Task:
    1. **Highlights**: Create 4-6 key chapters/highlights with estimated timestamps and distinct colors.
    2. **Transcript**: Create a *simulated* transcript. 
       - Break it down into segments roughly every 45-90 seconds.
       - The text should be a high-quality summary of what is likely being discussed in that segment based on the title/category.
       - It should read like a spoken script or a detailed summary.

    Return the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            highlights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  color: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["id", "title", "startTime", "endTime", "color", "description"]
              }
            },
            transcript: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                },
                required: ["id", "text", "timestamp", "startTime"]
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("Empty response from Gemini");

  } catch (error) {
    console.error("Failed to generate video content:", error);
    return { highlights: [], transcript: [] };
  }
};