import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateAIResponse = async (prompt) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash"
  });

  const result = await model.generateContent(prompt);

  return result.response.text();
};