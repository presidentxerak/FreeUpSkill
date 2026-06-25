"use client";

import { useRef, useState } from "react";
import type { BesoinInput, BesoinAnalysis } from "@/lib/types";
import { readFileAsBase64, readFileAsText } from "@/lib/api";
import Reveal from "./Reveal";

interface Props {
  besoin: BesoinInput;
  setBesoin: (b: BesoinInput) => void;
  ficheName: string;
  onFichePdf: (base64: string | undefined, name: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string | null;
  analysis: BesoinAnalysis | null;
  onContinue: () => void;
}

export default function BesoinForm({
  besoin,
  setBesoin,
  ficheName,
  onFichePdf,
  onAnalyze,
  loading,
  error,
  analysis,
  onContinue,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function up<K extends keyof BesoinInput>(key: K, val: BesoinInput[K]) {
    setBesoin({ ...besoin, [key]: val });
  }
  function upC<K extends keyof BesoinInput["contraintes"]>(
    key: K,
    val: string,
  ) {
    setBesoin({ ...besoin, contraintes: { ...besoin.contraintes, [key]: val } });
  }

  async function processFile(file: File) {
    if (file.type === "application/pdf") {
      const b64 = await readFileAsBase64(file);
      onFichePdf(b64, file.name);
    } else {
      const text = await readFileAsText(file);
      up("fichePoste", text);
      onFichePdf(undefined, file.name);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const canAnalyze =
    !loading &&
    besoin.intitule.trim().length > 0 &&
    (besoin.fichePoste.trim().length > 0 || ficheName.length > 0);

  return (
    <div className="fade-in">
      <div className="section-head">
        <p className="eyebrow">Étape 01 — Le besoin</p>
        <h2 className="serif">Créer & qualifier un besoin</h2>
        <p>
          Renseignez le besoin client. L'IA en extrait une qualification métier
          prête à l'emploi : résumé, compétences clés, points de vigilance et
          portrait du profil recherché.
        </p>
      </div>

      <div className="grid cols-2">
        <div className="field">
          <label className="lbl">Client</label>
          <input
            value={besoin.client}
            onChange={(e) => up("client", e.target.value)}
            placeholder="Ex. Société Générale"
          />
        </div>
        <div className="field">
          <label className="lbl">Opérationnel</label>
          <input
            value={besoin.operationnel}
            onChange={(e) => up("operationnel", e.target.value)}
            placeholder="Ex. Manager de l'équipe Data"
          />
        </div>
        <div className="field span-2">
          <label className="lbl">Intitulé du poste</label>
          <input
            value={besoin.intitule}
            onChange={(e) => up("intitule", e.target.value)}
            placeholder="Ex. Développeur Senior Java / Kafka"
          />
        </div>

        <div
          className={"field span-2 dropzone" + (drag ? " dragover" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) processFile(f);
          }}
        >
          <label className="lbl">
            Texte de la fiche de poste
            <span className="hint">
              collez le texte, importez ou glissez un PDF
            </span>
          </label>
          <textarea
            value={besoin.fichePoste}
            onChange={(e) => up("fichePoste", e.target.value)}
            placeholder="Collez ici la fiche de poste — ou glissez un PDF…"
            rows={7}
          />
          <div className="file-row" style={{ marginTop: 4 }}>
            <label className="file-label">
              Importer un fichier
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                hidden
                onChange={handleFile}
              />
            </label>
            {ficheName && (
              <span className="file-name">— {ficheName}</span>
            )}
          </div>
        </div>

        <div className="field span-2">
          <label className="lbl">Contexte / qualification</label>
          <textarea
            value={besoin.contexte}
            onChange={(e) => up("contexte", e.target.value)}
            placeholder="Contexte de la mission, enjeux, équipe, process de recrutement…"
            rows={4}
          />
        </div>
      </div>

      <div className="fieldset-card" style={{ marginTop: 28 }}>
        <span className="fieldset-title">Contraintes</span>
        <div className="grid cols-2">
          <div className="field">
            <label className="lbl">TJM</label>
            <input
              value={besoin.contraintes.tjm}
              onChange={(e) => upC("tjm", e.target.value)}
              placeholder="Ex. 550 – 650 €"
            />
          </div>
          <div className="field">
            <label className="lbl">Localisation</label>
            <input
              value={besoin.contraintes.localisation}
              onChange={(e) => upC("localisation", e.target.value)}
              placeholder="Ex. Paris La Défense"
            />
          </div>
          <div className="field">
            <label className="lbl">Démarrage</label>
            <input
              value={besoin.contraintes.demarrage}
              onChange={(e) => upC("demarrage", e.target.value)}
              placeholder="Ex. ASAP / 1er du mois"
            />
          </div>
          <div className="field">
            <label className="lbl">Télétravail</label>
            <input
              value={besoin.contraintes.teletravail}
              onChange={(e) => upC("teletravail", e.target.value)}
              placeholder="Ex. 2 j / semaine"
            />
          </div>
        </div>
      </div>

      <div className="bonus" style={{ marginTop: 36 }}>
        <span className="badge">Bonus — Mémoire</span>
        <div className="field">
          <label className="lbl">
            Historique opérationnel
            <span className="hint">
              biais & préférences humaines côté client
            </span>
          </label>
          <textarea
            value={besoin.historiqueOperationnel}
            onChange={(e) => up("historiqueOperationnel", e.target.value)}
            placeholder='Ex. « L&apos;opérationnel veut du hands-on, pas de profil trop théorique. Il challenge souvent sur Kafka. »'
            rows={3}
          />
          <p className="muted" style={{ marginTop: 8 }}>
            L'IA s'appuiera obligatoirement sur cette mémoire pour ajuster ses
            alertes, son scoring et son ranking.
          </p>
        </div>
      </div>

      <div className="actions">
        <button className="cta" onClick={onAnalyze} disabled={!canAnalyze}>
          {loading ? "Analyse en cours" : "Analyser le besoin"}
        </button>
        {loading && (
          <span className="loading-note">
            <span className="spinner" /> Qualification métier…
          </span>
        )}
      </div>

      {error && (
        <div className="alert">
          <span className="x">!</span>
          <span>{error}</span>
        </div>
      )}

      {analysis && (
        <div className="result" style={{ marginTop: 56 }}>
          <hr className="rule" />
          <p className="eyebrow">Qualification IA</p>

          <Reveal className="panel" style={{ marginTop: 24 }}>
            <div className="kicker">Le besoin en 5 lignes</div>
            <ul className="lede-list">
              {analysis.resume.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="two-col" style={{ marginTop: 24 }}>
            <div className="panel">
              <div className="kicker">Compétences indispensables</div>
              <div className="chips">
                {analysis.competencesIndispensables.map((c, i) => (
                  <span key={i} className="chip solid">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="panel">
              <div className="kicker">Compétences secondaires</div>
              <div className="chips">
                {analysis.competencesSecondaires.map((c, i) => (
                  <span key={i} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal className="two-col" style={{ marginTop: 24 }}>
            <div className="panel">
              <div className="kicker">Points de vigilance</div>
              <ul className="bullets vig">
                {analysis.pointsVigilance.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <div className="kicker">Type de profil recherché</div>
              <p
                className="serif"
                style={{ fontSize: 22, lineHeight: 1.35, fontStyle: "italic" }}
              >
                {analysis.typeProfil}
              </p>
            </div>
          </Reveal>

          <div className="actions">
            <button className="cta ghost" onClick={onContinue}>
              Passer aux CV →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
