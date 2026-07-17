"use client";

import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import {
  activePlayers,
  currentLevel,
  formatClock,
  nextBlindLevel,
  ordinal,
  placements,
  tick,
  useTournament,
  type TournamentState,
} from "@/lib/store";

export default function DisplayPage() {
  const s = useTournament();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      tick();
      setNow(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, []);

  if (s.showResults) return <ResultsFilm s={s} />;
  return <Dashboard s={s} now={now} />;
}

function Dashboard({ s, now }: { s: TournamentState; now: number }) {
  const level = currentLevel(s);
  const next = nextBlindLevel(s);
  const remaining =
    s.running && s.endsAt !== null ? Math.max(0, s.endsAt - now) : s.remainingMs;
  const urgent = s.running && remaining <= 60_000 && remaining > 0;

  const actives = activePlayers(s);
  const outIds = new Set(s.eliminationOrder);
  const lastOut = s.eliminationOrder.length
    ? s.players.find((p) => p.id === s.eliminationOrder[s.eliminationOrder.length - 1])
    : null;
  const placeMap = placements(s);

  // Scoreliste: alle med en placering, bedste placering øverst
  const standings = [...s.players]
    .filter((p) => placeMap.has(p.id))
    .sort((a, b) => (placeMap.get(a.id) ?? 0) - (placeMap.get(b.id) ?? 0));

  return (
    <div className="display">
      <header className="display-header">
        <Logo size={72} />
        <h1 className="goldtext">{s.title}</h1>
      </header>

      <div className="display-main">
        <div className="display-clockbox">
          <div className="display-levelname">
            {level.isBreak ? "☕ Break" : `Level ${s.levelIndex + 1}`}
          </div>
          <div
            className={`display-clock ${s.running ? "" : "paused"} ${urgent ? "urgent" : ""}`}
          >
            {formatClock(remaining)}
          </div>
          <div className="display-paused-note">{s.running ? "" : "· paused ·"}</div>
        </div>

        <div className="display-blindsbox">
          <div className="label">Blinds</div>
          <div className="display-blinds goldtext">
            {level.isBreak ? "BREAK" : `${level.sb} / ${level.bb}`}
          </div>
          <div className="display-nextblinds">
            {next
              ? next.isBreak
                ? "Next: Break"
                : `Next: ${next.sb} / ${next.bb}`
              : "Final level"}
          </div>
        </div>
      </div>

      <div className="display-stats">
        <div className="stat">
          <div className="value">
            {actives.length}
            <span style={{ opacity: 0.5 }}> / {s.players.length}</span>
          </div>
          <div className="label">Players left</div>
        </div>
        <div className="stat">
          <div className="value">{s.tables.length}</div>
          <div className="label">Tables</div>
        </div>
        <div className="stat">
          <div className="value">{s.eliminationOrder.length}</div>
          <div className="label">Knocked out</div>
        </div>
      </div>

      <div className="display-body">
        <div className="display-tables">
          {s.tables.map((t) => {
            const seated = s.players
              .filter((p) => p.tableId === t.id && !outIds.has(p.id))
              .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
            return (
              <div key={t.id} className="display-table">
                <h3>
                  {t.name} <span className="n">{seated.length}</span>
                </h3>
                <ul>
                  {seated.map((p) => (
                    <li key={p.id}>
                      <span className="seatno">{p.seat ?? "·"}</span>
                      {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {standings.length > 0 && (
          <aside className="display-standings">
            <h3>🏅 Standings</h3>
            <ul>
              {standings.map((p) => (
                <li key={p.id}>
                  <span className="placeno">{ordinal(placeMap.get(p.id)!)}</span>
                  <span className="pname">{p.name}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      <footer className="display-footer">
        {lastOut && (
          <>
            Last out: <span className="outname">{lastOut.name}</span> (
            {ordinal(placeMap.get(lastOut.id) ?? 0)})
          </>
        )}
      </footer>
    </div>
  );
}

// ==================== RESULTS FILM ====================
//
// Plays automatically: intro → placements revealed one at a
// time from last place upwards → podium with top 3 + confetti.

function ResultsFilm({ s }: { s: TournamentState }) {
  const placeMap = placements(s);
  const standings = useMemo(() => {
    return [...s.players]
      .filter((p) => placeMap.has(p.id))
      .map((p) => ({ name: p.name, place: placeMap.get(p.id)! }))
      .sort((a, b) => b.place - a.place); // last place first
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.players, s.eliminationOrder]);

  // step 0 = intro, then one per reveal, finally the podium
  const [step, setStep] = useState(0);
  const reveals = standings.filter((x) => x.place > 3);
  const totalSteps = 1 + reveals.length + 1;

  useEffect(() => {
    if (step >= totalSteps - 1) return;
    const delay = step === 0 ? 3000 : 2400;
    const id = setTimeout(() => setStep((x) => x + 1), delay);
    return () => clearTimeout(id);
  }, [step, totalSteps]);

  const top = (place: number) => standings.find((x) => x.place === place);
  const showingPodium = step >= totalSteps - 1;
  const revealing = !showingPodium && step >= 1 ? reveals[step - 1] : null;

  return (
    <div className="film">
      {showingPodium && <Confetti />}

      {step === 0 && (
        <>
          <Logo size={110} />
          <div className="film-title goldtext" style={{ marginTop: "3vh" }}>
            {s.title}
          </div>
          <div className="film-sub">The results…</div>
        </>
      )}

      {revealing && (
        <div className="film-reveal" key={revealing.place}>
          <div className="film-place">{ordinal(revealing.place)} place</div>
          <div className="film-name">{revealing.name}</div>
        </div>
      )}

      {showingPodium && (
        <>
          <div className="film-title goldtext">The Winners</div>
          <div className="film-podium">
            <div className="podium-col second">
              <div className="p-name">{top(2)?.name ?? "—"}</div>
              <div className="p-block">2</div>
            </div>
            <div className="podium-col first">
              <div className="p-name">🏆 {top(1)?.name ?? "—"}</div>
              <div className="p-block">1</div>
            </div>
            <div className="podium-col third">
              <div className="p-name">{top(3)?.name ?? "—"}</div>
              <div className="p-block">3</div>
            </div>
          </div>
          {standings.length > 3 && (
            <div className="film-list">
              {[...standings]
                .sort((a, b) => a.place - b.place)
                .map((x) => (
                  <div key={x.place}>
                    <span className="placeno">{x.place}.</span>
                    <b>{x.name}</b>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CONFETTI_COLORS = ["#f5b301", "#e8820c", "#ffffff", "#0e8f5b", "#ffd966"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        left: (i * 37) % 100,
        size: 6 + ((i * 13) % 8),
        delay: ((i * 53) % 40) / 10,
        duration: 4 + ((i * 29) % 30) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );
  return (
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </>
  );
}
