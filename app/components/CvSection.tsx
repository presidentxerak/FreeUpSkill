"use client";

import { useState } from "react";
import type { CvSource, CvMatching, Ranking } from "@/lib/types";
import type { MatchStatus } from "../page";
import { readFileAsBase64, readFileAsText } from "@/lib/api";
import Reveal from "./Reveal";

interface Props {
  cvs: CvSource[];
  setCvs: (c: CvSource[]) => void;
  onMatch: () => void;
  loading: boolean;
  status: Record<string, MatchStatus>;
  matchings: CvMatching[] | null;
  ranking: Ranking | null;
  error: string | null;
  onContinue: () => void;
  besoinReady: boolean;
}

function scoreOrder(s: string) {
  return s === "Fort" ? 0 : s === "Moyen" ? 1 : 2;
}

function coverage(m: CvMatching) {
  const total = m.competencesCouvertes.length + m.competencesManquantes.length;
  return total ? `${m.competencesCouvertes.length}/${total}` : "—";
}

export default function CvSection({
  cvs,
  setCvs,
  onMatch,
  loading,
  status,
  matchings,
  ranking,
  error,
  onContinue,
  besoinReady,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  function update(id: string, patch: Partial<CvSource>) {
    setCvs(cvs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function processFile(id: string, file: File) {
    if (file.type === "application/pdf") {
      const b64 = await readFileAsBase64(file);
      update(id, { pdfBase64: b64, pdfName: file.name });
    } else {
      const text = await readFileAsText(file);
      update(id, { text, pdfName: file.name, pdfBase64: undefined });
    }
  }

  function onDrop(id: string, e: React.DragEvent) {
    e.preventDefault();
    setDragId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(id, file);
  }

  const filled = cvs.filter(
    (c) => c.text.trim().length > 0 || c.pdfBase64,
  ).length;
  const canMatch = besoinReady && !loading && filled > 0;

  const sorted = matchings
    ? [...matchings].sort((a, b) => scoreOrder(a.score) - scoreOrder(b.score))
    : [];

  return (
    <div className="fade-in">
      <div className="section-head">
        <p className="eyebrow">Étape 02 — La shortlist</p>
        <h2 className="serif">Analyse & matching des CV</h2>
        <p>
          Importez la shortlist établie par le recruteur (jusqu'à 3 candidats —
          glissez-déposez les PDF). L'IA score chaque profil face au besoin,
          mesure la couverture des compétences indispensables, le situe par
          rapport à l'historique opérationnel et prépare vos questions de call.
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
        {cvs.map((cv, i) => {
          const st = status[cv.id];
          return (
            <div
              className={"cv-card" + (dragId === cv.id ? " dragover" : "")}
              key={cv.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragId(cv.id);
              }}
              onDragLeave={() => setDragId((d) => (d === cv.id ? null : d))}
              onDrop={(e) => onDrop(cv.id, e)}
            >
              <div className="cv-card-top">
                <input
                  className="editable-name"
                  value={cv.label}
                  aria-label="Nom du candidat"
                  onChange={(e) => update(cv.id, { label: e.target.value })}
                />
                {st === "running" && <span className="spinner" />}
                {st === "done" && <span className="status-ok">✓</span>}
                {st === "error" && <span className="status-err">!</span>}
              </div>
              <textarea
                value={cv.text}
                aria-label={`Texte du CV ${i + 1}`}
                onChange={(e) =>
                  update(cv.id, { text: e.target.value, pdfBase64: undefined })
                }
                placeholder={`Collez le CV ${i + 1} — ou glissez un PDF ici…`}
                rows={7}
              />
              <div className="file-row">
                <label className="file-label">
                  Importer
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processFile(cv.id, f);
                    }}
                  />
                </label>
                {cv.pdfName && <span className="file-name">— {cv.pdfName}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button className="cta" onClick={onMatch} disabled={!canMatch}>
          {loading ? "Matching en cours" : "Lancer le matching"}
        </button>
        {loading && (
          <span className="loading-note">
            <span className="spinner" /> Analyse des profils en parallèle…
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

          {/* Comparatif synthétique */}
          {sorted.length > 1 && (
            <div style={{ marginBottom: 48 }}>
              <p className="eyebrow">Comparatif</p>
              <div className="matrix-wrap">
                <table className="matrix">
                  <thead>
                    <tr>
                      <th></th>
                      {sorted.map((m, i) => (
                        <th key={i}>{m.candidat}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th>Score</th>
                      {sorted.map((m, i) => (
                        <td key={i}>
                          <span className="serif big">{m.scoreSur100}</span>
                          <span className="sub">/100 · {m.score}</span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <th>Recommandation</th>
                      {sorted.map((m, i) => (
                        <td key={i}>{m.recommandation}</td>
                      ))}
                    </tr>
                    <tr>
                      <th>Couverture</th>
                      {sorted.map((m, i) => (
                        <td key={i}>{coverage(m)} indisp.</td>
                      ))}
                    </tr>
                    <tr>
                      <th>Expérience</th>
                      {sorted.map((m, i) => (
                        <td key={i}>{m.anneesExperience}</td>
                      ))}
                    </tr>
                    <tr>
                      <th>Disponibilité</th>
                      {sorted.map((m, i) => (
                        <td key={i}>{m.disponibilite}</td>
                      ))}
                    </tr>
                    <tr>
                      <th>TJM estimé</th>
                      {sorted.map((m, i) => (
                        <td key={i}>{m.tjmEstime}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ranking && ranking.classement.length > 1 && (
            <div style={{ marginBottom: 56 }}>
              <p className="eyebrow">Classement comparatif</p>
              {ranking.synthese && (
                <p
                  className="synthese"
                  style={{ marginTop: 16, marginBottom: 4 }}
                >
                  {ranking.synthese}
                </p>
              )}
              <div style={{ marginTop: 24 }}>
                {[...ranking.classement]
                  .sort((a, b) => a.rang - b.rang)
                  .map((r) => (
                    <Reveal className="rank-row" key={r.rang + r.candidat}>
                      <div className="rank-no">{r.rang}</div>
                      <div className="rank-body">
                        <h4 className="serif">
                          {r.candidat}
                          {r.label && <span className="tag">{r.label}</span>}
                        </h4>
                        <div className="rank-detail">
                          {r.forces && (
                            <div className="dl">
                              <span className="dk">Forces</span>
                              <span>{r.forces}</span>
                            </div>
                          )}
                          {r.blocages && (
                            <div className="dl">
                              <span className="dk">Blocages</span>
                              <span>{r.blocages}</span>
                            </div>
                          )}
                          {r.action && (
                            <div className="dl">
                              <span className="dk">Action</span>
                              <span>{r.action}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  ))}
              </div>
            </div>
          )}

          <p className="eyebrow">Rapports individuels</p>
          <div style={{ marginTop: 24, display: "grid", gap: 24 }}>
            {sorted.map((m, i) => (
              <Reveal className="panel" key={i}>
                <div className="match-head">
                  <div>
                    <h3 className="serif">{m.candidat}</h3>
                    <div className="gauge">
                      <div
                        className="gauge-fill"
                        style={{ width: `${m.scoreSur100}%` }}
                      />
                      <span className="gauge-val">{m.scoreSur100}/100</span>
                    </div>
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

                {m.synthese && <p className="synthese">{m.synthese}</p>}

                {(m.competencesCouvertes.length > 0 ||
                  m.competencesManquantes.length > 0) && (
                  <div style={{ marginBottom: 28 }}>
                    <div className="kicker">
                      Couverture des compétences indispensables
                    </div>
                    <div className="coverage">
                      {m.competencesCouvertes.map((c, j) => (
                        <span key={"k" + j} className="chip cov">
                          <span className="ck">✓</span> {c}
                        </span>
                      ))}
                      {m.competencesManquantes.map((c, j) => (
                        <span key={"m" + j} className="chip miss">
                          <span className="ck">✕</span> {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

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

                {m.questionsCles.length > 0 && (
                  <div style={{ marginTop: 28 }}>
                    <div className="kicker">Questions clés pour le call</div>
                    <ul className="bullets q">
                      {m.questionsCles.map((q, j) => (
                        <li key={j}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
              </Reveal>
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
