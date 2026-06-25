---
name: qualification-recrutement
description: >-
  Assistant IA métier pour Tech Recruiters (TDU). À utiliser dès qu'il faut
  qualifier un besoin client tech, analyser/scorer une shortlist de CV face à ce
  besoin, classer des candidats, ou générer un brief client et un pitch mission.
  Déclencheurs typiques : "qualifie ce besoin", "matche ces CV", "lequel appeler
  en priorité", "fais-moi le brief client / le pitch candidat". Prend en compte
  l'historique opérationnel (biais/préférences humaines du client) pour ajuster
  scoring et alertes.
---

# Qualification de recrutement (Skills®)

Skill métier qui reproduit entièrement l'assistant **Skills** : transformer un
**besoin client** et une **shortlist de CV** en décisions de priorisation, puis
en livrables prêts à envoyer. Conçu pour les Tech Recruiters (cabinet/ESN, marché
français).

Quatre opérations, enchaînables :

1. `analyze_besoin` — qualifier un besoin (résumé, compétences, vigilance, profil)
2. `match_cv` — scorer un CV face au besoin (score, reco, couverture, questions)
3. `rank_candidates` — classer plusieurs candidats déjà matchés
4. `generate_brief` — produire le Brief Client (format TDU) + le Pitch Mission

---

## Modèle & format d'appel

- **Modèle recommandé** : `claude-opus-4-8` (Frenz peut choisir le sien).
- **Sorties structurées OBLIGATOIRES** : passe le `schema` JSON de l'opération via
  `output_config: { format: { type: "json_schema", schema } }`. La réponse est un
  objet JSON unique conforme au schéma.
- **Filet de sécurité** (si le modèle dévie) : le system prompt impose déjà du JSON
  pur ; côté hôte, parse en tolérant (retirer d'éventuelles balises ``` ``` ```,
  extraire du premier `{` au dernier `}`) puis **normalise défensivement** chaque
  champ (tableaux → tableaux de strings, enums validés, défauts) pour que l'UI ne
  casse jamais.
- **PDF** : un CV ou une fiche de poste peuvent être fournis en bloc
  `document` base64 (`media_type: "application/pdf"`) **avant** le bloc texte —
  inutile d'extraire le texte au préalable.
- `max_tokens`: 4096 suffit pour chaque opération.

---

## System prompt (commun aux 4 opérations)

```
Tu es un assistant IA expert au service des Tech Recruiters de TDU Consulting (ESN / cabinet de recrutement tech français).
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

FORMAT DE SORTIE : tu réponds UNIQUEMENT par un objet JSON valide, sans aucun texte autour, sans commentaire et sans balise markdown (pas de ```). Respecte exactement les clés demandées dans la consigne.
```

---

## Bloc de contexte « BESOIN » (réutilisé dans 3 opérations)

Construire ce bloc texte à partir des champs du besoin, puis le coller dans le
message utilisateur de `analyze_besoin`, `match_cv`, `rank_candidates`,
`generate_brief` :

```
# BESOIN CLIENT
Client : {client | "Non précisé"}
Opérationnel (manager côté client) : {operationnel | "Non précisé"}
Intitulé du poste : {intitule | "Non précisé"}

## Fiche de poste
{fichePoste | "(voir document PDF joint)"}

## Contexte / qualification
{contexte | "Non précisé"}

## Contraintes
- TJM : {tjm | "Non précisé"}
- Localisation : {localisation | "Non précisé"}
- Démarrage : {demarrage | "Non précisé"}
- Télétravail : {teletravail | "Non précisé"}

## Historique opérationnel (biais / préférences humaines du client)
{historiqueOperationnel | "Aucun élément fourni."}
```

---

## Opération 1 — `analyze_besoin`

**Entrées** : champs du besoin (+ PDF fiche de poste optionnel).
**Message utilisateur** :

```
Analyse le besoin ci-dessous et produis une qualification métier.

{BLOC BESOIN}

Produis :
- resume : le besoin résumé en ~5 lignes courtes et percutantes (1 idée par ligne)
- competencesIndispensables : les must-have techniques et fonctionnels
- competencesSecondaires : les nice-to-have
- pointsVigilance : risques de sourcing, incohérences, exigences difficiles à trouver sur le marché FR (et tout point soulevé par l'historique opérationnel)
- typeProfil : le portrait-robot du profil idéal (séniorité, posture, type de parcours)
```

**Schéma de sortie** :

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "resume": { "type": "array", "items": { "type": "string" } },
    "competencesIndispensables": { "type": "array", "items": { "type": "string" } },
    "competencesSecondaires": { "type": "array", "items": { "type": "string" } },
    "pointsVigilance": { "type": "array", "items": { "type": "string" } },
    "typeProfil": { "type": "string" }
  },
  "required": ["resume", "competencesIndispensables", "competencesSecondaires", "pointsVigilance", "typeProfil"]
}
```

---

## Opération 2 — `match_cv`

**Entrées** : besoin + un CV (texte ou PDF) + un libellé candidat (`cvLabel`).
**Message utilisateur** :

```
Analyse ce CV au regard du besoin, en tenant compte de l'historique opérationnel.

{BLOC BESOIN}

# CV À ANALYSER — {cvLabel}
{cvText | "(voir document PDF joint)"}

Produis un matching métier :
- candidat : prénom du candidat si présent dans le CV, sinon "{cvLabel}"
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
- tjmEstime : fourchette TJM marché FR cohérente avec le profil, marquée comme estimation
```

**Schéma de sortie** :

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "candidat": { "type": "string" },
    "score": { "type": "string", "enum": ["Fort", "Moyen", "Faible"] },
    "scoreSur100": { "type": "integer" },
    "recommandation": { "type": "string", "enum": ["À appeler en priorité", "Backup", "À écarter"] },
    "synthese": { "type": "string" },
    "pointsForts": { "type": "array", "items": { "type": "string" } },
    "pointsVigilance": { "type": "array", "items": { "type": "string" } },
    "questionsCles": { "type": "array", "items": { "type": "string" } },
    "competencesCouvertes": { "type": "array", "items": { "type": "string" } },
    "competencesManquantes": { "type": "array", "items": { "type": "string" } },
    "anneesExperience": { "type": "string" },
    "disponibilite": { "type": "string" },
    "tjmEstime": { "type": "string" }
  },
  "required": ["candidat", "score", "scoreSur100", "recommandation", "synthese", "pointsForts", "pointsVigilance", "questionsCles", "competencesCouvertes", "competencesManquantes", "anneesExperience", "disponibilite", "tjmEstime"]
}
```

> Pour une shortlist : appeler `match_cv` une fois par CV (en parallèle, c'est plus rapide).

---

## Opération 3 — `rank_candidates`

**Entrées** : besoin + tableau des objets `match_cv` déjà obtenus (`matchings`).
**Message utilisateur** :

```
Voici le besoin et l'analyse de plusieurs candidats déjà matchés. Établis un classement comparatif clair pour aider le recruteur à prioriser ses appels. Tiens compte de l'historique opérationnel.

{BLOC BESOIN}

# CANDIDATS ANALYSÉS
{JSON des matchings}

Produis :
- classement : un tableau ordonné (rang 1 = meilleur fit global). Pour chaque candidat : candidat, rang, label court (ex. "Meilleur fit global", "Bon backup", "Moins prioritaire"), forces (1 phrase), blocages (1 phrase), action recommandée (1 phrase).
- synthese : 2-3 phrases de recommandation globale pour le recruteur.
```

**Schéma de sortie** :

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "classement": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "candidat": { "type": "string" },
          "rang": { "type": "integer" },
          "label": { "type": "string" },
          "forces": { "type": "string" },
          "blocages": { "type": "string" },
          "action": { "type": "string" }
        },
        "required": ["candidat", "rang", "label", "forces", "blocages", "action"]
      }
    },
    "synthese": { "type": "string" }
  },
  "required": ["classement", "synthese"]
}
```

---

## Opération 4 — `generate_brief`

**Entrées** : besoin + l'objet `match_cv` du meilleur candidat + son CV (texte/PDF).
**Message utilisateur** :

```
À partir du meilleur candidat, génère le Brief Client (format TDU) et le Pitch Mission pour le recruteur.

{BLOC BESOIN}

# MEILLEUR CANDIDAT — analyse
{JSON du matching}

# CV DU MEILLEUR CANDIDAT
{cvText | "(voir document PDF joint)"}

Produis :
- briefClient : profil synthétique vendeur mais honnête à envoyer au client.
    - prenom, accroche (1 phrase qui donne envie de rencontrer le candidat), resumeExperiences (3-4 phrases sur les expériences pertinentes), pointsForts, pointsVigilance, anneesExperience, competencesCles, disponibilite, tjm.
- pitchMission : un texte d'accroche personnalisé que le recruteur enverra/dira AU CANDIDAT pour lui vendre la mission. Inclure : contexte client, intérêt de la mission, stack technique, modalités (TJM/lieu/télétravail/démarrage), pourquoi son profil matche, et les points à valider avec lui. Ton chaleureux et professionnel.
```

**Schéma de sortie** :

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "briefClient": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "prenom": { "type": "string" },
        "accroche": { "type": "string" },
        "resumeExperiences": { "type": "string" },
        "pointsForts": { "type": "array", "items": { "type": "string" } },
        "pointsVigilance": { "type": "array", "items": { "type": "string" } },
        "anneesExperience": { "type": "string" },
        "competencesCles": { "type": "array", "items": { "type": "string" } },
        "disponibilite": { "type": "string" },
        "tjm": { "type": "string" }
      },
      "required": ["prenom", "accroche", "resumeExperiences", "pointsForts", "pointsVigilance", "anneesExperience", "competencesCles", "disponibilite", "tjm"]
    },
    "pitchMission": { "type": "string" }
  },
  "required": ["briefClient", "pitchMission"]
}
```

---

## Câblage dans Frenz

Selon la nature de Frenz, deux modes (le présent SKILL.md couvre les deux) :

### Mode A — Frenz est un agent basé sur Claude (charge les SKILL.md)
Dépose ce fichier dans le dossier de skills de Frenz. Quand un utilisateur
demande de qualifier un besoin ou d'analyser des CV, l'agent suit ce skill :
il construit le **bloc BESOIN**, appelle l'API Messages avec le **system prompt**,
le **message utilisateur** de l'opération voulue et le **schéma** correspondant en
`output_config.format`, puis exploite le JSON renvoyé. Enchaîne 1→2→3→4 pour le
flux complet.

### Mode B — Frenz appelle un backend
Réutilise tel quel l'endpoint de l'app Skills (`POST /api/ai`, body
`{ task, payload }`, avec `task` ∈ `analyze_besoin | match_cv | rank_candidates |
generate_brief | ping`). Le code de référence est dans
`app/api/ai/route.ts` du repo Skills : il contient les prompts, les schémas, le
parsing tolérant, la **normalisation défensive** et le retry 429/5xx. Tu peux
copier ce fichier (et `lib/types.ts`) dans Frenz, ou pointer Frenz vers l'URL
déployée de Skills.

### Règles d'intégration à respecter
- **Historique opérationnel** : toujours transmettre ce champ s'il existe — c'est
  le différenciateur ; l'IA doit l'utiliser pour le scoring/ranking et le citer.
- **Ne jamais tronquer** un CV/une fiche : si trop long, passer en bloc PDF ou
  découper, mais ne pas couper silencieusement.
- **Normaliser** la sortie côté hôte (défauts, enums, tableaux) avant affichage.
- **Clé API** : l'API Anthropic se facture séparément des abonnements Claude ;
  prévoir une `ANTHROPIC_API_KEY` côté serveur de Frenz.

---

## Types (TypeScript, pour Frenz)

Voir `lib/types.ts` du repo Skills pour les interfaces exactes
(`BesoinInput`, `BesoinAnalysis`, `CvMatching`, `Ranking`, `BriefOutput`) —
elles correspondent 1:1 aux schémas ci-dessus.
