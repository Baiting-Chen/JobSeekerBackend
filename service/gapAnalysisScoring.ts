export type MatchLevel = "strong" | "weak" | "missing";

export interface ScoredSkill {
  skill: string;
  category: "must_have" | "nice_to_have";
  matchLevel: MatchLevel;
  evidence: string | null;
}

// Collapses exact case-insensitive duplicates only (e.g. "TypeScript" listed twice).
// This is NOT semantic alias normalization ("TS" vs "TypeScript") — that's deliberately
// left to the LLM rather than a hand-maintained alias map. On a matchLevel tie, prefers
// whichever duplicate has concrete evidence over one with null evidence, rather than
// arbitrarily keeping whichever happened to appear first.
export function dedupeSkills<T extends ScoredSkill>(skills: T[]): T[] {
  const rank: Record<MatchLevel, number> = { strong: 2, weak: 1, missing: 0 };
  const map = new Map<string, T>();
  for (const skill of skills) {
    const key = skill.skill.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, skill);
      continue;
    }
    const rankDiff = rank[skill.matchLevel] - rank[existing.matchLevel];
    const prefersNew = rankDiff > 0 || (rankDiff === 0 && !existing.evidence && !!skill.evidence);
    if (prefersNew) map.set(key, skill);
  }
  return Array.from(map.values());
}

function getMatchMultiplier(matchLevel: MatchLevel): number {
  switch (matchLevel) {
    case "strong":
      return 1;
    case "weak":
      return 0.35;
    case "missing":
      return 0;
  }
}

// Plain average within a single category — the must-have/nice-to-have 3:1
// weighting only matters once the two categories are combined (see
// calculateOverallMatch below), it cancels out when scoring one category alone.
function averageMatchScore(skills: ScoredSkill[]): number {
  if (skills.length === 0) return 0;
  const sum = skills.reduce((acc, s) => acc + getMatchMultiplier(s.matchLevel), 0);
  return (sum / skills.length) * 100;
}

// Binary "matched" scoring let a single thin piece of evidence count the same
// as a strong direct match, which inflated scores. These caps put a ceiling on
// the score whenever the must-have requirements — the ones that actually gate
// whether a candidate is a fit — are mostly weak or missing, regardless of how
// well the nice-to-haves did. Each rule is independent and only ever lowers
// the score (via Math.min), so order between them doesn't matter.
function applyMustHaveCap(score: number, mustHaves: ScoredSkill[]): number {
  if (mustHaves.length === 0) return score;

  const strongRatio = mustHaves.filter((s) => s.matchLevel === "strong").length / mustHaves.length;
  const weakOrMissingRatio = mustHaves.filter((s) => s.matchLevel !== "strong").length / mustHaves.length;
  const missingCount = mustHaves.filter((s) => s.matchLevel === "missing").length;

  let capped = score;
  if (strongRatio < 0.3) capped = Math.min(capped, 60);
  if (weakOrMissingRatio >= 0.5) capped = Math.min(capped, 65);
  if (missingCount >= 3) capped = Math.min(capped, 70);
  if (missingCount >= 5) capped = Math.min(capped, 55);
  return capped;
}

export function calculateOverallMatch(skills: ScoredSkill[]): number {
  const mustHaves = skills.filter((s) => s.category === "must_have");
  const niceToHaves = skills.filter((s) => s.category === "nice_to_have");

  const totalWeight = mustHaves.length * 3 + niceToHaves.length * 1;
  if (totalWeight === 0) return 0;

  const earnedWeight =
    mustHaves.reduce((acc, s) => acc + 3 * getMatchMultiplier(s.matchLevel), 0) +
    niceToHaves.reduce((acc, s) => acc + 1 * getMatchMultiplier(s.matchLevel), 0);

  const raw = (earnedWeight / totalWeight) * 100;
  return Math.round(applyMustHaveCap(raw, mustHaves));
}

export function calculateBreakdown(skills: ScoredSkill[]) {
  const mustHaves = skills.filter((s) => s.category === "must_have");
  const niceToHaves = skills.filter((s) => s.category === "nice_to_have");

  // mustHaveScore goes through the same cap as overallMatch — otherwise the
  // breakdown could show e.g. "Must-Have: 85%" right next to an overall score
  // capped to 70%, which would look self-contradictory in the UI.
  return {
    mustHaveScore: mustHaves.length === 0 ? null : Math.round(applyMustHaveCap(averageMatchScore(mustHaves), mustHaves)),
    niceToHaveScore: niceToHaves.length === 0 ? null : Math.round(averageMatchScore(niceToHaves)),
  };
}
