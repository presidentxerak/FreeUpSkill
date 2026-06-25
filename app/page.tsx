"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BesoinInput,
  BesoinAnalysis,
  CvSource,
  CvMatching,
  Ranking,
  BriefOutput,
} from "@/lib/types";
import { callAI, USER_KEY_STORAGE } from "@/lib/api";
import {
  saveState,
  loadState,
  clearState,
  type Result,
} from "@/lib/storage";
import { demoBesoin, demoCvs } from "@/lib/demo";
import SettingsModal from "./components/SettingsModal";
import BesoinForm from "./components/BesoinForm";
import CvSection from "./components/CvSection";
import OutputsDashboard from "./components/OutputsDashboard";

type Tab = "besoin" | "cvs" | "outputs";
export type MatchStatus = "running" | "done" | "error";

const emptyBesoin: BesoinInput = {
  client: "",
  operationnel: "",
  intitule: "",
  fichePoste: "",
  contexte: "",
  contraintes: { tjm: "", localisation: "", demarrage: "", teletravail: "" },
  historiqueOperationnel: "",
};

const freshCvs = (): CvSource[] => [
  { id: "cv-a", label: "Candidat A", text: "" },
  { id: "cv-b", label: "Candidat B", text: "" },
  { id: "cv-c", label: "Candidat C", text: "" },
];

export default function Page() {
  const [tab, setTab] = useState<Tab>("besoin");
  const [showSettings, setShowSettings] = useState(false);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [hasUserKey, setHasUserKey] = useState(false);

  // Besoin
  const [besoin, setBesoin] = useState<BesoinInput>(emptyBesoin);
  const [fichePdf, setFichePdf] = useState<string | undefined>();
  const [ficheName, setFicheName] = useState("");
  const [analysis, setAnalysis] = useState<BesoinAnalysis | null>(null);
  const [besoinLoading, setBesoinLoading] = useState(false);
  const [besoinError, setBesoinError] = useState<string | null>(null);

  // CVs
  const [cvs, setCvs] = useState<CvSource[]>(freshCvs());
  const [results, setResults] = useState<Result[] | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchStatus, setMatchStatus] = useState<Record<string, MatchStatus>>(
    {},
  );
  const [matchError, setMatchError] = useState<string | null>(null);

  // Outputs
  const [brief, setBrief] = useState<BriefOutput | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const hydrated = useRef(false);

  // --- Hydratation depuis localStorage + détection clé serveur ---
  useEffect(() => {
    const s = loadState();
    if (s) {
      setTab((s.tab as Tab) || "besoin");
      setBesoin(s.besoin || emptyBesoin);
      setFicheName(s.ficheName || "");
      setAnalysis(s.analysis ?? null);
      setCvs(s.cvs && s.cvs.length ? s.cvs : freshCvs());
      setResults(s.results ?? null);
      setRanking(s.ranking ?? null);
      setBrief(s.brief ?? null);
    }
    hydrated.current = true;

    fetch("/api/ai")
      .then((r) => r.json())
      .then((j) => setHasServerKey(Boolean(j?.hasServerKey)))
      .catch(() => {});
    setHasUserKey(
      Boolean(
        typeof window !== "undefined" &&
          window.localStorage.getItem(USER_KEY_STORAGE),
      ),
    );
  }, []);

  // --- Sauvegarde automatique ---
  useEffect(() => {
    if (!hydrated.current) return;
    saveState({
      tab,
      besoin,
      ficheName,
      analysis,
      cvs,
      results,
      ranking,
      brief,
    });
  }, [tab, besoin, ficheName, analysis, cvs, results, ranking, brief]);

  function refreshKey() {
    setHasUserKey(Boolean(window.localStorage.getItem(USER_KEY_STORAGE)));
  }

  const keyReady = hasServerKey || hasUserKey;

  // --- Étape 1 ---
  async function analyzeBesoin() {
    setBesoinLoading(true);
    setBesoinError(null);
    try {
      const data = await callAI<BesoinAnalysis>("analyze_besoin", {
        besoin,
        fichePdfBase64: fichePdf,
      });
      setAnalysis(data);
    } catch (e: any) {
      setBesoinError(e.message);
    } finally {
      setBesoinLoading(false);
    }
  }

  // --- Étape 2 : matching en parallèle ---
  async function runMatching() {
    const filled = cvs.filter((c) => c.text.trim().length > 0 || c.pdfBase64);
    if (filled.length === 0) return;

    setMatchLoading(true);
    setMatchError(null);
    setResults(null);
    setRanking(null);
    setBrief(null);

    const initStatus: Record<string, MatchStatus> = {};
    filled.forEach((c) => (initStatus[c.id] = "running"));
    setMatchStatus(initStatus);

    const settled = await Promise.all(
      filled.map(async (cv): Promise<Result | null> => {
        try {
          const matching = await callAI<CvMatching>("match_cv", {
            besoin,
            cvLabel: cv.label,
            cvText: cv.text,
            cvPdfBase64: cv.pdfBase64,
          });
          setMatchStatus((s) => ({ ...s, [cv.id]: "done" }));
          return { cvId: cv.id, matching };
        } catch {
          setMatchStatus((s) => ({ ...s, [cv.id]: "error" }));
          return null;
        }
      }),
    );

    const res = settled.filter((r): r is Result => r !== null);

    if (res.length === 0) {
      setMatchError(
        "Aucun CV n'a pu être analysé. Vérifiez votre clé API et réessayez.",
      );
      setMatchLoading(false);
      return;
    }

    setResults(res);

    if (res.length > 1) {
      try {
        const rank = await callAI<Ranking>("rank_candidates", {
          besoin,
          matchings: res.map((r) => r.matching),
        });
        setRanking(rank);
      } catch {
        /* le ranking est un plus : on n'échoue pas le matching pour autant */
      }
    }

    if (res.length < filled.length) {
      setMatchError(
        `${filled.length - res.length} CV n'a pas pu être analysé. Les autres résultats sont disponibles.`,
      );
    }
    setMatchLoading(false);
  }

  // --- Meilleur candidat ---
  function bestResult(): Result | null {
    if (!results || results.length === 0) return null;
    if (ranking && ranking.classement.length) {
      const top = [...ranking.classement].sort((a, b) => a.rang - b.rang)[0];
      if (top) {
        const found = results.find(
          (r) =>
            r.matching.candidat.toLowerCase().trim() ===
              top.candidat.toLowerCase().trim() ||
            top.candidat
              .toLowerCase()
              .includes(r.matching.candidat.toLowerCase().trim()),
        );
        if (found) return found;
      }
    }
    return [...results].sort(
      (a, b) => b.matching.scoreSur100 - a.matching.scoreSur100,
    )[0];
  }

  // --- Étape 3 ---
  async function generateBrief() {
    const best = bestResult();
    if (!best) return;
    const cv = cvs.find((c) => c.id === best.cvId);
    setBriefLoading(true);
    setBriefError(null);
    try {
      const data = await callAI<BriefOutput>("generate_brief", {
        besoin,
        matching: best.matching,
        cvText: cv?.text,
        cvPdfBase64: cv?.pdfBase64,
      });
      setBrief(data);
    } catch (e: any) {
      setBriefError(e.message);
    } finally {
      setBriefLoading(false);
    }
  }

  // --- Démo & reset ---
  function loadDemo() {
    setBesoin(JSON.parse(JSON.stringify(demoBesoin)));
    setFichePdf(undefined);
    setFicheName("");
    setAnalysis(null);
    setCvs(
      freshCvs().map((c, i) => ({
        ...c,
        label: demoCvs[i]?.label ?? c.label,
        text: demoCvs[i]?.text ?? "",
        pdfBase64: undefined,
        pdfName: undefined,
      })),
    );
    setResults(null);
    setRanking(null);
    setBrief(null);
    setBesoinError(null);
    setMatchError(null);
    setBriefError(null);
    setTab("besoin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAll() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Tout effacer et repartir d'une page vierge ?")
    )
      return;
    clearState();
    setBesoin(emptyBesoin);
    setFichePdf(undefined);
    setFicheName("");
    setAnalysis(null);
    setCvs(freshCvs());
    setResults(null);
    setRanking(null);
    setBrief(null);
    setMatchStatus({});
    setBesoinError(null);
    setMatchError(null);
    setBriefError(null);
    setTab("besoin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goTab(t: Tab) {
    setTab(t);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const best = bestResult();
  const stepDone = {
    besoin: Boolean(analysis),
    cvs: Boolean(results && results.length),
    outputs: Boolean(brief),
  };

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="wordmark">
            Skills<span className="reg">®</span>
          </div>
          <span className="masthead-tag">
            Assistant de qualification IA · TDU
          </span>
          <button className="icon-btn" onClick={() => setShowSettings(true)}>
            <span className={"key-dot" + (keyReady ? " on" : "")} />
            Réglages
          </button>
        </div>
      </header>

      <main className="shell">
        <section className="hero">
          <p className="eyebrow" style={{ marginBottom: 22 }}>
            Tech Recruiting · Édition IA
          </p>
          <h1 className="serif">
            Qualifier vite,
            <br />
            <em>décider juste.</em>
          </h1>
          <p className="hero-sub">
            Un assistant métier qui transforme un besoin client et une shortlist
            de CV en décisions de priorisation — en quelques secondes, pas en
            une demi-journée.
          </p>
          <div className="hero-actions">
            <button className="cta sm" onClick={loadDemo}>
              Charger l'exemple TDU
            </button>
            <button className="link-btn" onClick={resetAll}>
              Réinitialiser
            </button>
          </div>
        </section>

        <nav className="tabs">
          {(
            [
              ["besoin", "i.", "Besoin"],
              ["cvs", "ii.", "CV & Matching"],
              ["outputs", "iii.", "Livrables"],
            ] as [Tab, string, string][]
          ).map(([id, num, lab]) => (
            <button
              key={id}
              className={"tab" + (tab === id ? " active" : "")}
              onClick={() => goTab(id)}
            >
              <span className="num">{num}</span>
              <span className="lab">{lab}</span>
              {stepDone[id] && <span className="tab-check">✓</span>}
            </button>
          ))}
        </nav>

        {!keyReady && (
          <div className="alert" style={{ marginTop: 0, marginBottom: 40 }}>
            <span className="x">!</span>
            <span>
              Aucune clé API détectée. Ouvrez{" "}
              <button
                className="link-btn"
                onClick={() => setShowSettings(true)}
              >
                Réglages
              </button>{" "}
              pour en renseigner une et activer l'assistant.
            </span>
          </div>
        )}

        {tab === "besoin" && (
          <BesoinForm
            besoin={besoin}
            setBesoin={setBesoin}
            ficheName={ficheName}
            onFichePdf={(b64, name) => {
              setFichePdf(b64);
              setFicheName(name);
            }}
            onAnalyze={analyzeBesoin}
            loading={besoinLoading}
            error={besoinError}
            analysis={analysis}
            onContinue={() => goTab("cvs")}
          />
        )}

        {tab === "cvs" && (
          <CvSection
            cvs={cvs}
            setCvs={setCvs}
            onMatch={runMatching}
            loading={matchLoading}
            status={matchStatus}
            matchings={results ? results.map((r) => r.matching) : null}
            ranking={ranking}
            error={matchError}
            onContinue={() => goTab("outputs")}
            besoinReady={Boolean(analysis)}
          />
        )}

        {tab === "outputs" && (
          <OutputsDashboard
            brief={brief}
            onGenerate={generateBrief}
            loading={briefLoading}
            error={briefError}
            ready={Boolean(results && results.length > 0)}
            bestName={best ? best.matching.candidat : null}
          />
        )}

        <footer className="foot">
          <span>Skills® — Hackathon TDU</span>
          <span>Propulsé par Claude · Opus 4.8</span>
        </footer>
      </main>

      {showSettings && (
        <SettingsModal
          hasServerKey={hasServerKey}
          onClose={() => setShowSettings(false)}
          onSaved={refreshKey}
        />
      )}
    </>
  );
}
