import { testConnection } from "./src/services/aiService";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function test() {
  console.log("Testing AI Connection...");
  const result = await testConnection();
  console.log("Result:", result);
}

test();
