import { generateAIResponse } from "../services/ai.service.js";

export const reviewCode = async (req, res) => {
  try {
    const { language, code } = req.body;

    const prompt = `
    You are an expert senior software engineer.

    Review this ${language} code.

    Analyze:
    - Bugs
    - Performance issues
    - Readability
    - Security concerns
    - Best practices

    Also provide:
    - A quality score out of 10
    - Actionable improvements

    Code:
    ${code}
    `;

    const review = await generateAIResponse(prompt);

    res.status(200).json({
      review,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};