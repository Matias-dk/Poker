import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";

// ============================================================
//  Delt turnerings-tilstand på tværs af enheder.
//
//  Lager vælges automatisk efter hvad der er sat op på Vercel:
//   1. Redis (Upstash/Vercel KV) — hvis REST-miljøvariabler findes
//   2. Vercel Blob — hvis BLOB_READ_WRITE_TOKEN findes
//      (Storage → Create Database → Blob → Create → Redeploy)
//   3. Ingen af delene → { enabled: false }, og appen kører
//      videre med lokal synkronisering i én browser.
// ============================================================

export const dynamic = "force-dynamic";

const KEY = "rss-poker-state";
const BLOB_PATH = `${KEY}.json`;

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

function pickDriver(): Driver | null {
  const redis = redisConfig();
  if (redis) {
    return { get: () => redisGet(redis), set: (v) => redisSet(redis, v) };
  }
  if (blobEnabled()) {
    return { get: blobGet, set: blobSet };
  }
  return null;
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
  const driver = pickDriver();
  if (!driver) return NextResponse.json({ enabled: false });
  try {
    const stored = parseStored(await driver.get());
    return NextResponse.json({
      enabled: true,
      rev: stored?.rev ?? 0,
      state: stored?.state ?? null,
    });
  } catch {
    return NextResponse.json({ enabled: true, rev: 0, state: null, error: "storage" });
  }
}

export async function POST(req: Request) {
  const driver = pickDriver();
  if (!driver) return NextResponse.json({ enabled: false });
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
    return NextResponse.json({ enabled: true, error: "storage" }, { status: 500 });
  }
}
