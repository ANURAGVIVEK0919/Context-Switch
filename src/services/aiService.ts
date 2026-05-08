import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "dummy-key",
  baseURL: "https://api.groq.com/openai/v1",
});

export const testConnection = async () => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Hello, this is a test connection." }],
    });
    console.log("AI Connection Successful:", response.choices[0]?.message?.content);
    return true;
  } catch (error) {
    console.error("AI Connection Failed:", error);
    return false;
  }
};

export const generateContextSummary = async (context: string) => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an AI assistant. Provide a concise summary of the developer's context." },
        { role: "user", content: `Context:\n${context}` }
      ],
    });
    return { summary: response.choices[0]?.message?.content || "No summary generated.", confidence: 0.9, next_steps: [] };
  } catch (error) {
    console.error("AI Context Summary Failed:", error);
    return { summary: "Fallback summary due to API error.", confidence: 0.0, next_steps: [] };
  }
};

export const aiReason = async (memoryContext: string, brief: string, systemPrompt?: string): Promise<Record<string, any>> => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt || "You are an AI assistant helping a developer. Return ONLY valid JSON."
        },
        { role: "user", content: `Context:\n${memoryContext}\n\nTask:\n${brief}` }
      ],
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    // Ensure baseline fields always exist, then spread all additional AI-returned fields
    return {
      summary:    parsed.summary    || "No reasoning generated.",
      confidence: parsed.confidence ?? 0,
      next_steps: parsed.next_steps || [],
      ...parsed  // pass through key_files, blockers, current_hypothesis, project_state, etc.
    };
  } catch (error) {
    console.error("AI Reason Failed:", error);
    return {
      summary:    "Fallback reasoning due to API error.",
      confidence: 0,
      next_steps: ["Check API Key", "Retry"]
    };
  }
};
