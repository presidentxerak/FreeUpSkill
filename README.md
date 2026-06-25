# Skills® — Assistant de qualification IA

Mini-assistant IA métier pour les **Tech Recruiters TDU**. Il transforme un besoin
client et une shortlist de CV en décisions de priorisation — en quelques secondes.

Design éditorial noir & blanc (style _Vogue_), titres **Playfair Display**, textes
**Outfit**, interactions élégantes sur les CTA noirs.

## Le scénario (3 étapes)

1. **Besoin** — formulaire complet (client, opérationnel, intitulé, fiche de poste,
   contexte, contraintes TJM/localisation/démarrage/télétravail) →
   _« Analyser le besoin »_. L'IA renvoie : résumé en 5 lignes, compétences
   indispensables / secondaires, points de vigilance, type de profil recherché.
2. **CV & Matching** — import de jusqu'à 3 CV (texte ou **PDF**) →
   _« Lancer le matching »_. Pour chaque profil : score (Fort / Moyen / Faible),
   recommandation (À appeler en priorité / Backup / À écarter), 3 points forts,
   3 points de vigilance, questions clés pour le call. Puis un **classement
   comparatif** des candidats.
3. **Livrables** — à partir du meilleur candidat : **Brief Client (format TDU)** +
   **Pitch Mission** personnalisé pour le candidat (copiables en un clic).

### ⭐ Feature différenciante — Historique opérationnel

Une zone de texte libre permet de saisir les **biais / préférences humaines** de
l'opérationnel client (ex. _« veut du hands-on, challenge souvent sur Kafka »_).
L'IA **utilise obligatoirement** cette mémoire pour ajuster ses alertes, son
scoring et son ranking sur l'ensemble du parcours.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Claude Opus 4.8** via `@anthropic-ai/sdk` (sorties structurées + lecture
  directe des PDF en blocs document)
- CSS éditorial fait main — zéro framework UI

L'appel à Claude passe par une **route serveur** (`/api/ai`) : la clé reste
côté serveur. Pour la démo, on peut aussi coller une clé dans l'UI (stockée dans
le `localStorage`, relayée uniquement au backend de l'app).

## Démarrer

```bash
npm install

# Option A — clé côté serveur (recommandé)
cp .env.example .env.local   # puis renseigner ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000

# Option B — sans .env : lancez l'app et collez la clé via le bouton « Réglages »
```

Build de production :

```bash
npm run build && npm run start
```

## Déploiement

Compatible Vercel sans configuration : importez le repo, ajoutez la variable
d'environnement `ANTHROPIC_API_KEY`, déployez.

## Données de test

Utilisez le data pack TDU (fiches de poste + CV anonymisés Kafka / Data Architect /
PO E-Commerce) — collez le texte ou importez les PDF directement.
