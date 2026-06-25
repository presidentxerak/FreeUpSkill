// Petit client pour appeler /api/ai depuis le navigateur.

export const USER_KEY_STORAGE = "skills_anthropic_key";

export async function callAI<T>(task: string, payload: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    const userKey = window.localStorage.getItem(USER_KEY_STORAGE);
    if (userKey) headers["x-user-api-key"] = userKey;
  }

  const res = await fetch("/api/ai", {
    method: "POST",
    headers,
    body: JSON.stringify({ task, payload }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || "Erreur inconnue.");
  }
  return json.data as T;
}

// Lit un fichier en base64 (pour les PDF) ou en texte (pour les .txt).
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
