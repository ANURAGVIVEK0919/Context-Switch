import OpenAI from "openai";

// dotenv is now loaded in server.ts

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
  } catch (error: any) {
    console.error("AI Context Summary Failed:", error.message || error);
    return { summary: "Fallback summary due to API error: " + (error.message || "Unknown error"), confidence: 0.0, next_steps: [] };
  }
};

export const aiReason = async (memoryContext: string, brief: string) => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an AI assistant helping a developer. Format your response strictly as JSON with summary (string), confidence (number), and next_steps (array of strings)." },
        { role: "user", content: `Context:\n${memoryContext}\n\nTask:\n${brief}` }
      ],
      response_format: { type: "json_object" }
    });
    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "No reasoning generated.",
      confidence: parsed.confidence || 0.0,
      next_steps: parsed.next_steps || []
    };
  } catch (error) {
    console.error("AI Reason Failed:", error);
    return { summary: "Fallback reasoning due to API error.", confidence: 0.0, next_steps: ["Check API Key", "Retry"] };
  }
};

export const synthesizeMemory = async (events: string) => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are a senior developer. Analyze the provided event log and summarize any architectural decisions, major bug fixes, or key project facts discovered in this session. Format your response as a concise list of facts." },
        { role: "user", content: `Event Log:\n${events}` }
      ],
    });
    return response.choices[0]?.message?.content || "No significant memory synthesized.";
  } catch (error) {
    console.error("Memory Synthesis Failed:", error);
    return null;
  }
};

export const askOpenClaw = async (context: string, question: string) => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { 
          role: "system", 
          content: "You are OpenClaw, an AI that has access to a developer's history (events, notes, and memory). Answer the user's question accurately based ONLY on the provided context. If the answer isn't in the logs, say so." 
        },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${question}` }
      ],
    });
    return response.choices[0]?.message?.content || "I couldn't find an answer to that in your history.";
  } catch (error) {
    console.error("AskOpenClaw Reasoning Failed:", error);
    return "Sorry, I encountered an error while searching your history.";
  }
};
