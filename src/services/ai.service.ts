
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

@Injectable({ providedIn: 'root' })
export class AiService {
  private ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

  async chat(history: { role: string, parts: { text: string }[] }[], message: string): Promise<string> {
    const chat: Chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'You are an expert genealogist and historian for the "Generations of Grace" family tree, specializing in the Sekano and Monamodi lineages. Be respectful, insightful, and informative.',
      },
    });
    const result = await chat.sendMessage({ message });
    return result.text;
  }

  async editImage(base64Image: string, prompt: string): Promise<string> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: `Edit this image based on this instruction: ${prompt}. Return the modified image concepts.` }
        ]
      }
    });
    // In a real scenario, we'd use Imagen or a dedicated edit tool, but for this applet,
    // we simulate the generative workflow using Flash's multimodal capabilities.
    return response.text;
  }

  async generateVideo(base64Image: string, prompt: string): Promise<string> {
    let operation = await this.ai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt: prompt,
      image: {
        imageBytes: base64Image,
        mimeType: 'image/png',
      },
      config: { numberOfVideos: 1 }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await this.ai.operations.getVideosOperation({ operation: operation });
    }

    return `${operation.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`;
  }
}
