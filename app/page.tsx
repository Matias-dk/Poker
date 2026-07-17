"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "@/components/Logo";
import {
  activePlayers,
  addLevelRow,
  addPlayers,
  addTable,
  currentLevel,
  drawSeats,
  eliminatePlayer,
  formatClock,
  fullReset,
  movePlayer,
  nextBlindLevel,
  nextLevel,
  ordinal,
  pauseTimer,
  useSyncStatus,
  placements,
  prevLevel,
  removeLevelRow,
  removePlayer,
  removeTable,
  resetLevelClock,
  resetTournament,
  setFilmTop,
  setShowResults,
  startTimer,
  tick,
  undoElimination,
  updateLevel,
  updateTable,
  useTournament,
} from "@/lib/store";

export default function AdminPage() {
  const s = useTournament();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      tick();
      setNow(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, []);

  const actives = activePlayers(s);
  const placeMap = placements(s);
  const eliminated = [...s.eliminationOrder]
    .reverse()
    .map((id) => s.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="admin">
      <header className="admin-header">
        <Logo size={54} />
        <div>
          <h1 className="goldtext">{s.title}</h1>
          <div className="sub">Control panel — run the tournament from here</div>
        </div>
        <SyncPill />
        <div className="spacer" />
        <a href="/display" target="_blank" rel="noopener">
          <button className="btn primary big">Open big screen ↗</button>
        </a>
      </header>

      <div className="grid">
        <div>
          <ClockPanel s={s} now={now} />
          <LevelsPanel s={s} />
          <ResultsPanel s={s} placeMap={placeMap} eliminated={eliminated} />
        </div>
        <div>
          <PlayersPanel s={s} actives={actives} placeMap={placeMap} />
          <TablesPanel s={s} />
        </div>
      </div>
    </div>
  );
}

type S = ReturnType<typeof useTournament>;

function SyncPill() {
  const sync = useSyncStatus();
  if (sync === "checking") {
    return (
      <span className="sync-pill">
        <span className="dot" /> checking sync…
      </span>
    );
  }
  return sync === "on" ? (
    <span className="sync-pill on" title="Dealer phone links work across devices">
      <span className="dot" /> Multi-device sync on
    </span>
  ) : (
    <span
      className="sync-pill off"
      title="Add the Upstash Redis integration on Vercel to let dealer phones connect"
    >
      <span className="dot" /> This computer only
    </span>
  );
}

function ClockPanel({ s, now }: { s: S; now: number }) {
  const level = currentLevel(s);
  const next = nextBlindLevel(s);
  const remaining = s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;

  return (
    <div className="panel">
      <h2>Clock &amp; blinds</h2>
      <div className="clock-level">
        {level.isBreak ? "Break" : `Level ${s.levelIndex + 1}`} of {s.levels.length}
      </div>
      <div className={`clock-time ${s.running ? "" : "paused"}`}>
        {formatClock(remaining)}
      </div>
      <div className="clock-blinds">
        {level.isBreak ? "— BREAK —" : `Blinds ${level.sb} / ${level.bb}`}
      </div>
      <div className="clock-next">
        {next
          ? next.isBreak
            ? "Next: Break"
            : `Next: ${next.sb} / ${next.bb}`
          : "Final level"}
      </div>
      <div className="row">
        {s.running ? (
          <button className="btn big" onClick={pauseTimer}>
            ⏸ Pause
          </button>
        ) : (
          <button className="btn primary big" onClick={startTimer}>
            ▶ Start
          </button>
        )}
        <button className="btn" onClick={prevLevel} disabled={s.levelIndex === 0}>
          ◀ Previous
        </button>
        <button
          className="btn"
          onClick={nextLevel}
          disabled={s.levelIndex >= s.levels.length - 1}
        >
          Next level ▶
        </button>
        <button className="btn" onClick={resetLevelClock}>
          ↺ Reset clock
        </button>
      </div>
      <div className="hint">
        The clock advances to the next level automatically when time runs out.
        Raise the blinds manually with “Next level”.
      </div>
    </div>
  );
}

function LevelsPanel({ s }: { s: S }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <h2>
        Blind structure
        <button className="btn small" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Edit"}
        </button>
      </h2>
      {open && (
        <>
          <table className="levels-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Small</th>
                <th>Big</th>
                <th>Min.</th>
                <th>Break</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {s.levels.map((l, i) => (
                <tr key={i} className={i === s.levelIndex ? "active-level" : ""}>
                  <td>{i + 1}</td>
                  <td>
                    <input
                      type="number"
                      value={l.sb}
                      disabled={l.isBreak}
                      onChange={(e) => updateLevel(i, { sb: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={l.bb}
                      disabled={l.isBreak}
                      onChange={(e) => updateLevel(i, { bb: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={l.minutes}
                      onChange={(e) =>
                        updateLevel(i, { minutes: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(l.isBreak)}
                      onChange={(e) => updateLevel(i, { isBreak: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn small danger"
                      onClick={() => removeLevelRow(i)}
                      disabled={s.levels.length <= 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn small" onClick={addLevelRow}>
              + Add level
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function PlayersPanel({
  s,
  actives,
  placeMap,
}: {
  s: S;
  actives: ReturnType<typeof activePlayers>;
  placeMap: Map<string, number>;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function submitNames() {
    addPlayers(text.split(/\r?\n|,|;/));
    setText("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    addPlayers(content.split(/\r?\n|,|;/));
    if (fileRef.current) fileRef.current.value = "";
  }

  const outIds = new Set(s.eliminationOrder);

  return (
    <div className="panel">
      <h2>
        Players{" "}
        <span className="count">
          {actives.length} of {s.players.length} remaining
        </span>
      </h2>
      <textarea
        className="names"
        placeholder={"One name per line…\nAnna\nBen\nClara"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row">
        <button className="btn primary" onClick={submitNames} disabled={!text.trim()}>
          Add players
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          📄 Upload list (.txt/.csv)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          style={{ display: "none" }}
          onChange={onFile}
        />
      </div>

      <div className="player-list" style={{ marginTop: 14 }}>
        {s.players.length === 0 && (
          <div className="hint">
            No players yet. Paste names above or upload a file — you can also
            hard-code them in <code>data/config.ts</code>.
          </div>
        )}
        {s.players.map((p) => {
          const out = outIds.has(p.id);
          const place = placeMap.get(p.id);
          return (
            <div key={p.id} className={`player-row ${out ? "out" : ""}`}>
              <span className="name">{p.name}</span>
              {out ? (
                <>
                  <span className="badge">{place ? ordinal(place) : "—"} place</span>
                  <button className="btn small" onClick={() => undoElimination(p.id)}>
                    Undo
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="sel"
                    value={p.tableId ?? ""}
                    onChange={(e) => movePlayer(p.id, e.target.value || null)}
                  >
                    <option value="">— no table —</option>
                    {s.tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn small danger" onClick={() => eliminatePlayer(p.id)}>
                    Out
                  </button>
                </>
              )}
              <button
                className="btn small"
                title="Delete this player entirely"
                onClick={() => removePlayer(p.id)}
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TablesPanel({ s }: { s: S }) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(8);
  const outIds = new Set(s.eliminationOrder);

  return (
    <div className="panel">
      <h2>
        Tables <span className="count">{s.tables.length}</span>
      </h2>
      <div className="row">
        <input
          className="text"
          placeholder={`Table ${s.tables.length + 1}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="num"
          type="number"
          min={2}
          max={12}
          value={capacity}
          onChange={(e) => setCapacity(Math.max(2, Number(e.target.value) || 2))}
          title="Number of seats"
        />
        <button
          className="btn primary"
          onClick={() => {
            addTable(name, capacity);
            setName("");
          }}
        >
          + Create table
        </button>
        <button className="btn" onClick={drawSeats} disabled={!s.tables.length}>
          🎲 Random seat draw
        </button>
      </div>

      <div className="table-cards" style={{ marginTop: 14 }}>
        {s.tables.map((t) => {
          const seated = s.players
            .filter((p) => p.tableId === t.id && !outIds.has(p.id))
            .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
          return (
            <div key={t.id} className="table-card">
              <h3>
                {t.name}
                <span className="cap">
                  {seated.length}/
                  <input
                    className="cap-input"
                    type="number"
                    min={2}
                    max={12}
                    value={t.capacity}
                    title="Number of seats — change any time"
                    onChange={(e) =>
                      updateTable(t.id, {
                        capacity: Math.max(2, Number(e.target.value) || 2),
                      })
                    }
                  />{" "}
                  seats{" "}
                  <button className="btn small danger" onClick={() => removeTable(t.id)}>
                    ✕
                  </button>
                </span>
              </h3>
              {seated.length === 0 && <div className="hint">Empty table</div>}
              {seated.map((p) => (
                <div key={p.id} className="seat-row">
                  <span className="seat-no">{p.seat ?? "·"}</span>
                  <span className="name">{p.name}</span>
                  <button className="btn small danger" onClick={() => eliminatePlayer(p.id)}>
                    Out
                  </button>
                </div>
              ))}
              <TableLink tableId={t.id} />
            </div>
          );
        })}
      </div>
      {s.tables.length === 0 && (
        <div className="hint">
          Create one or more tables and press “Random seat draw” to seat all
          players.
        </div>
      )}
    </div>
  );
}

function TableLink({ tableId }: { tableId: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/table/${tableId}`;

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt("Copy the dealer link:", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="table-link">
      <span title="Dealer link — open on the dealer's phone">📱</span>
      <code>{path}</code>
      <button className="btn small" onClick={copy}>
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}

function ResultsPanel({
  s,
  placeMap,
  eliminated,
}: {
  s: S;
  placeMap: Map<string, number>;
  eliminated: { id: string; name: string }[];
}) {
  const done = s.players.length > 1 && s.eliminationOrder.length >= s.players.length - 1;
  const standings = [...s.players]
    .filter((p) => placeMap.has(p.id))
    .sort((a, b) => (placeMap.get(a.id) ?? 0) - (placeMap.get(b.id) ?? 0));

  return (
    <div className="panel">
      <h2>Results</h2>
      {done ? (
        <div className="hint" style={{ marginTop: 0 }}>
          🏆 The tournament is decided!
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 0 }}>
          Placements are recorded automatically when players are knocked out.
          {eliminated.length > 0 && ` ${eliminated.length} out so far.`}
        </div>
      )}

      {standings.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {standings.slice(0, 10).map((p) => (
            <div key={p.id} className="player-row">
              <span className="badge">{ordinal(placeMap.get(p.id)!)}</span>
              <span className="name">{p.name}</span>
            </div>
          ))}
          {standings.length > 10 && (
            <div className="hint">… and {standings.length - 10} more</div>
          )}
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <label className="hint" style={{ marginTop: 0 }} htmlFor="film-top">
          Film counts down from:
        </label>
        <select
          id="film-top"
          className="sel"
          value={s.filmTop}
          onChange={(e) => setFilmTop(Number(e.target.value))}
        >
          <option value={0}>All places</option>
          <option value={20}>Top 20</option>
          <option value={10}>Top 10</option>
          <option value={5}>Top 5</option>
          <option value={3}>Podium only</option>
        </select>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {s.showResults ? (
          <button className="btn" onClick={() => setShowResults(false)}>
            ⏹ Hide results film
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={() => setShowResults(true)}
            disabled={s.eliminationOrder.length === 0}
          >
            🎬 Play results film on big screen
          </button>
        )}
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Reset the tournament? Players, tables and blinds are kept.")) {
              resetTournament();
            }
          }}
        >
          ↺ Reset tournament
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Delete EVERYTHING (players, tables, results) and start over?")) {
              fullReset();
            }
          }}
        >
          🗑 Delete everything
        </button>
      </div>
    </div>
  );
}
