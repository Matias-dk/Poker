import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/data/config";

// ============================================================
//  Delt turnerings-tilstand på tværs af enheder.
//
//  Lager vælges automatisk:
//   1. Supabase — URL/nøgle fra data/config.ts (eller env
//      SUPABASE_URL/SUPABASE_ANON_KEY). Kræver at tabellen
//      tournament_state findes — se README for opsætnings-SQL.
//   2. Redis (Upstash/Vercel KV) — hvis REST-miljøvariabler findes
//   3. Vercel Blob — hvis BLOB_READ_WRITE_TOKEN findes
//   4. Intet af det → { enabled: false }, og appen kører videre
//      med lokal synkronisering i én browser.
// ============================================================

export const dynamic = "force-dynamic";

const KEY = "rss-poker-state";
const BLOB_PATH = `${KEY}.json`;

// ---------- Supabase-driver ----------

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function supabaseHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function supabaseGet(cfg: { url: string; key: string }): Promise<string | null> {
  const res = await fetch(
    `${cfg.url}/rest/v1/tournament_state?id=eq.${KEY}&select=rev,state`,
    { headers: supabaseHeaders(cfg.key), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`supabase get ${res.status}`);
  }
  const rows = (await res.json()) as { rev: number; state: unknown }[];
  if (!rows.length || rows[0].state == null) return null;
  return JSON.stringify({ rev: rows[0].rev, state: rows[0].state });
}

async function supabaseSet(cfg: { url: string; key: string }, value: string): Promise<void> {
  const { rev, state } = JSON.parse(value) as { rev: number; state: unknown };
  const res = await fetch(`${cfg.url}/rest/v1/tournament_state?on_conflict=id`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(cfg.key),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify([{ id: KEY, rev, state }]),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`supabase set ${res.status}`);
  }
}

// ---------- Redis-driver ----------

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

// ---------- Blob-driver ----------

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Den offentlige blob-URL kan udledes af tokenet
 * (vercel_blob_rw_<storeId>_...), så vi slipper for et
 * list-kald pr. læsning. Falder tilbage til list() hvis
 * konstruktionen ikke rammer.
 */
function blobDirectUrl(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  const parts = token.split("_");
  if (parts.length < 4 || parts[0] !== "vercel" || parts[1] !== "blob") return null;
  const storeId = parts[3];
  if (!storeId) return null;
  return `https://${storeId.toLowerCase()}.public.blob.vercel-storage.com/${BLOB_PATH}`;
}

async function blobGet(): Promise<string | null> {
  const direct = blobDirectUrl();
  if (direct) {
    const res = await fetch(`${direct}?t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) return await res.text();
    if (res.status === 404) return null;
  }
  const { blobs } = await list({ prefix: KEY, limit: 1 });
  if (!blobs.length) return null;
  const res = await fetch(`${blobs[0].url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.text();
}

async function blobSet(value: string): Promise<void> {
  // Ingen cacheControlMaxAge: minimum er 60 s, og læsningerne
  // cache-buster alligevel med ?t=<nu>, så standarden er fint.
  await put(BLOB_PATH, value, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// ---------- Fælles driver ----------

type Driver = {
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
};

/** Alle konfigurerede lagre i prioriteret rækkefølge: Supabase → Redis → Blob. */
function pickDrivers(): Driver[] {
  const drivers: Driver[] = [];
  const supabase = supabaseConfig();
  if (supabase) {
    drivers.push({
      get: () => supabaseGet(supabase),
      set: (v) => supabaseSet(supabase, v),
    });
  }
  const redis = redisConfig();
  if (redis) {
    drivers.push({ get: () => redisGet(redis), set: (v) => redisSet(redis, v) });
  }
  if (blobEnabled()) {
    drivers.push({ get: blobGet, set: blobSet });
  }
  return drivers;
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
  const drivers = pickDrivers();
  if (!drivers.length) return NextResponse.json({ enabled: false });
  for (const driver of drivers) {
    try {
      const stored = parseStored(await driver.get());
      return NextResponse.json({
        enabled: true,
        rev: stored?.rev ?? 0,
        state: stored?.state ?? null,
      });
    } catch {
      // Prøv næste lager (fx manglende Supabase-tabel → Blob)
    }
  }
  // Lager er konfigureret men intet svarer: meld sync fra, så
  // kontrolpanelet viser opsætningshjælpen.
  return NextResponse.json({ enabled: false, error: "storage" });
}

export async function POST(req: Request) {
  const drivers = pickDrivers();
  if (!drivers.length) return NextResponse.json({ enabled: false });
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

  for (const driver of drivers) {
    try {
      const stored = parseStored(await driver.get());
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

      await driver.set(JSON.stringify({ rev, state: nextState }));
      return NextResponse.json({ enabled: true, rev, state: nextState });
    } catch {
      // Prøv næste lager
    }
  }
  return NextResponse.json({ enabled: true, error: "storage" }, { status: 500 });
}
