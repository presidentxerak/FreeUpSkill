// Domain types shared between the UI and the API route.

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
  historiqueOperationnel: string; // bonus : biais / préférences humaines
}

export interface BesoinAnalysis {
  resume: string[]; // ~5 lignes
  competencesIndispensables: string[];
  competencesSecondaires: string[];
  pointsVigilance: string[];
  typeProfil: string;
}

export type ScoreMatching = "Fort" | "Moyen" | "Faible";
export type Recommandation =
  | "À appeler en priorité"
  | "Backup"
  | "À écarter";

export interface CvMatching {
  candidat: string; // prénom ou identifiant
  score: ScoreMatching;
  recommandation: Recommandation;
  synthese: string;
  pointsForts: string[]; // 3
  pointsVigilance: string[]; // 3
  questionsCles: string[];
  anneesExperience: string;
  disponibilite: string;
  tjmEstime: string;
}

export interface RankingEntry {
  candidat: string;
  rang: number; // 1 = meilleur
  label: string; // ex. "Meilleur fit global"
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

// Représentation d'un CV côté UI (texte collé ou fichier PDF).
export interface CvSource {
  id: string;
  label: string;
  text: string;
  pdfBase64?: string;
  pdfName?: string;
}
