import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-4-8";

export async function GET() {
  return Response.json({ hasServerKey: Boolean(process.env.ANTHROPIC_API_KEY) });
}

// ---------------------------------------------------------------------------
// Schémas de sortie structurée (output_config.format)
// ---------------------------------------------------------------------------

const besoinSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    resume: {
      type: "array",
      items: { type: "string" },
      description: "Résumé du besoin en environ 5 lignes courtes",
    },
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

// ---------------------------------------------------------------------------
// Prompts métier
// ---------------------------------------------------------------------------

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

interface DocBlock {
  type: "document";
  source: { type: "base64"; media_type: "application/pdf"; data: string };
}

function pdfBlock(base64?: string): DocBlock[] {
  if (!base64) return [];
  // Le data peut arriver sous forme de data URL ; on ne garde que le base64.
  const data = base64.includes(",") ? base64.split(",")[1] : base64;
  return [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data },
    },
  ];
}

function besoinContext(besoin: any): string {
  const c = besoin?.contraintes ?? {};
  return `# BESOIN CLIENT
Client : ${besoin?.client || "Non précisé"}
Opérationnel (manager côté client) : ${besoin?.operationnel || "Non précisé"}
Intitulé du poste : ${besoin?.intitule || "Non précisé"}

## Fiche de poste
${besoin?.fichePoste || "(voir document PDF joint)"}

## Contexte / qualification
${besoin?.contexte || "Non précisé"}

## Contraintes
- TJM : ${c.tjm || "Non précisé"}
- Localisation : ${c.localisation || "Non précisé"}
- Démarrage : ${c.demarrage || "Non précisé"}
- Télétravail : ${c.teletravail || "Non précisé"}

## Historique opérationnel (biais / préférences humaines du client)
${besoin?.historiqueOperationnel?.trim() || "Aucun élément fourni."}`;
}

// Parsing tolérant : gère le JSON pur (output_config) comme une réponse
// éventuellement entourée de texte ou de balises markdown (filet de sécurité).
function extractJson(raw: string): unknown {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    /* on tente une extraction */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* continue */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* continue */
    }
  }
  return undefined;
}

// --- Coercition défensive : le front ne doit jamais planter sur un champ
// manquant ou mal typé, même si le modèle dévie du schéma. ---

const str = (v: any, def = ""): string =>
  typeof v === "string" ? v : v == null ? def : String(v);

const arr = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter((x) => x != null).map((x) => String(x));
  if (v == null || v === "") return [];
  return [String(v)];
};

const clampInt = (v: any, def: number): number => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(0, Math.min(100, n));
};

const ENUM_SCORE = ["Fort", "Moyen", "Faible"];
const ENUM_RECO = ["À appeler en priorité", "Backup", "À écarter"];
const oneOf = (v: any, allowed: string[], def: string) =>
  allowed.includes(v) ? v : def;

function normalize(task: string, d: any, payload: any): any {
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
    const score = oneOf(d.score, ENUM_SCORE, "Moyen");
    const scoreDefault = score === "Fort" ? 80 : score === "Faible" ? 30 : 58;
    return {
      candidat: str(d.candidat, payload?.cvLabel || "Candidat"),
      score,
      scoreSur100: clampInt(d.scoreSur100, scoreDefault),
      recommandation: oneOf(d.recommandation, ENUM_RECO, "Backup"),
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
    const classement = Array.isArray(d.classement) ? d.classement : [];
    return {
      classement: classement.map((c: any, i: number) => ({
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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // On retire tout espace / saut de ligne : une clé valide n'en contient pas,
  // et cela évite le crash "invalid header value" sur un copier-coller foireux.
  const apiKey = (
    req.headers.get("x-user-api-key") ||
    process.env.ANTHROPIC_API_KEY ||
    ""
  ).replace(/\s+/g, "");

  if (!apiKey) {
    return Response.json(
      {
        error:
          "Aucune clé API Anthropic configurée. Renseignez ANTHROPIC_API_KEY côté serveur, ou collez une clé via le bouton ⚙ Réglages.",
      },
      { status: 400 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { task, payload } = body ?? {};
  const client = new Anthropic({ apiKey });

  try {
    if (task === "ping") {
      await client.messages.create({
        model: MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: "Réponds simplement: ok" }],
      } as any);
      return Response.json({ data: { ok: true } });
    }

    let userContent: any[] = [];
    let schema: any;

    if (task === "analyze_besoin") {
      schema = besoinSchema;
      userContent = [
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
      ];
    } else if (task === "match_cv") {
      schema = matchingSchema;
      userContent = [
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
- scoreSur100 : un entier 0-100 reflétant finement l'adéquation (cohérent avec le score : Fort ≈ 75-100, Moyen ≈ 45-74, Faible ≈ 0-44)
- recommandation : "À appeler en priorité" / "Backup" / "À écarter"
- synthese : 2 phrases qui justifient le score et la reco
- pointsForts : exactement 3 points forts vis-à-vis du besoin
- pointsVigilance : exactement 3 points de vigilance / risques (inclure les alertes liées à l'historique opérationnel le cas échéant)
- questionsCles : 3 à 5 questions précises à poser au candidat lors du call de qualification
- competencesCouvertes : parmi les compétences INDISPENSABLES du besoin, celles que le CV démontre clairement
- competencesManquantes : parmi les compétences INDISPENSABLES du besoin, celles absentes ou insuffisamment démontrées
- anneesExperience : estimation des années d'XP pertinentes
- disponibilite : si déductible du CV, sinon "À confirmer"
- tjmEstime : fourchette TJM marché FR cohérente avec le profil, marquée comme estimation`,
        },
      ];
    } else if (task === "rank_candidates") {
      schema = rankingSchema;
      userContent = [
        {
          type: "text",
          text: `Voici le besoin et l'analyse de plusieurs candidats déjà matchés. Établis un classement comparatif clair pour aider le recruteur à prioriser ses appels. Tiens compte de l'historique opérationnel.

${besoinContext(payload?.besoin)}

# CANDIDATS ANALYSÉS
${JSON.stringify(payload?.matchings ?? [], null, 2)}

Produis :
- classement : un tableau ordonné (rang 1 = meilleur fit global). Pour chaque candidat : candidat, rang, label court (ex. "Meilleur fit global", "Bon backup", "Moins prioritaire"), forces (1 phrase), blocages (1 phrase), action recommandée (1 phrase).
- synthese : 2-3 phrases de recommandation globale pour le recruteur.`,
        },
      ];
    } else if (task === "generate_brief") {
      schema = briefSchema;
      userContent = [
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
- briefClient : profil synthétique vendeur mais honnête à envoyer au client.
    - prenom, accroche (1 phrase qui donne envie de rencontrer le candidat), resumeExperiences (3-4 phrases sur les expériences pertinentes), pointsForts, pointsVigilance, anneesExperience, competencesCles, disponibilite, tjm.
- pitchMission : un texte d'accroche personnalisé que le recruteur enverra/dira AU CANDIDAT pour lui vendre la mission. Inclure : contexte client, intérêt de la mission, stack technique, modalités (TJM/lieu/télétravail/démarrage), pourquoi son profil matche, et les points à valider avec lui. Ton chaleureux et professionnel.`,
        },
      ];
    } else {
      return Response.json({ error: "Tâche inconnue." }, { status: 400 });
    }

    const params: any = {
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
      output_config: { format: { type: "json_schema", schema } },
    };

    const response = await createWithRetry(client, params);

    const textBlock = (response.content as any[]).find(
      (b: any) => b.type === "text",
    ) as any;

    if (!textBlock?.text) {
      return Response.json(
        { error: "Réponse IA vide. Réessayez." },
        { status: 502 },
      );
    }

    const parsed = extractJson(textBlock.text);
    if (parsed === undefined) {
      return Response.json(
        { error: "Réponse IA non exploitable. Réessayez." },
        { status: 502 },
      );
    }

    const data = normalize(task, parsed, payload);
    return Response.json({ data });
  } catch (err: any) {
    const raw =
      err?.error?.error?.message ||
      err?.message ||
      "Erreur lors de l'appel à l'IA.";
    const status =
      err?.status && Number.isInteger(err.status) ? err.status : 500;

    let message = raw;
    const low = String(raw).toLowerCase();
    if (status === 401 || low.includes("authentication") || low.includes("x-api-key")) {
      message =
        "Clé API invalide ou révoquée. Vérifiez votre clé (format sk-ant-…) dans Réglages, ou la variable ANTHROPIC_API_KEY de votre déploiement.";
    } else if (low.includes("invalid header") || low.includes("headers.append")) {
      message =
        "Clé API invalide : elle contient des caractères non autorisés. Recollez uniquement votre clé sk-ant-…, sans espace ni saut de ligne.";
    } else if (status === 429) {
      message = "Limite de requêtes atteinte. Patientez quelques secondes puis réessayez.";
    } else if (status === 529 || status >= 500) {
      message = "Service IA momentanément surchargé. Réessayez dans un instant.";
    }
    return Response.json({ error: message }, { status });
  }
}
