import { OpenRouter } from "@openrouter/sdk";
import Bun from "bun";

export const client = new OpenRouter({
  apiKey: Bun.env.OPENROUTER_API_KEY,
});

