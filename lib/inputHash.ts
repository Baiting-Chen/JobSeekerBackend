import crypto from "crypto";

// Shared cache-key builder for the LLM result caches (GapAnalysis, CoverLetter).
// `version` should be bumped by callers whenever their prompt/scoring/model
// changes, so old cached rows stop being served as if they were comparable.
export function createInputHash(version: string, parts: (string | null | undefined)[]): string {
  const hash = crypto.createHash("sha256").update(version);
  for (const part of parts) {
    hash.update("::").update((part ?? "").trim());
  }
  return hash.digest("hex");
}
