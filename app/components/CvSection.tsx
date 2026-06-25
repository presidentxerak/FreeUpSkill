"use client";

import type { CvSource, CvMatching, Ranking } from "@/lib/types";
import { readFileAsBase64, readFileAsText } from "@/lib/api";

interface Props {
  cvs: CvSource[];
  setCvs: (c: CvSource[]) => void;
  onMatch: () => void;
  loading: boolean;
  progress: string;
  matchings: CvMatching[] | null;
  ranking: Ranking | null;
  error: string | null;
  onContinue: () => void;
  besoinReady: boolean;
}

function scoreOrder(s: string) {
  return s === "Fort" ? 0 : s === "Moyen" ? 1 : 2;
}

export default function CvSection({
  cvs,
  setCvs,
  onMatch,
  loading,
  progress,
  matchings,
  ranking,
  error,
  onContinue,
  besoinReady,
}: Props) {
  function update(id: string, patch: Partial<CvSource>) {
    setCvs(cvs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function handleFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === "application/pdf") {
      const b64 = await readFileAsBase64(file);
      update(id, { pdfBase64: b64, pdfName: file.name });
    } else {
      const text = await readFileAsText(file);
      update(id, { text, pdfName: file.name, pdfBase64: undefined });
    }
  }

  const filled = cvs.filter(
    (c) => c.text.trim().length > 0 || c.pdfBase64,
  ).length;
  const canMatch = besoinReady && !loading && filled > 0;

  return (
    <div className="fade-in">
      <div className="section-head">
        <p className="eyebrow">Étape 02 — La shortlist</p>
        <h2 className="serif">Analyse & matching des CV</h2>
        <p>
          Importez la shortlist établie par le recruteur (jusqu'à 3 candidats).
          L'IA score chaque profil face au besoin, le situe par rapport à
          l'historique opérationnel, et prépare vos questions de call.
        </p>
      </div>

      {!besoinReady && (
        <div className="alert">
          <span className="x">!</span>
          <span>
            Analysez d'abord un besoin (étape 01) pour pouvoir lancer le
            matching.
          </span>
        </div>
      )}

      <div className="cv-stack">
        {cvs.map((cv, i) => (
          <div className="cv-card" key={cv.id}>
            <input
              className="editable-name"
              value={cv.label}
              onChange={(e) => update(cv.id, { label: e.target.value })}
            />
            <textarea
              value={cv.text}
              onChange={(e) =>
                update(cv.id, { text: e.target.value, pdfBase64: undefined })
              }
              placeholder={`Collez le CV ${i + 1}…`}
              rows={7}
            />
            <div className="file-row">
              <label className="file-label">
                Importer
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  hidden
                  onChange={(e) => handleFile(cv.id, e)}
                />
              </label>
              {cv.pdfName && (
                <span className="file-name">— {cv.pdfName}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="cta" onClick={onMatch} disabled={!canMatch}>
          {loading ? "Matching en cours" : "Lancer le matching"}
        </button>
        {loading && (
          <span className="loading-note">
            <span className="spinner" /> {progress || "Analyse des profils…"}
          </span>
        )}
      </div>

      {error && (
        <div className="alert">
          <span className="x">!</span>
          <span>{error}</span>
        </div>
      )}

      {matchings && matchings.length > 0 && (
        <div className="result" style={{ marginTop: 56 }}>
          <hr className="rule" />

          {ranking && (
            <div style={{ marginBottom: 56 }}>
              <p className="eyebrow">Classement comparatif</p>
              <p
                className="synthese"
                style={{ marginTop: 16, marginBottom: 4 }}
              >
                {ranking.synthese}
              </p>
              <div style={{ marginTop: 24 }}>
                {[...ranking.classement]
                  .sort((a, b) => a.rang - b.rang)
                  .map((r) => (
                    <div className="rank-row" key={r.rang + r.candidat}>
                      <div className="rank-no">{r.rang}</div>
                      <div className="rank-body">
                        <h4 className="serif">
                          {r.candidat}
                          <span className="tag">{r.label}</span>
                        </h4>
                        <div className="rank-detail">
                          <div className="dl">
                            <span className="dk">Forces</span>
                            <span>{r.forces}</span>
                          </div>
                          <div className="dl">
                            <span className="dk">Blocages</span>
                            <span>{r.blocages}</span>
                          </div>
                          <div className="dl">
                            <span className="dk">Action</span>
                            <span>{r.action}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <p className="eyebrow">Rapports individuels</p>
          <div style={{ marginTop: 24, display: "grid", gap: 24 }}>
            {[...matchings]
              .sort((a, b) => scoreOrder(a.score) - scoreOrder(b.score))
              .map((m, i) => (
                <div className="panel" key={i}>
                  <div className="match-head">
                    <div>
                      <h3 className="serif">{m.candidat}</h3>
                    </div>
                    <div className="score-badge">
                      <div className="score">{m.score}</div>
                      <span
                        className={
                          "reco " +
                          (m.recommandation === "À appeler en priorité"
                            ? "prio"
                            : m.recommandation === "À écarter"
                              ? "ecarter"
                              : "")
                        }
                      >
                        {m.recommandation}
                      </span>
                    </div>
                  </div>

                  <p className="synthese">{m.synthese}</p>

                  <div className="two-col">
                    <div>
                      <div className="kicker">Points forts</div>
                      <ul className="bullets">
                        {m.pointsForts.map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="kicker">Points de vigilance</div>
                      <ul className="bullets vig">
                        {m.pointsVigilance.map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div style={{ marginTop: 28 }}>
                    <div className="kicker">Questions clés pour le call</div>
                    <ul className="bullets q">
                      {m.questionsCles.map((q, j) => (
                        <li key={j}>{q}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="meta-row">
                    <div className="meta-item">
                      <div className="k">Expérience</div>
                      <div className="v">{m.anneesExperience}</div>
                    </div>
                    <div className="meta-item">
                      <div className="k">Disponibilité</div>
                      <div className="v">{m.disponibilite}</div>
                    </div>
                    <div className="meta-item">
                      <div className="k">TJM estimé</div>
                      <div className="v">{m.tjmEstime}</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          <div className="actions">
            <button className="cta ghost" onClick={onContinue}>
              Générer le brief & le pitch →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
