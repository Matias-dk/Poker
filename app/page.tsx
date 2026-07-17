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
  pauseTimer,
  placements,
  prevLevel,
  removeLevelRow,
  removePlayer,
  removeTable,
  resetLevelClock,
  resetTournament,
  setShowResults,
  startTimer,
  tick,
  undoElimination,
  updateLevel,
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
          <div className="sub">Kontrolpanel — styr turneringen herfra</div>
        </div>
        <div className="spacer" />
        <a href="/display" target="_blank" rel="noopener">
          <button className="btn primary big">Åbn storskærm ↗</button>
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

function ClockPanel({ s, now }: { s: S; now: number }) {
  const level = currentLevel(s);
  const next = nextBlindLevel(s);
  const remaining = s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;

  return (
    <div className="panel">
      <h2>Ur &amp; blinds</h2>
      <div className="clock-level">
        {level.isBreak ? "Pause" : `Niveau ${s.levelIndex + 1}`} af {s.levels.length}
      </div>
      <div className={`clock-time ${s.running ? "" : "paused"}`}>
        {formatClock(remaining)}
      </div>
      <div className="clock-blinds">
        {level.isBreak ? "— PAUSE —" : `Blinds ${level.sb} / ${level.bb}`}
      </div>
      <div className="clock-next">
        {next
          ? next.isBreak
            ? "Næste: Pause"
            : `Næste: ${next.sb} / ${next.bb}`
          : "Sidste niveau"}
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
          ◀ Forrige
        </button>
        <button
          className="btn"
          onClick={nextLevel}
          disabled={s.levelIndex >= s.levels.length - 1}
        >
          Næste niveau ▶
        </button>
        <button className="btn" onClick={resetLevelClock}>
          ↺ Nulstil ur
        </button>
      </div>
      <div className="hint">
        Uret skifter selv til næste niveau, når tiden løber ud. Blinds hæves
        med “Næste niveau”.
      </div>
    </div>
  );
}

function LevelsPanel({ s }: { s: S }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <h2>
        Blind-struktur
        <button className="btn small" onClick={() => setOpen(!open)}>
          {open ? "Skjul" : "Redigér"}
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
                <th>Pause</th>
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
              + Tilføj niveau
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
        Deltagere{" "}
        <span className="count">
          {actives.length} tilbage af {s.players.length}
        </span>
      </h2>
      <textarea
        className="names"
        placeholder={"Ét navn pr. linje…\nAnna\nBo\nClara"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row">
        <button className="btn primary" onClick={submitNames} disabled={!text.trim()}>
          Tilføj deltagere
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          📄 Upload liste (.txt/.csv)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          style={{ display: "none" }}
          onChange={onFile}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        {s.players.length === 0 && (
          <div className="hint">
            Ingen deltagere endnu. Indsæt navne ovenfor eller upload en fil —
            du kan også skrive dem fast ind i <code>data/config.ts</code>.
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
                  <span className="badge">{place}. plads</span>
                  <button className="btn small" onClick={() => undoElimination(p.id)}>
                    Fortryd
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="sel"
                    value={p.tableId ?? ""}
                    onChange={(e) => movePlayer(p.id, e.target.value || null)}
                  >
                    <option value="">— intet bord —</option>
                    {s.tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn small danger" onClick={() => eliminatePlayer(p.id)}>
                    Ude
                  </button>
                </>
              )}
              <button
                className="btn small"
                title="Slet deltageren helt"
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
        Borde <span className="count">{s.tables.length}</span>
      </h2>
      <div className="row">
        <input
          className="text"
          placeholder={`Bord ${s.tables.length + 1}`}
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
          title="Antal pladser"
        />
        <button
          className="btn primary"
          onClick={() => {
            addTable(name, capacity);
            setName("");
          }}
        >
          + Opret bord
        </button>
        <button className="btn" onClick={drawSeats} disabled={!s.tables.length}>
          🎲 Fordel pladser tilfældigt
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
                  {seated.length}/{t.capacity} pladser{" "}
                  <button className="btn small danger" onClick={() => removeTable(t.id)}>
                    ✕
                  </button>
                </span>
              </h3>
              {seated.length === 0 && <div className="hint">Tomt bord</div>}
              {seated.map((p) => (
                <div key={p.id} className="seat-row">
                  <span className="seat-no">{p.seat ?? "·"}</span>
                  <span className="name">{p.name}</span>
                  <button className="btn small danger" onClick={() => eliminatePlayer(p.id)}>
                    Ude
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {s.tables.length === 0 && (
        <div className="hint">
          Opret et eller flere borde og tryk “Fordel pladser tilfældigt” for at
          trække pladser til alle deltagere.
        </div>
      )}
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
      <h2>Resultat</h2>
      {done ? (
        <div className="hint" style={{ marginTop: 0 }}>
          🏆 Turneringen er afgjort!
        </div>
      ) : (
        <div className="hint" style={{ marginTop: 0 }}>
          Placeringer registreres automatisk, når spillere meldes ude.
          {eliminated.length > 0 && ` ${eliminated.length} er ude indtil videre.`}
        </div>
      )}

      {standings.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {standings.slice(0, 10).map((p) => (
            <div key={p.id} className="player-row">
              <span className="badge">{placeMap.get(p.id)}.</span>
              <span className="name">{p.name}</span>
            </div>
          ))}
          {standings.length > 10 && (
            <div className="hint">… og {standings.length - 10} flere</div>
          )}
        </div>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        {s.showResults ? (
          <button className="btn" onClick={() => setShowResults(false)}>
            ⏹ Skjul resultat-film
          </button>
        ) : (
          <button
            className="btn primary"
            onClick={() => setShowResults(true)}
            disabled={s.eliminationOrder.length === 0}
          >
            🎬 Vis resultat-film på storskærm
          </button>
        )}
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Nulstil turneringen? Deltagere, borde og blinds beholdes.")) {
              resetTournament();
            }
          }}
        >
          ↺ Nulstil turnering
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm("Slet ALT (deltagere, borde, resultater) og start forfra?")) {
              fullReset();
            }
          }}
        >
          🗑 Slet alt
        </button>
      </div>
    </div>
  );
}
