// =============================================================================
// Frenz — client typé pour appeler /api/qualification depuis le front (React 18)
// Chemin cible : lib/skills-client.ts
// =============================================================================

import type {
  BesoinInput,
  BesoinAnalysis,
  CvMatching,
  Ranking,
  BriefOutput,
} from "./skills-core";

// `getToken` = la fonction d'accès au token Privy. Dans un composant :
//   const { getAccessToken } = usePrivy();
//   const skills = makeSkillsClient(getAccessToken);
type GetToken = () => Promise<string | null>;

async function call<T>(
  getToken: GetToken,
  task: string,
  payload: unknown,
): Promise<T> {
  const token = await getToken();
  const res = await fetch("/api/qualification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ task, payload }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Erreur inconnue.");
  return json.data as T;
}

export function makeSkillsClient(getToken: GetToken) {
  return {
    analyzeBesoin: (besoin: BesoinInput, fichePdfBase64?: string) =>
      call<BesoinAnalysis>(getToken, "analyze_besoin", { besoin, fichePdfBase64 }),

    matchCv: (args: {
      besoin: BesoinInput;
      cvLabel: string;
      cvText?: string;
      cvPdfBase64?: string;
    }) => call<CvMatching>(getToken, "match_cv", args),

    rankCandidates: (besoin: BesoinInput, matchings: CvMatching[]) =>
      call<Ranking>(getToken, "rank_candidates", { besoin, matchings }),

    generateBrief: (args: {
      besoin: BesoinInput;
      matching: CvMatching;
      cvText?: string;
      cvPdfBase64?: string;
    }) => call<BriefOutput>(getToken, "generate_brief", args),

    ping: () => call<{ ok: boolean }>(getToken, "ping", {}),
  };
}

export type SkillsClient = ReturnType<typeof makeSkillsClient>;
