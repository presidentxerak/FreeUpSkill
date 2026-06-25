"use client";

import { useState } from "react";
import { USER_KEY_STORAGE, callAI } from "@/lib/api";

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

  function persist() {
    if (value.trim()) {
      window.localStorage.setItem(USER_KEY_STORAGE, value.trim());
    } else {
      window.localStorage.removeItem(USER_KEY_STORAGE);
    }
    onSaved();
  }

  function save() {
    persist();
    onClose();
  }

  function clear() {
    window.localStorage.removeItem(USER_KEY_STORAGE);
    setValue("");
    setTestMsg(null);
    onSaved();
  }

  async function test() {
    persist();
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
