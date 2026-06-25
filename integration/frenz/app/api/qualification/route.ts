// =============================================================================
// Frenz — route d'intégration Skills (App Router Next.js 14)
// Chemin cible : app/api/qualification/route.ts
//
// Auth : Privy (Bearer access token ou cookie privy-token)
// IA   : runSkill (lib/skills-core.ts) avec ANTHROPIC_API_KEY serveur
// Data : persistance Supabase optionnelle (service_role) — voir supabase.sql
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { createClient } from "@supabase/supabase-js";
import { runSkill, SkillError, type SkillTask } from "@/lib/skills-core";

export const runtime = "nodejs";
export const maxDuration = 60;

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

// Client Supabase service_role (serveur uniquement — bypass RLS).
function supa() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Récupère et vérifie l'utilisateur Privy. Renvoie le DID (did:privy:...).
async function getUserId(req: NextRequest): Promise<string> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || req.cookies.get("privy-token")?.value;
  if (!token) throw new SkillError("Non authentifié.", 401);
  try {
    const claims = await privy.verifyAuthToken(token);
    return claims.userId;
  } catch {
    throw new SkillError("Session invalide ou expirée.", 401);
  }
}

const PERSISTED = new Set<SkillTask>([
  "analyze_besoin",
  "match_cv",
  "rank_candidates",
  "generate_brief",
]);

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY non configurée côté serveur." },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);
    const task = body?.task as SkillTask;
    const payload = body?.payload;
    if (!task) {
      return NextResponse.json({ error: "Tâche manquante." }, { status: 400 });
    }

    // (Optionnel) Gate par abonnement Stripe : décommentez si Frenz limite l'accès.
    // await assertActiveSubscription(userId);

    const data = await runSkill(task, payload, apiKey);

    // Persistance Supabase (best-effort : n'échoue pas la requête si l'insert rate).
    if (PERSISTED.has(task) && body?.persist !== false) {
      try {
        await supa()
          .from("skills_records")
          .insert({
            owner_id: userId,
            task,
            // On ne stocke pas les PDF base64 (volumineux) : on les retire du payload.
            input: stripHeavy(payload),
            output: data,
          });
      } catch {
        /* journalisez si besoin */
      }
    }

    return NextResponse.json({ data });
  } catch (e: any) {
    const status = e instanceof SkillError ? e.status : 500;
    const message = e?.message || "Erreur serveur.";
    return NextResponse.json({ error: message }, { status });
  }
}

function stripHeavy(payload: any) {
  if (!payload || typeof payload !== "object") return payload;
  const { fichePdfBase64, cvPdfBase64, ...rest } = payload;
  return rest;
}

// --- (Optionnel) exemple de gate Stripe via Supabase ---
// async function assertActiveSubscription(userId: string) {
//   const { data } = await supa()
//     .from("subscriptions")
//     .select("status")
//     .eq("owner_id", userId)
//     .maybeSingle();
//   if (!data || !["active", "trialing"].includes(data.status)) {
//     throw new SkillError("Abonnement requis pour utiliser la qualification IA.", 402);
//   }
// }
