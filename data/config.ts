// ============================================================
//  Ranum Summer School Poker — opsætning gemt direkte i koden
// ============================================================
//  Ret i denne fil for at ændre standard-opsætningen:
//  - TOURNAMENT_TITLE: navnet der vises på storskærmen
//  - DEFAULT_PLAYERS:  deltagere der er med fra start
//                      (kan også tilføjes/uploades i kontrolpanelet)
//  - DEFAULT_TABLES:   borde der oprettes fra start
//  - DEFAULT_LEVELS:   blind-strukturen (small/big blind + minutter)
// ============================================================

import type { BlindLevel, TableConfig } from "@/lib/store";

export const TOURNAMENT_TITLE = "Ranum Summer School Poker";

// Én deltager pr. linje — skriv navnene her, eller upload dem i kontrolpanelet.
export const DEFAULT_PLAYERS: string[] = [
  // "Anna",
  // "Bo",
  // "Clara",
];

export const DEFAULT_TABLES: TableConfig[] = [
  // { name: "Bord 1", capacity: 8 },
  // { name: "Bord 2", capacity: 8 },
];

export const DEFAULT_LEVELS: BlindLevel[] = [
  { sb: 25, bb: 50, minutes: 20 },
  { sb: 50, bb: 100, minutes: 20 },
  { sb: 75, bb: 150, minutes: 20 },
  { sb: 100, bb: 200, minutes: 20 },
  { sb: 0, bb: 0, minutes: 10, isBreak: true },
  { sb: 150, bb: 300, minutes: 20 },
  { sb: 200, bb: 400, minutes: 20 },
  { sb: 300, bb: 600, minutes: 20 },
  { sb: 0, bb: 0, minutes: 10, isBreak: true },
  { sb: 400, bb: 800, minutes: 15 },
  { sb: 500, bb: 1000, minutes: 15 },
  { sb: 700, bb: 1400, minutes: 15 },
  { sb: 1000, bb: 2000, minutes: 15 },
];
