import { NextResponse } from "next/server";

// ============================================================
//  Delt turnerings-tilstand på tværs af enheder (valgfrit).
//
//  Kræver en Redis-integration på Vercel (fx Upstash Redis fra
//  Vercel Marketplace — gratis tier). Når integrationen er
//  tilføjet, sættes miljøvariablerne automatisk, og kontrol-
//  panel, storskærm og dealer-telefoner synkroniserer live.
//
//  Uden integrationen svarer API'et { enabled: false }, og
//  appen kører videre med lokal synkronisering i én browser.
// ============================================================

export const dynamic = "force-dynamic";

const KEY = "rss-poker-state";

function redisConfig(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.REDIS_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function redisGet(cfg: { url: string; token: string }): Promise<string | null> {
  const res = await fetch(`${cfg.url}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result: string | null };
  return data.result ?? null;
}

async function redisSet(cfg: { url: string; token: string }, value: string): Promise<void> {
  await fetch(`${cfg.url}/set/${KEY}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: value,
    cache: "no-store",
  });
}

type Stored = { rev: number; state: Record<string, unknown> };

function parseStored(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Stored;
    if (typeof data.rev !== "number" || !data.state) return null;
    return data;
  } catch {
    return null;
  }
}

export async function GET() {
  const cfg = redisConfig();
  if (!cfg) return NextResponse.json({ enabled: false });
  try {
    const stored = parseStored(await redisGet(cfg));
    return NextResponse.json({
      enabled: true,
      rev: stored?.rev ?? 0,
      state: stored?.state ?? null,
    });
  } catch {
    return NextResponse.json({ enabled: true, rev: 0, state: null, error: "redis" });
  }
}

export async function POST(req: Request) {
  const cfg = redisConfig();
  if (!cfg) return NextResponse.json({ enabled: false });
  let body: { state?: { eliminationOrder?: string[] }; baseRev?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.state || typeof body.state !== "object") {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }
  const baseRev = typeof body.baseRev === "number" ? body.baseRev : 0;

  try {
    const stored = parseStored(await redisGet(cfg));
    let nextState = body.state as Stored["state"] & { eliminationOrder?: string[] };
    let rev: number;

    if (!stored || baseRev >= stored.rev) {
      rev = (stored?.rev ?? 0) + 1;
    } else {
      // Samtidige opdateringer fra flere enheder: bevar knockouts
      // fra begge sider, så en dealer-markering aldrig går tabt.
      const incoming = Array.isArray(nextState.eliminationOrder)
        ? nextState.eliminationOrder
        : [];
      const storedOrder = Array.isArray(
        (stored.state as { eliminationOrder?: string[] }).eliminationOrder
      )
        ? ((stored.state as { eliminationOrder?: string[] }).eliminationOrder as string[])
        : [];
      const seen = new Set(incoming);
      const merged = [...incoming];
      for (const id of storedOrder) {
        if (!seen.has(id)) merged.push(id);
      }
      nextState = { ...nextState, eliminationOrder: merged };
      rev = stored.rev + 1;
    }

    await redisSet(cfg, JSON.stringify({ rev, state: nextState }));
    return NextResponse.json({ enabled: true, rev, state: nextState });
  } catch {
    return NextResponse.json({ enabled: true, error: "redis" }, { status: 500 });
  }
}
