import type {
  BesoinInput,
  BesoinAnalysis,
  CvSource,
  CvMatching,
  Ranking,
  BriefOutput,
} from "./types";

const KEY = "skills_state_v1";

export interface Result {
  cvId: string;
  matching: CvMatching;
}

export interface PersistedState {
  tab: string;
  besoin: BesoinInput;
  ficheName: string;
  analysis: BesoinAnalysis | null;
  cvs: CvSource[];
  results: Result[] | null;
  ranking: Ranking | null;
  brief: BriefOutput | null;
}

export function saveState(s: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    // On ne persiste pas les PDF base64 (volumineux, quota localStorage).
    const lean: PersistedState = {
      ...s,
      cvs: s.cvs.map(({ pdfBase64, ...rest }) => rest),
    };
    window.localStorage.setItem(KEY, JSON.stringify(lean));
  } catch {
    /* quota / mode privé : on ignore silencieusement */
  }
}

export function loadState(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export function clearState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
