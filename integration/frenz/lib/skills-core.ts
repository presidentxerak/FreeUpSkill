// =============================================================================
// Skills — moteur métier portable (à coller dans Frenz : lib/skills-core.ts)
// Aucune dépendance à Next / Privy / Supabase. Seule dépendance : @anthropic-ai/sdk
//   npm i @anthropic-ai/sdk
// Reproduit à l'identique le cerveau de l'app Skills (prompts + schémas +
// normalisation défensive + retry). Voir SKILL.md pour la spec.
// =============================================================================

import Anthropic from "@anthropic-ai/sdk";

export const SKILLS_MODEL = "claude-opus-4-8";

export type SkillTask =
  | "analyze_besoin"
  | "match_cv"
  | "rank_candidates"
  | "generate_brief"
  | "ping";

// ----------------------------------------------------------------------------
// Types de sortie (à réexporter côté Frenz si besoin)
// ----------------------------------------------------------------------------

export interface Contraintes {
  tjm: string;
  localisation: string;
  demarrage: string;
  teletravail: string;
}
export interface BesoinInput {
  client: string;
  operationnel: string;
  intitule: string;
  fichePoste: string;
  contexte: string;
  contraintes: Contraintes;
  historiqueOperationnel: string;
}
export interface BesoinAnalysis {
  resume: string[];
  competencesIndispensables: string[];
  competencesSecondaires: string[];
  pointsVigilance: string[];
  typeProfil: string;
}
export type ScoreMatching = "Fort" | "Moyen" | "Faible";
export type Recommandation = "À appeler en priorité" | "Backup" | "À écarter";
export interface CvMatching {
  candidat: string;
  score: ScoreMatching;
  scoreSur100: number;
  recommandation: Recommandation;
  synthese: string;
  pointsForts: string[];
  pointsVigilance: string[];
  questionsCles: string[];
  competencesCouvertes: string[];
  competencesManquantes: string[];
  anneesExperience: string;
  disponibilite: string;
  tjmEstime: string;
}
export interface RankingEntry {
  candidat: string;
  rang: number;
  label: string;
  forces: string;
  blocages: string;
  action: string;
}
export interface Ranking {
  classement: RankingEntry[];
  synthese: string;
}
export interface BriefClient {
  prenom: string;
  accroche: string;
  resumeExperiences: string;
  pointsForts: string[];
  pointsVigilance: string[];
  anneesExperience: string;
  competencesCles: string[];
  disponibilite: string;
  tjm: string;
}
export interface BriefOutput {
  briefClient: BriefClient;
  pitchMission: string;
}

export class SkillError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

// ----------------------------------------------------------------------------
// Schémas (output_config.format)
// ----------------------------------------------------------------------------

const besoinSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    resume: { type: "array", items: { type: "string" } },
    competencesIndispensables: { type: "array", items: { type: "string" } },
    competencesSecondaires: { type: "array", items: { type: "string" } },
    pointsVigilance: { type: "array", items: { type: "string" } },
    typeProfil: { type: "string" },
  },
  required: [
    "resume",
    "competencesIndispensables",
    "competencesSecondaires",
    "pointsVigilance",
    "typeProfil",
  ],
};

const matchingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidat: { type: "string" },
    score: { type: "string", enum: ["Fort", "Moyen", "Faible"] },
    scoreSur100: { type: "integer" },
    recommandation: {
      type: "string",
      enum: ["À appeler en priorité", "Backup", "À écarter"],
    },
    synthese: { type: "string" },
    pointsForts: { type: "array", items: { type: "string" } },
    pointsVigilance: { type: "array", items: { type: "string" } },
    questionsCles: { type: "array", items: { type: "string" } },
    competencesCouvertes: { type: "array", items: { type: "string" } },
    competencesManquantes: { type: "array", items: { type: "string" } },
    anneesExperience: { type: "string" },
    disponibilite: { type: "string" },
    tjmEstime: { type: "string" },
  },
  required: [
    "candidat",
    "score",
    "scoreSur100",
    "recommandation",
    "synthese",
    "pointsForts",
    "pointsVigilance",
    "questionsCles",
    "competencesCouvertes",
    "competencesManquantes",
    "anneesExperience",
    "disponibilite",
    "tjmEstime",
  ],
};

const rankingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    classement: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidat: { type: "string" },
          rang: { type: "integer" },
          label: { type: "string" },
          forces: { type: "string" },
          blocages: { type: "string" },
          action: { type: "string" },
        },
        required: ["candidat", "rang", "label", "forces", "blocages", "action"],
      },
    },
    synthese: { type: "string" },
  },
  required: ["classement", "synthese"],
};

const briefSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    briefClient: {
      type: "object",
      additionalProperties: false,
      properties: {
        prenom: { type: "string" },
        accroche: { type: "string" },
        resumeExperiences: { type: "string" },
        pointsForts: { type: "array", items: { type: "string" } },
        pointsVigilance: { type: "array", items: { type: "string" } },
        anneesExperience: { type: "string" },
        competencesCles: { type: "array", items: { type: "string" } },
        disponibilite: { type: "string" },
        tjm: { type: "string" },
      },
      required: [
        "prenom",
        "accroche",
        "resumeExperiences",
        "pointsForts",
        "pointsVigilance",
        "anneesExperience",
        "competencesCles",
        "disponibilite",
        "tjm",
      ],
    },
    pitchMission: { type: "string" },
  },
  required: ["briefClient", "pitchMission"],
};

// ----------------------------------------------------------------------------
// Prompts
// ----------------------------------------------------------------------------

const SYSTEM = `Tu es un assistant IA expert au service des Tech Recruiters de TDU Consulting (ESN / cabinet de recrutement tech français).
Ton rôle : aider le recruteur à qualifier un besoin client et à analyser une shortlist de CV pour prioriser ses actions.
Tu raisonnes comme un recruteur tech senior : tu connais les stacks, les TJM du marché français, les red flags d'un CV, et les attentes d'un opérationnel côté client.
Règles :
- Réponds toujours en français, de façon concrète, directe et actionnable. Pas de blabla, pas de généralités creuses.
- Justifie par des éléments PRÉCIS et vérifiables du CV ou de la fiche (techno, années, contexte) — jamais de formules passe-partout type "bon profil polyvalent".
- Différencie nettement les candidats : évite de leur attribuer les mêmes forces/faiblesses génériques. Le recruteur doit pouvoir trancher.
- Sois honnête et tranché : si un profil ne matche pas, dis-le clairement et explique pourquoi.
- Tu n'inventes jamais d'information absente du CV ou de la fiche de poste. Si une donnée manque (TJM, dispo...), indique "Non précisé" ou une estimation explicitement marquée comme telle.
- Tu raisonnes marché français (TJM, séniorité, rareté des compétences) en 2025.
- Quand un "historique opérationnel" (biais/préférences humaines du client) est fourni, tu DOIS impérativement t'en servir pour ajuster tes alertes, ton scoring et tes recommandations, et le mentionner explicitement quand il fait pencher la balance.

FORMAT DE SORTIE : tu réponds UNIQUEMENT par un objet JSON valide, sans aucun texte autour, sans commentaire et sans balise markdown (pas de \`\`\`). Respecte exactement les clés demandées dans la consigne.`;

function pdfBlock(base64?: string) {
  if (!base64) return [];
  const data = base64.includes(",") ? base64.split(",")[1] : base64;
  return [
    {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data,
      },
    },
  ];
}

function besoinContext(b: any): string {
  const c = b?.contraintes ?? {};
  return `# BESOIN CLIENT
Client : ${b?.client || "Non précisé"}
Opérationnel (manager côté client) : ${b?.operationnel || "Non précisé"}
Intitulé du poste : ${b?.intitule || "Non précisé"}

## Fiche de poste
${b?.fichePoste || "(voir document PDF joint)"}

## Contexte / qualification
${b?.contexte || "Non précisé"}

## Contraintes
- TJM : ${c.tjm || "Non précisé"}
- Localisation : ${c.localisation || "Non précisé"}
- Démarrage : ${c.demarrage || "Non précisé"}
- Télétravail : ${c.teletravail || "Non précisé"}

## Historique opérationnel (biais / préférences humaines du client)
${b?.historiqueOperationnel?.trim() || "Aucun élément fourni."}`;
}

// ----------------------------------------------------------------------------
// Normalisation défensive + parsing tolérant
// ----------------------------------------------------------------------------

const str = (v: any, def = ""): string =>
  typeof v === "string" ? v : v == null ? def : String(v);
const arr = (v: any): string[] =>
  Array.isArray(v)
    ? v.filter((x) => x != null).map((x) => String(x))
    : v == null || v === ""
      ? []
      : [String(v)];
const clampInt = (v: any, def: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : def;
};
const oneOf = (v: any, allowed: string[], def: string) =>
  allowed.includes(v) ? v : def;

function extractJson(raw: string): any {
  const text = String(raw).trim();
  try {
    return JSON.parse(text);
  } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e > s) {
    try {
      return JSON.parse(text.slice(s, e + 1));
    } catch {}
  }
  return undefined;
}

function normalize(task: SkillTask, d: any, payload: any): any {
  d = d && typeof d === "object" ? d : {};
  if (task === "analyze_besoin") {
    return {
      resume: arr(d.resume),
      competencesIndispensables: arr(d.competencesIndispensables),
      competencesSecondaires: arr(d.competencesSecondaires),
      pointsVigilance: arr(d.pointsVigilance),
      typeProfil: str(d.typeProfil),
    };
  }
  if (task === "match_cv") {
    const score = oneOf(d.score, ["Fort", "Moyen", "Faible"], "Moyen");
    const def = score === "Fort" ? 80 : score === "Faible" ? 30 : 58;
    return {
      candidat: str(d.candidat, payload?.cvLabel || "Candidat"),
      score,
      scoreSur100: clampInt(d.scoreSur100, def),
      recommandation: oneOf(
        d.recommandation,
        ["À appeler en priorité", "Backup", "À écarter"],
        "Backup",
      ),
      synthese: str(d.synthese),
      pointsForts: arr(d.pointsForts),
      pointsVigilance: arr(d.pointsVigilance),
      questionsCles: arr(d.questionsCles),
      competencesCouvertes: arr(d.competencesCouvertes),
      competencesManquantes: arr(d.competencesManquantes),
      anneesExperience: str(d.anneesExperience, "À confirmer"),
      disponibilite: str(d.disponibilite, "À confirmer"),
      tjmEstime: str(d.tjmEstime, "À estimer"),
    };
  }
  if (task === "rank_candidates") {
    const cl = Array.isArray(d.classement) ? d.classement : [];
    return {
      classement: cl.map((c: any, i: number) => ({
        candidat: str(c?.candidat, `Candidat ${i + 1}`),
        rang: Number.isFinite(Number(c?.rang)) ? Number(c.rang) : i + 1,
        label: str(c?.label),
        forces: str(c?.forces),
        blocages: str(c?.blocages),
        action: str(c?.action),
      })),
      synthese: str(d.synthese),
    };
  }
  if (task === "generate_brief") {
    const b = d.briefClient && typeof d.briefClient === "object" ? d.briefClient : {};
    return {
      briefClient: {
        prenom: str(b.prenom, "Candidat"),
        accroche: str(b.accroche),
        resumeExperiences: str(b.resumeExperiences),
        pointsForts: arr(b.pointsForts),
        pointsVigilance: arr(b.pointsVigilance),
        anneesExperience: str(b.anneesExperience, "À confirmer"),
        competencesCles: arr(b.competencesCles),
        disponibilite: str(b.disponibilite, "À confirmer"),
        tjm: str(b.tjm, "À estimer"),
      },
      pitchMission: str(d.pitchMission),
    };
  }
  return d;
}

// ----------------------------------------------------------------------------
// Construction du message + appel + retry
// ----------------------------------------------------------------------------

function buildRequest(task: SkillTask, payload: any): { content: any[]; schema: any } {
  if (task === "analyze_besoin") {
    return {
      schema: besoinSchema,
      content: [
        ...pdfBlock(payload?.fichePdfBase64),
        {
          type: "text",
          text: `Analyse le besoin ci-dessous et produis une qualification métier.

${besoinContext(payload?.besoin)}

Produis :
- resume : le besoin résumé en ~5 lignes courtes et percutantes (1 idée par ligne)
- competencesIndispensables : les must-have techniques et fonctionnels
- competencesSecondaires : les nice-to-have
- pointsVigilance : risques de sourcing, incohérences, exigences difficiles à trouver sur le marché FR (et tout point soulevé par l'historique opérationnel)
- typeProfil : le portrait-robot du profil idéal (séniorité, posture, type de parcours)`,
        },
      ],
    };
  }
  if (task === "match_cv") {
    return {
      schema: matchingSchema,
      content: [
        ...pdfBlock(payload?.cvPdfBase64),
        {
          type: "text",
          text: `Analyse ce CV au regard du besoin, en tenant compte de l'historique opérationnel.

${besoinContext(payload?.besoin)}

# CV À ANALYSER — ${payload?.cvLabel || "Candidat"}
${payload?.cvText?.trim() || "(voir document PDF joint)"}

Produis un matching métier :
- candidat : prénom du candidat si présent dans le CV, sinon "${payload?.cvLabel || "Candidat"}"
- score : Fort / Moyen / Faible (adéquation globale au besoin)
- scoreSur100 : un entier 0-100 (Fort ≈ 75-100, Moyen ≈ 45-74, Faible ≈ 0-44)
- recommandation : "À appeler en priorité" / "Backup" / "À écarter"
- synthese : 2 phrases qui justifient le score et la reco
- pointsForts : exactement 3 points forts vis-à-vis du besoin
- pointsVigilance : exactement 3 points de vigilance / risques (alertes liées à l'historique opérationnel le cas échéant)
- questionsCles : 3 à 5 questions précises à poser au candidat lors du call
- competencesCouvertes : parmi les compétences INDISPENSABLES, celles démontrées par le CV
- competencesManquantes : parmi les compétences INDISPENSABLES, celles absentes/insuffisantes
- anneesExperience : estimation des années d'XP pertinentes
- disponibilite : si déductible du CV, sinon "À confirmer"
- tjmEstime : fourchette TJM marché FR cohérente, marquée comme estimation`,
        },
      ],
    };
  }
  if (task === "rank_candidates") {
    return {
      schema: rankingSchema,
      content: [
        {
          type: "text",
          text: `Voici le besoin et l'analyse de plusieurs candidats déjà matchés. Établis un classement comparatif clair pour aider le recruteur à prioriser ses appels. Tiens compte de l'historique opérationnel.

${besoinContext(payload?.besoin)}

# CANDIDATS ANALYSÉS
${JSON.stringify(payload?.matchings ?? [], null, 2)}

Produis :
- classement : tableau ordonné (rang 1 = meilleur fit). Pour chaque candidat : candidat, rang, label court, forces (1 phrase), blocages (1 phrase), action recommandée (1 phrase).
- synthese : 2-3 phrases de recommandation globale pour le recruteur.`,
        },
      ],
    };
  }
  if (task === "generate_brief") {
    return {
      schema: briefSchema,
      content: [
        ...pdfBlock(payload?.cvPdfBase64),
        {
          type: "text",
          text: `À partir du meilleur candidat, génère le Brief Client (format TDU) et le Pitch Mission pour le recruteur.

${besoinContext(payload?.besoin)}

# MEILLEUR CANDIDAT — analyse
${JSON.stringify(payload?.matching ?? {}, null, 2)}

# CV DU MEILLEUR CANDIDAT
${payload?.cvText?.trim() || "(voir document PDF joint)"}

Produis :
- briefClient : { prenom, accroche, resumeExperiences (3-4 phrases), pointsForts, pointsVigilance, anneesExperience, competencesCles, disponibilite, tjm }
- pitchMission : texte d'accroche personnalisé À DIRE AU CANDIDAT (contexte client, intérêt mission, stack, modalités TJM/lieu/TT/démarrage, pourquoi son profil matche, points à valider). Ton chaleureux et professionnel.`,
        },
      ],
    };
  }
  throw new SkillError("Tâche inconnue.", 400);
}

async function createWithRetry(client: Anthropic, params: any, tries = 3) {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await client.messages.create(params);
    } catch (e: any) {
      lastErr = e;
      const s = e?.status;
      const retryable = s === 429 || s === 529 || (s >= 500 && s < 600);
      if (i < tries - 1 && retryable) {
        await new Promise((r) => setTimeout(r, 700 * Math.pow(2, i)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

function friendly(err: any): SkillError {
  const raw =
    err?.error?.error?.message || err?.message || "Erreur lors de l'appel à l'IA.";
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
  const low = String(raw).toLowerCase();
  let message = raw;
  if (
    low.includes("credit balance") ||
    low.includes("billing") ||
    low.includes("too low") ||
    low.includes("insufficient")
  ) {
    message =
      "Crédit API Anthropic insuffisant. L'API se facture séparément des abonnements Claude : ajoutez du crédit sur console.anthropic.com/settings/billing.";
  } else if (status === 401 || low.includes("authentication") || low.includes("x-api-key")) {
    message = "Clé API invalide ou révoquée (format sk-ant-…).";
  } else if (status === 429) {
    message = "Limite de requêtes atteinte. Réessayez dans quelques secondes.";
  } else if (status === 529 || status >= 500) {
    message = "Service IA momentanément surchargé. Réessayez.";
  }
  return new SkillError(message, status);
}

/**
 * Point d'entrée unique. Lance une opération Skills et renvoie l'objet normalisé.
 * @param apiKey  clé Anthropic (process.env.ANTHROPIC_API_KEY côté serveur)
 */
export async function runSkill(
  task: SkillTask,
  payload: any,
  apiKey: string,
): Promise<any> {
  const key = (apiKey || "").replace(/\s+/g, "");
  if (!key) throw new SkillError("Clé API manquante.", 400);
  const client = new Anthropic({ apiKey: key });

  try {
    if (task === "ping") {
      await client.messages.create({
        model: SKILLS_MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: "Réponds simplement: ok" }],
      } as any);
      return { ok: true };
    }

    const { content, schema } = buildRequest(task, payload);
    const response = await createWithRetry(client, {
      model: SKILLS_MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema } },
    });

    const textBlock = (response.content as any[]).find((b) => b.type === "text") as any;
    const parsed = textBlock?.text ? extractJson(textBlock.text) : undefined;
    if (parsed === undefined) throw new SkillError("Réponse IA non exploitable.", 502);
    return normalize(task, parsed, payload);
  } catch (e: any) {
    if (e instanceof SkillError) throw e;
    throw friendly(e);
  }
}
