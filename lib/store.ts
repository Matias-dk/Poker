"use client";

// ============================================================
//  Fælles turnerings-tilstand uden database.
//  Gemmes i localStorage og synkroniseres live mellem faner/
//  vinduer (kontrolpanel + storskærm) via BroadcastChannel.
// ============================================================

import { useSyncExternalStore } from "react";
import {
  DEFAULT_LEVELS,
  DEFAULT_PLAYERS,
  DEFAULT_TABLES,
  TOURNAMENT_TITLE,
} from "@/data/config";

export type BlindLevel = {
  sb: number;
  bb: number;
  minutes: number;
  isBreak?: boolean;
};

export type TableConfig = { name: string; capacity: number };

export type Player = {
  id: string;
  name: string;
  tableId: string | null;
  seat: number | null;
};

export type Table = {
  id: string;
  name: string;
  capacity: number;
};

export type TournamentState = {
  title: string;
  players: Player[];
  tables: Table[];
  levels: BlindLevel[];
  levelIndex: number;
  running: boolean;
  endsAt: number | null; // tidspunkt hvor niveauet slutter (når uret kører)
  remainingMs: number; // resterende tid (når uret er sat på pause)
  lastAdvanceAt: number; // værn mod dobbelt niveau-skift fra flere faner
  eliminationOrder: string[]; // spiller-id'er i den rækkefølge de røg ud
  showResults: boolean;
  filmTop: number; // resultat-filmens nedtælling starter her (0 = alle placeringer)
};

const STORAGE_KEY = "rss-poker-state-v1";
const CHANNEL = "rss-poker";

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function defaultState(): TournamentState {
  const tables: Table[] = DEFAULT_TABLES.map((t) => ({
    id: makeId("table"),
    name: t.name,
    capacity: t.capacity,
  }));
  const players: Player[] = DEFAULT_PLAYERS.map((name) => ({
    id: makeId("player"),
    name,
    tableId: null,
    seat: null,
  }));
  const levels = DEFAULT_LEVELS.length
    ? DEFAULT_LEVELS
    : [{ sb: 25, bb: 50, minutes: 20 }];
  return {
    title: TOURNAMENT_TITLE,
    players,
    tables,
    levels,
    levelIndex: 0,
    running: false,
    endsAt: null,
    remainingMs: levels[0].minutes * 60_000,
    lastAdvanceAt: 0,
    eliminationOrder: [],
    showResults: false,
    filmTop: 0,
  };
}

const SERVER_STATE: TournamentState = defaultState();

let state: TournamentState = SERVER_STATE;
let initialized = false;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

// Synkronisering på tværs af enheder via /api/state (hvis en
// Redis-integration er sat op på Vercel). 'checking' indtil
// første svar; 'off' = kun lokal synkronisering i denne browser.
export type SyncStatus = "checking" | "on" | "off";
let syncStatus: SyncStatus = "checking";
let lastServerRev = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignoreres */
  }
}

function adoptRemote(remote: TournamentState) {
  state = { ...defaultState(), ...remote };
  persistLocal();
  channel?.postMessage(state);
  emit();
}

function hasContent(s: TournamentState): boolean {
  return s.players.length > 0 || s.tables.length > 0 || s.eliminationOrder.length > 0;
}

function setSyncStatus(v: SyncStatus) {
  if (syncStatus !== v) {
    syncStatus = v;
    emit();
  }
}

async function pollOnce() {
  // Poller altid — så genopdages serveren automatisk, hvis
  // lagringen først bliver sat op (eller kommer sig) undervejs.
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    const data = (await res.json()) as {
      enabled: boolean;
      rev?: number;
      state?: TournamentState | null;
    };
    if (!data.enabled) {
      setSyncStatus("off");
      return;
    }
    setSyncStatus("on");
    const rev = data.rev ?? 0;
    if (data.state && rev > lastServerRev) {
      lastServerRev = rev;
      adoptRemote(data.state);
    } else if (!data.state && rev === 0 && hasContent(state)) {
      // Serveren er tom, men vi har lokal turneringsdata: send den op
      schedulePush();
    }
  } catch {
    /* offline — prøver igen ved næste poll */
  }
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, baseRev: lastServerRev }),
      });
      const data = (await res.json()) as {
        enabled: boolean;
        rev?: number;
        state?: TournamentState;
      };
      if (!data.enabled) {
        setSyncStatus("off");
        return;
      }
      setSyncStatus("on");
      if (typeof data.rev === "number") lastServerRev = data.rev;
      // Hvis serveren flettede samtidige ændringer, overtag resultatet
      if (data.state && JSON.stringify(data.state) !== JSON.stringify(state)) {
        adoptRemote(data.state);
      }
    } catch {
      /* offline — lokal tilstand er stadig gemt */
    }
  }, 250);
}

export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, () => "checking" as SyncStatus);
}

function ensureInit() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = { ...defaultState(), ...(JSON.parse(raw) as TournamentState) };
    } else {
      state = defaultState();
    }
  } catch {
    state = defaultState();
  }
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<TournamentState>) => {
      state = e.data;
      emit();
    };
  }
  // Reserve-synkronisering hvis BroadcastChannel ikke findes
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue) as TournamentState;
        emit();
      } catch {
        /* ignoreres */
      }
    }
  });
  // Server-synkronisering: hent straks og poll derefter hvert 2. sekund
  pollOnce();
  setInterval(pollOnce, 2000);
  emit();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  ensureInit();
  return () => {
    listeners.delete(fn);
  };
}

export function getSnapshot(): TournamentState {
  return state;
}

export function getServerSnapshot(): TournamentState {
  return SERVER_STATE;
}

export function useTournament(): TournamentState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function update(fn: (s: TournamentState) => TournamentState) {
  ensureInit();
  state = fn(state);
  persistLocal();
  channel?.postMessage(state);
  emit();
  schedulePush();
}

// ---------- Afledte hjælpere ----------

/** Spillere der stadig er med (ikke slået ud). */
export function activePlayers(s: TournamentState): Player[] {
  const out = new Set(s.eliminationOrder);
  return s.players.filter((p) => !out.has(p.id));
}

/**
 * Placeringer udregnet fra udslagsrækkefølgen:
 * Første der ryger ud får sidstepladsen. Når kun én spiller er
 * tilbage, får vedkommende automatisk 1.-pladsen.
 */
export function placements(s: TournamentState): Map<string, number> {
  const map = new Map<string, number>();
  const total = s.players.length;
  s.eliminationOrder.forEach((id, i) => map.set(id, total - i));
  if (total > 1 && s.eliminationOrder.length === total - 1) {
    const winner = activePlayers(s)[0];
    if (winner) map.set(winner.id, 1);
  }
  return map;
}

export function currentLevel(s: TournamentState): BlindLevel {
  return s.levels[Math.min(s.levelIndex, s.levels.length - 1)];
}

export function nextBlindLevel(s: TournamentState): BlindLevel | null {
  return s.levels[s.levelIndex + 1] ?? null;
}

/** Resterende tid i millisekunder på det nuværende niveau. */
export function remainingTime(s: TournamentState, now: number): number {
  if (s.running && s.endsAt !== null) return Math.max(0, s.endsAt - now);
  return Math.max(0, s.remainingMs);
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th" ... */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  const suffix = ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ---------- Deltagere ----------

export function addPlayers(names: string[]) {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (!cleaned.length) return;
  update((s) => ({
    ...s,
    players: [
      ...s.players,
      ...cleaned.map((name) => ({
        id: makeId("player"),
        name,
        tableId: null,
        seat: null,
      })),
    ],
  }));
}

/** Opret en spiller direkte ved et bord (bruges fra dealer-siden). */
export function addPlayerToTable(name: string, tableId: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  update((s) => {
    const table = s.tables.find((t) => t.id === tableId);
    if (!table) return s;
    // Første ledige plads blandt de aktive ved bordet
    const out = new Set(s.eliminationOrder);
    const taken = new Set(
      s.players
        .filter((p) => p.tableId === tableId && !out.has(p.id) && p.seat !== null)
        .map((p) => p.seat as number)
    );
    let seat: number | null = null;
    for (let i = 1; i <= Math.max(table.capacity, taken.size + 1); i++) {
      if (!taken.has(i)) {
        seat = i;
        break;
      }
    }
    return {
      ...s,
      players: [
        ...s.players,
        { id: makeId("player"), name: trimmed, tableId, seat },
      ],
    };
  });
}

export function removePlayer(id: string) {
  update((s) => ({
    ...s,
    players: s.players.filter((p) => p.id !== id),
    eliminationOrder: s.eliminationOrder.filter((e) => e !== id),
  }));
}

export function movePlayer(id: string, tableId: string | null) {
  update((s) => ({
    ...s,
    players: s.players.map((p) =>
      p.id === id ? { ...p, tableId, seat: null } : p
    ),
  }));
}

export function eliminatePlayer(id: string) {
  update((s) => {
    if (s.eliminationOrder.includes(id)) return s;
    return { ...s, eliminationOrder: [...s.eliminationOrder, id] };
  });
}

export function undoElimination(id: string) {
  update((s) => ({
    ...s,
    eliminationOrder: s.eliminationOrder.filter((e) => e !== id),
  }));
}

export function undoLastElimination() {
  update((s) => ({
    ...s,
    eliminationOrder: s.eliminationOrder.slice(0, -1),
  }));
}

// ---------- Borde ----------

export function addTable(name: string, capacity: number) {
  update((s) => ({
    ...s,
    tables: [
      ...s.tables,
      { id: makeId("table"), name: name.trim() || `Table ${s.tables.length + 1}`, capacity },
    ],
  }));
}

export function removeTable(id: string) {
  update((s) => ({
    ...s,
    tables: s.tables.filter((t) => t.id !== id),
    players: s.players.map((p) =>
      p.tableId === id ? { ...p, tableId: null, seat: null } : p
    ),
  }));
}

export function updateTable(id: string, patch: Partial<TableConfig>) {
  update((s) => ({
    ...s,
    tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
}

/** Fordel de aktive spillere tilfældigt og jævnt på bordene. */
export function drawSeats() {
  update((s) => {
    if (!s.tables.length) return s;
    const out = new Set(s.eliminationOrder);
    const actives = s.players.filter((p) => !out.has(p.id));
    const shuffled = [...actives];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Sæderne deles ud på skift mellem bordene, så de bliver lige fyldte
    const seats: { tableId: string; seat: number }[] = [];
    const maxCap = Math.max(...s.tables.map((t) => t.capacity));
    for (let seatNo = 1; seatNo <= maxCap; seatNo++) {
      for (const t of s.tables) {
        if (seatNo <= t.capacity) seats.push({ tableId: t.id, seat: seatNo });
      }
    }
    const byId = new Map<string, { tableId: string | null; seat: number | null }>();
    shuffled.forEach((p, i) => {
      byId.set(p.id, seats[i] ?? { tableId: null, seat: null });
    });
    return {
      ...s,
      players: s.players.map((p) =>
        byId.has(p.id) ? { ...p, ...byId.get(p.id)! } : p
      ),
    };
  });
}

// ---------- Blinds og ur ----------

export function startTimer() {
  update((s) => ({
    ...s,
    running: true,
    endsAt: Date.now() + Math.max(0, s.remainingMs),
  }));
}

export function pauseTimer() {
  update((s) => ({
    ...s,
    running: false,
    remainingMs: s.endsAt !== null ? Math.max(0, s.endsAt - Date.now()) : s.remainingMs,
    endsAt: null,
  }));
}

export function setLevel(index: number) {
  update((s) => {
    const i = Math.max(0, Math.min(index, s.levels.length - 1));
    const ms = s.levels[i].minutes * 60_000;
    return {
      ...s,
      levelIndex: i,
      remainingMs: ms,
      endsAt: s.running ? Date.now() + ms : null,
      lastAdvanceAt: Date.now(),
    };
  });
}

export function nextLevel() {
  setLevel(getSnapshot().levelIndex + 1);
}

export function prevLevel() {
  setLevel(getSnapshot().levelIndex - 1);
}

export function resetLevelClock() {
  update((s) => {
    const ms = currentLevel(s).minutes * 60_000;
    return { ...s, remainingMs: ms, endsAt: s.running ? Date.now() + ms : null };
  });
}

/**
 * Kaldes løbende fra begge sider. Skifter automatisk til næste
 * niveau når tiden er gået. `lastAdvanceAt` værner mod at to
 * åbne vinduer skifter niveau samtidig.
 */
export function tick() {
  ensureInit();
  const s = state;
  if (!s.running || s.endsAt === null) return;
  const now = Date.now();
  if (now < s.endsAt) return;
  if (now - s.lastAdvanceAt < 2000) return;
  if (s.levelIndex >= s.levels.length - 1) {
    // Sidste niveau: stop uret på 0:00
    update((st) => ({ ...st, running: false, endsAt: null, remainingMs: 0 }));
    return;
  }
  update((st) => {
    if (!st.running || st.endsAt === null || Date.now() < st.endsAt) return st;
    const i = st.levelIndex + 1;
    const ms = st.levels[i].minutes * 60_000;
    return {
      ...st,
      levelIndex: i,
      remainingMs: ms,
      endsAt: Date.now() + ms,
      lastAdvanceAt: Date.now(),
    };
  });
}

export function updateLevel(index: number, patch: Partial<BlindLevel>) {
  update((s) => {
    const levels = s.levels.map((l, i) => (i === index ? { ...l, ...patch } : l));
    const next = { ...s, levels };
    if (index === s.levelIndex && patch.minutes !== undefined && !s.running) {
      next.remainingMs = levels[index].minutes * 60_000;
    }
    return next;
  });
}

export function addLevelRow() {
  update((s) => {
    const last = s.levels[s.levels.length - 1];
    const newLevel: BlindLevel = last?.isBreak
      ? { sb: 100, bb: 200, minutes: 20 }
      : { sb: (last?.sb ?? 25) * 2, bb: (last?.bb ?? 50) * 2, minutes: last?.minutes ?? 20 };
    return { ...s, levels: [...s.levels, newLevel] };
  });
}

export function removeLevelRow(index: number) {
  update((s) => {
    if (s.levels.length <= 1) return s;
    const levels = s.levels.filter((_, i) => i !== index);
    const levelIndex = Math.min(s.levelIndex, levels.length - 1);
    return { ...s, levels, levelIndex };
  });
}

// ---------- Resultat og nulstilling ----------

export function setShowResults(show: boolean) {
  update((s) => ({ ...s, showResults: show }));
}

/** Hvor resultat-filmens nedtælling starter (0 = alle placeringer). */
export function setFilmTop(top: number) {
  update((s) => ({ ...s, filmTop: Math.max(0, top) }));
}

/** Nulstil turneringen, men behold deltagere, borde og blind-struktur. */
export function resetTournament() {
  update((s) => ({
    ...s,
    levelIndex: 0,
    running: false,
    endsAt: null,
    remainingMs: s.levels[0].minutes * 60_000,
    eliminationOrder: [],
    showResults: false,
    players: s.players.map((p) => ({ ...p, tableId: null, seat: null })),
  }));
}

/** Slet alt og start forfra fra opsætningen i koden. */
export function fullReset() {
  update(() => defaultState());
}
