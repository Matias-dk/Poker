"use client";

// Mobilvenlig dealer-side: ét unikt link pr. bord, hvor dealeren
// kan se bordets spillere og markere dem ude fra sin telefon.

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import {
  addPlayerToTable,
  currentLevel,
  eliminatePlayer,
  formatClock,
  ordinal,
  placements,
  undoElimination,
  useSyncStatus,
  useTournament,
} from "@/lib/store";

export default function TablePage({ params }: { params: { id: string } }) {
  const s = useTournament();
  const sync = useSyncStatus();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const table = s.tables.find((t) => t.id === params.id);
  const level = currentLevel(s);
  const remaining =
    s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;
  const outIds = new Set(s.eliminationOrder);
  const placeMap = placements(s);

  if (!table) {
    return (
      <div className="tablepage">
        <header className="tablepage-header">
          <Logo size={40} />
          <div>
            <h1 className="goldtext">{s.title}</h1>
          </div>
        </header>
        <div className="panel">
          <div className="hint">
            {sync === "checking"
              ? "Loading tournament…"
              : "Table not found. Check the link with the tournament manager."}
          </div>
        </div>
      </div>
    );
  }

  const seated = s.players
    .filter((p) => p.tableId === table.id && !outIds.has(p.id))
    .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
  const recentOutHere = [...s.eliminationOrder]
    .reverse()
    .map((id) => s.players.find((p) => p.id === id))
    .filter((p) => p && p.tableId === table.id)
    .slice(0, 5) as { id: string; name: string }[];

  function markOut(id: string, name: string) {
    if (confirm(`Mark ${name} as OUT?`)) {
      eliminatePlayer(id);
    }
  }

  return (
    <div className="tablepage">
      <header className="tablepage-header">
        <Logo size={40} />
        <div>
          <h1 className="goldtext">{table.name}</h1>
          <div className="sub">
            {level.isBreak ? "Break" : `Blinds ${level.sb} / ${level.bb}`} ·{" "}
            {formatClock(remaining)}
          </div>
        </div>
      </header>

      {sync === "off" && (
        <div className="sync-warning">
          ⚠ Live sync is not configured, so this phone cannot reach the
          tournament. Ask the tournament manager.
        </div>
      )}

      <div className="panel">
        <h2>
          Players <span className="count">{seated.length} left</span>
        </h2>
        {seated.length === 0 && (
          <div className="hint">No active players at this table.</div>
        )}
        {seated.map((p) => (
          <div key={p.id} className="dealer-row">
            <span className="seat-no">{p.seat ?? "·"}</span>
            <span className="name">{p.name}</span>
            <button className="btn danger out-btn" onClick={() => markOut(p.id, p.name)}>
              OUT
            </button>
          </div>
        ))}
        <AddPlayerRow tableId={table.id} full={seated.length >= table.capacity} />
      </div>

      {recentOutHere.length > 0 && (
        <div className="panel">
          <h2>Knocked out here</h2>
          {recentOutHere.map((p) => (
            <div key={p.id} className="dealer-row out">
              <span className="name">{p.name}</span>
              <span className="badge">
                {placeMap.get(p.id) ? ordinal(placeMap.get(p.id)!) : "—"}
              </span>
              <button className="btn small" onClick={() => undoElimination(p.id)}>
                Undo
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPlayerRow({ tableId, full }: { tableId: string; full: boolean }) {
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    addPlayerToTable(trimmed, tableId);
    setName("");
  }

  return (
    <div className="dealer-add">
      <input
        className="text"
        placeholder="Add player at this table…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <button className="btn primary" onClick={submit} disabled={!name.trim()}>
        + Add
      </button>
      {full && (
        <div className="hint" style={{ width: "100%" }}>
          The table is full — a new player still gets the next seat number.
        </div>
      )}
    </div>
  );
}
