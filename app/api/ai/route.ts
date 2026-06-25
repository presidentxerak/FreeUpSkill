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
    recommandation: {
      type: "string",
      enum: ["À appeler en priorité", "Backup", "À écarter"],
    },
    synthese: { type: "string" },
    pointsForts: { type: "array", items: { type: "string" } },
    pointsVigilance: { type: "array", items: { type: "string" } },
    questionsCles: { type: "array", items: { type: "string" } },
    anneesExperience: { type: "string" },
    disponibilite: { type: "string" },
    tjmEstime: { type: "string" },
  },
  required: [
    "candidat",
    "score",
    "recommandation",
    "synthese",
    "pointsForts",
    "pointsVigilance",
    "questionsCles",
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
- Réponds toujours en français, de façon concrète, directe et actionnable. Pas de blabla.
- Sois honnête : si un profil ne matche pas, dis-le clairement.
- Tu n'inventes jamais d'information absente du CV ou de la fiche de poste. Si une donnée manque (TJM, dispo...), indique "Non précisé" ou une estimation explicitement marquée comme telle.
- Quand un "historique opérationnel" (biais/préférences humaines du client) est fourni, tu DOIS impérativement t'en servir pour ajuster tes alertes, ton scoring et tes recommandations.

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const apiKey =
    req.headers.get("x-user-api-key") || process.env.ANTHROPIC_API_KEY;

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
- recommandation : "À appeler en priorité" / "Backup" / "À écarter"
- synthese : 2 phrases qui justifient le score et la reco
- pointsForts : exactement 3 points forts vis-à-vis du besoin
- pointsVigilance : exactement 3 points de vigilance / risques (inclure les alertes liées à l'historique opérationnel le cas échéant)
- questionsCles : 3 à 5 questions précises à poser au candidat lors du call de qualification
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

    const response = await client.messages.create(params);

    const textBlock = response.content.find(
      (b: any) => b.type === "text",
    ) as any;

    if (!textBlock?.text) {
      return Response.json(
        { error: "Réponse IA vide. Réessayez." },
        { status: 502 },
      );
    }

    const data = extractJson(textBlock.text);
    if (data === undefined) {
      return Response.json(
        { error: "Réponse IA non exploitable." },
        { status: 502 },
      );
    }

    return Response.json({ data });
  } catch (err: any) {
    const message =
      err?.error?.error?.message ||
      err?.message ||
      "Erreur lors de l'appel à l'IA.";
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500;
    return Response.json({ error: message }, { status });
  }
}
