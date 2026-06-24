import { ChatOpenAI } from "@langchain/openai";

// gpt-5-mini is a reasoning model: maxTokens caps hidden reasoning tokens
// together with the visible output, not just the output by itself, so it
// needs more headroom than a non-reasoning model would for the same schema.
// reasoning.effort is kept low since both use cases below are straightforward
// extraction tasks rather than ones that benefit from deep reasoning — that
// leaves more of the maxTokens budget for the actual output and keeps
// latency/cost down. temperature is intentionally omitted: reasoning models
// reject non-default temperature values.
export const openaiJobExtractor = new ChatOpenAI({
  model: "gpt-5-mini",
  maxTokens: 2048,
  reasoning: { effort: "minimal" },
  maxRetries: 2,
  apiKey: process.env.GPT_API_KEY,
});

export const openaiGapAnalysis = new ChatOpenAI({
  model: "gpt-5-mini",
  maxTokens: 4096,
  reasoning: { effort: "minimal" },
  maxRetries: 2,
  apiKey: process.env.GPT_API_KEY,
});

export const openaiCoverLetter = new ChatOpenAI({
  model: "gpt-5-mini",
  maxTokens: 3072,
  reasoning: { effort: "minimal" },
  maxRetries: 2,
  apiKey: process.env.GPT_API_KEY,
});

export const openaiInterviewPrep = new ChatOpenAI({
  model: "gpt-5-mini",
  maxTokens: 4096,
  reasoning: { effort: "minimal" },
  maxRetries: 2,
  apiKey: process.env.GPT_API_KEY,
});
