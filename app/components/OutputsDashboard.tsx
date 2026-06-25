"use client";

import { useEffect, useState } from "react";
import type { BriefOutput } from "@/lib/types";

interface Props {
  brief: BriefOutput | null;
  onGenerate: () => void;
  loading: boolean;
  error: string | null;
  ready: boolean;
  bestName: string | null;
}

export default function OutputsDashboard({
  brief,
  onGenerate,
  loading,
  error,
  ready,
  bestName,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");

  // Le pitch est personnalisable par le recruteur avant envoi.
  useEffect(() => {
    if (brief) setPitch(brief.pitchMission);
  }, [brief]);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <div className="fade-in">
      <div className="section-head">
        <p className="eyebrow">Étape 03 — Livrables</p>
        <h2 className="serif">Brief client & pitch mission</h2>
        <p>
          À partir du meilleur candidat, l'IA génère le Brief Client au format
          TDU et le Pitch Mission personnalisé à dérouler avec le candidat.
        </p>
      </div>

      {!ready ? (
        <div className="empty">
          <div className="serif">Aucune analyse disponible</div>
          <p>
            Lancez d'abord le matching des CV (étape 02). Les livrables se
            génèrent à partir du candidat le mieux classé.
          </p>
        </div>
      ) : (
        <>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="cta" onClick={onGenerate} disabled={loading}>
              {loading
                ? "Génération en cours"
                : brief
                  ? "Régénérer les livrables"
                  : `Générer les livrables${bestName ? ` — ${bestName}` : ""}`}
            </button>
            {loading && (
              <span className="loading-note">
                <span className="spinner" /> Rédaction du brief & du pitch…
              </span>
            )}
          </div>

          {error && (
            <div className="alert">
              <span className="x">!</span>
              <span>{error}</span>
            </div>
          )}
        </>
      )}

      {brief && (
        <div className="result print-area" style={{ marginTop: 48 }}>
          <div className="doc-toolbar no-print">
            <button className="link-btn" onClick={() => window.print()}>
              Imprimer / Exporter en PDF
            </button>
          </div>
          {/* BRIEF CLIENT */}
          <div className="doc">
            <div className="doc-head">
              <div>
                <p className="eyebrow">Brief Client — format TDU</p>
                <h3 className="serif">{brief.briefClient.prenom}</h3>
              </div>
            </div>

            <p className="doc-accroche">« {brief.briefClient.accroche} »</p>

            <div className="kicker">Expériences pertinentes</div>
            <p className="body" style={{ marginBottom: 28 }}>
              {brief.briefClient.resumeExperiences}
            </p>

            <div className="two-col">
              <div>
                <div className="kicker">Points forts</div>
                <ul className="bullets">
                  {brief.briefClient.pointsForts.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="kicker">Points de vigilance</div>
                <ul className="bullets vig">
                  {brief.briefClient.pointsVigilance.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="meta-row">
              <div className="meta-item">
                <div className="k">Années d'expérience</div>
                <div className="v">{brief.briefClient.anneesExperience}</div>
              </div>
              <div className="meta-item">
                <div className="k">Disponibilité</div>
                <div className="v">{brief.briefClient.disponibilite}</div>
              </div>
              <div className="meta-item">
                <div className="k">TJM</div>
                <div className="v">{brief.briefClient.tjm}</div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <div className="kicker">Compétences clés</div>
              <div className="chips">
                {brief.briefClient.competencesCles.map((c, i) => (
                  <span key={i} className="chip solid">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div className="copy-row">
              <button
                className="link-btn"
                onClick={() => copy(briefToText(brief), "brief")}
              >
                Copier le brief
              </button>
              {copied === "brief" && (
                <span className="copied">Copié ✓</span>
              )}
            </div>
          </div>

          {/* PITCH MISSION */}
          <div className="doc" style={{ marginTop: 28 }}>
            <div className="doc-head">
              <div>
                <p className="eyebrow">Pitch Mission — pour le candidat</p>
                <h3 className="serif" style={{ fontSize: 28 }}>
                  L'accroche
                </h3>
              </div>
              <span className="muted no-print">Modifiable avant envoi</span>
            </div>
            <textarea
              className="pitch-edit no-print"
              value={pitch}
              aria-label="Pitch mission, modifiable"
              onChange={(e) => setPitch(e.target.value)}
              rows={Math.max(8, pitch.split("\n").length + 2)}
            />
            {/* version imprimable (le textarea ne s'imprime pas proprement) */}
            <p className="pitch-text print-only">{pitch}</p>
            <div className="copy-row">
              <button
                className="link-btn"
                onClick={() => copy(pitch, "pitch")}
              >
                Copier le pitch
              </button>
              {copied === "pitch" && <span className="copied">Copié ✓</span>}
            </div>
          </div>

          <div className="copy-row no-print" style={{ marginTop: 24 }}>
            <button
              className="cta ghost sm"
              onClick={() =>
                copy(briefToText(brief) + "\n\n— — —\n\nPITCH MISSION\n" + pitch, "all")
              }
            >
              Copier le dossier complet
            </button>
            {copied === "all" && <span className="copied">Dossier copié ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function briefToText(b: BriefOutput): string {
  const c = b.briefClient;
  return [
    `BRIEF CLIENT — ${c.prenom}`,
    "",
    `« ${c.accroche} »`,
    "",
    "Expériences pertinentes :",
    c.resumeExperiences,
    "",
    "Points forts :",
    ...c.pointsForts.map((p) => `• ${p}`),
    "",
    "Points de vigilance :",
    ...c.pointsVigilance.map((p) => `• ${p}`),
    "",
    `Années d'expérience : ${c.anneesExperience}`,
    `Disponibilité : ${c.disponibilite}`,
    `TJM : ${c.tjm}`,
    `Compétences clés : ${c.competencesCles.join(", ")}`,
  ].join("\n");
}
