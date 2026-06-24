import { ServiceUnavailableError } from "../errors/AppError";

// Translates provider-specific LLM failures (quota/overload status codes, or
// LangChain's OutputParserException on truncated/malformed structured output)
// into the retryable 503 the frontend already knows how to handle. Anything
// else is rethrown as-is.
export function handleLLMError(error: unknown, parseErrorMessage?: string): never {
  const status = (error as any)?.status;
  if (status === 503 || status === 429) {
    // AppError instances aren't logged by errorHandler, so log here to keep
    // visibility into quota (429) vs overload (503) failures from the provider.
    console.error("LLM call failed:", status, (error as any)?.message);
    throw new ServiceUnavailableError();
  }

  const name = (error as any)?.name;
  const message = (error as any)?.message ?? "";
  if (name === "OutputParserException" || message.includes("Failed to parse") || message.includes("OUTPUT_PARSING_FAILURE")) {
    throw new ServiceUnavailableError(parseErrorMessage ?? "Output was too long or malformed. Please try again.");
  }

  throw error;
}
