
import { GoogleGenAI } from '@google/genai';

// FIX: Read the API key from the global window object instead of Vite's import.meta.env
const apiKey = window.GEMINI_API_KEY;

if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
  console.warn("GEMINI_API_KEY is not set on the window object or is a placeholder. AI features will be disabled.");
}

// Initialize with a placeholder if the key is missing to avoid crashing the app.
export const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key', vertexai: true });
