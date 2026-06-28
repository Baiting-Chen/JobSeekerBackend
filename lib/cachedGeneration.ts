import type { Prisma } from "@prisma/client";

// Shared find-unless-force -> generate -> upsert pattern for the per-user LLM
// result caches (GapAnalysis, CoverLetter, InterviewPrep). All three caches use
// the same shape: keyed by @@unique([userId, inputHash]), with a nullable
// applicationId kept only so the row survives application deletion.
// `findUnique` is typed against the real Json read-back type (Prisma.JsonValue)
// rather than TResult directly, since Prisma can't know the JSON column's shape —
// the cast to TResult happens once, here, instead of at every call site.
type CacheDelegate<TResult> = {
  findUnique(args: {
    where: { userId_inputHash: { userId: string; inputHash: string } };
  }): Promise<{ result: Prisma.JsonValue } | null>;
  upsert(args: {
    where: { userId_inputHash: { userId: string; inputHash: string } };
    create: { userId: string; applicationId: string; inputHash: string; result: TResult };
    update: { applicationId: string; result: TResult };
  }): Promise<unknown>;
};

export async function getOrGenerate<TResult>(
  delegate: CacheDelegate<TResult>,
  params: { userId: string; applicationId: string; inputHash: string; force: boolean },
  generate: () => Promise<TResult>,
): Promise<TResult> {
  const { userId, applicationId, inputHash, force } = params;

  if (!force) {
    const cached = await delegate.findUnique({ where: { userId_inputHash: { userId, inputHash } } });
    if (cached) return cached.result as TResult;
  }

  const result = await generate();

  await delegate.upsert({
    where: { userId_inputHash: { userId, inputHash } },
    create: { userId, applicationId, inputHash, result },
    update: { applicationId, result },
  });

  return result;
}
