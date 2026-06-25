"use client";

import { useEffect, useState } from "react";
import type {
  BesoinInput,
  BesoinAnalysis,
  CvSource,
  CvMatching,
  Ranking,
  BriefOutput,
} from "@/lib/types";
import { callAI, USER_KEY_STORAGE } from "@/lib/api";
import SettingsModal from "./components/SettingsModal";
import BesoinForm from "./components/BesoinForm";
import CvSection from "./components/CvSection";
import OutputsDashboard from "./components/OutputsDashboard";

type Tab = "besoin" | "cvs" | "outputs";

const emptyBesoin: BesoinInput = {
  client: "",
  operationnel: "",
  intitule: "",
  fichePoste: "",
  contexte: "",
  contraintes: { tjm: "", localisation: "", demarrage: "", teletravail: "" },
  historiqueOperationnel: "",
};

const initialCvs: CvSource[] = [
  { id: "cv-a", label: "Candidat A", text: "" },
  { id: "cv-b", label: "Candidat B", text: "" },
  { id: "cv-c", label: "Candidat C", text: "" },
];

interface Result {
  cvId: string;
  matching: CvMatching;
}

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
  const [cvs, setCvs] = useState<CvSource[]>(initialCvs);
  const [results, setResults] = useState<Result[] | null>(null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchProgress, setMatchProgress] = useState("");
  const [matchError, setMatchError] = useState<string | null>(null);

  // Outputs
  const [brief, setBrief] = useState<BriefOutput | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  useEffect(() => {
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

  function refreshKey() {
    setHasUserKey(
      Boolean(window.localStorage.getItem(USER_KEY_STORAGE)),
    );
  }

  const keyReady = hasServerKey || hasUserKey;

  function besoinPayload() {
    return { besoin, fichePdfBase64: fichePdf };
  }

  // ---- Étape 1 ----
  async function analyzeBesoin() {
    setBesoinLoading(true);
    setBesoinError(null);
    try {
      const data = await callAI<BesoinAnalysis>(
        "analyze_besoin",
        besoinPayload(),
      );
      setAnalysis(data);
    } catch (e: any) {
      setBesoinError(e.message);
    } finally {
      setBesoinLoading(false);
    }
  }

  // ---- Étape 2 ----
  async function runMatching() {
    const filled = cvs.filter((c) => c.text.trim().length > 0 || c.pdfBase64);
    setMatchLoading(true);
    setMatchError(null);
    setResults(null);
    setRanking(null);
    setBrief(null);
    try {
      const res: Result[] = [];
      for (let i = 0; i < filled.length; i++) {
        const cv = filled[i];
        setMatchProgress(`Analyse ${i + 1}/${filled.length} — ${cv.label}`);
        const matching = await callAI<CvMatching>("match_cv", {
          besoin,
          cvLabel: cv.label,
          cvText: cv.text,
          cvPdfBase64: cv.pdfBase64,
        });
        res.push({ cvId: cv.id, matching });
      }
      setResults(res);

      if (res.length > 1) {
        setMatchProgress("Classement comparatif…");
        const rank = await callAI<Ranking>("rank_candidates", {
          besoin,
          matchings: res.map((r) => r.matching),
        });
        setRanking(rank);
      }
    } catch (e: any) {
      setMatchError(e.message);
    } finally {
      setMatchLoading(false);
      setMatchProgress("");
    }
  }

  // ---- Best candidate ----
  function bestResult(): Result | null {
    if (!results || results.length === 0) return null;
    if (ranking) {
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
    const order = (s: string) => (s === "Fort" ? 0 : s === "Moyen" ? 1 : 2);
    return [...results].sort(
      (a, b) => order(a.matching.score) - order(b.matching.score),
    )[0];
  }

  // ---- Étape 3 ----
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

  function goTab(t: Tab) {
    setTab(t);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const best = bestResult();

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
          <div className="hero-meta">
            <span>01 — Besoin</span>
            <span>02 — Matching CV</span>
            <span>03 — Brief & Pitch</span>
          </div>
        </section>

        <nav className="tabs">
          <button
            className={"tab" + (tab === "besoin" ? " active" : "")}
            onClick={() => goTab("besoin")}
          >
            <span className="num">i.</span>
            <span className="lab">Besoin</span>
          </button>
          <button
            className={"tab" + (tab === "cvs" ? " active" : "")}
            onClick={() => goTab("cvs")}
          >
            <span className="num">ii.</span>
            <span className="lab">CV & Matching</span>
          </button>
          <button
            className={"tab" + (tab === "outputs" ? " active" : "")}
            onClick={() => goTab("outputs")}
          >
            <span className="num">iii.</span>
            <span className="lab">Livrables</span>
          </button>
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
            progress={matchProgress}
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
