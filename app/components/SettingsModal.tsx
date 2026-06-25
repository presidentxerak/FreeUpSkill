"use client";

import { useState } from "react";
import {
  USER_KEY_STORAGE,
  callAI,
  sanitizeKey,
  looksLikeKey,
} from "@/lib/api";

export default function SettingsModal({
  onClose,
  onSaved,
  hasServerKey,
}: {
  onClose: () => void;
  onSaved: () => void;
  hasServerKey: boolean;
}) {
  const [value, setValue] = useState(
    typeof window !== "undefined"
      ? window.localStorage.getItem(USER_KEY_STORAGE) || ""
      : "",
  );
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  // Renvoie true si la valeur est OK (ou vide), false si elle est invalide.
  function persist(): boolean {
    const clean = sanitizeKey(value);
    if (!clean) {
      window.localStorage.removeItem(USER_KEY_STORAGE);
      onSaved();
      return true;
    }
    if (!looksLikeKey(clean)) {
      setTestMsg({
        ok: false,
        text: "Ceci ne ressemble pas à une clé API. Collez uniquement votre clé (elle commence par sk-ant-…), pas une commande curl, une URL ni un token OAuth.",
      });
      return false;
    }
    window.localStorage.setItem(USER_KEY_STORAGE, clean);
    onSaved();
    return true;
  }

  function save() {
    if (persist()) onClose();
  }

  function clear() {
    window.localStorage.removeItem(USER_KEY_STORAGE);
    setValue("");
    setTestMsg(null);
    onSaved();
  }

  async function test() {
    if (!persist()) return; // valeur invalide : message déjà affiché
    setTesting(true);
    setTestMsg(null);
    try {
      await callAI("ping", {});
      setTestMsg({ ok: true, text: "Connexion établie — la clé fonctionne." });
    } catch (e: any) {
      setTestMsg({ ok: false, text: e.message || "Échec de la connexion." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Réglages</p>
        <h3 className="serif">Clé API Anthropic</h3>
        <p>
          {hasServerKey
            ? "Une clé est déjà configurée côté serveur — l'app fonctionne sans rien renseigner. Vous pouvez tout de même utiliser votre propre clé."
            : "Collez une clé API Anthropic pour activer l'assistant. Elle reste dans votre navigateur (localStorage) et n'est envoyée qu'à votre propre backend pour relayer la requête."}
        </p>
        <div className="field">
          <label className="lbl">Clé secrète</label>
          <input
            type="password"
            value={value}
            placeholder="sk-ant-..."
            onChange={(e) => {
              setValue(e.target.value);
              setTestMsg(null);
            }}
            autoFocus
          />
          <p className="muted" style={{ marginTop: 8 }}>
            À créer sur console.anthropic.com → API Keys. Collez uniquement la
            clé (format sk-ant-…), pas une commande curl.
          </p>
        </div>

        {testMsg && (
          <div className={"test-msg " + (testMsg.ok ? "ok" : "err")}>
            {testMsg.ok ? "✓" : "!"} {testMsg.text}
          </div>
        )}

        <div className="actions">
          <button className="cta" onClick={save}>
            Enregistrer
          </button>
          <button
            className="cta ghost sm"
            onClick={test}
            disabled={testing || (!value.trim() && !hasServerKey)}
          >
            {testing ? "Test en cours…" : "Tester la clé"}
          </button>
          <button className="link-btn" onClick={clear}>
            Effacer
          </button>
        </div>
      </div>
    </div>
  );
}
