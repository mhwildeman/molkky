"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Cloud, CloudOff, Crown, Download, Plus, RefreshCcw, Save, Trophy, Users } from "lucide-react";
import {
  createFinal,
  createSemifinals,
  createTournament,
  getGameWinner,
  getStandings,
  isGameComplete,
  normalizePlayerNames,
  playerName,
  recommendedQualificationRounds,
  updateScore,
  type Game,
  type Tournament,
} from "@/lib/tournament";
import { firebaseEnabled, loadTournament, saveTournament } from "@/lib/firebase";

const samplePlayers = [
  "Anna",
  "Bas",
  "Carla",
  "David",
  "Eva",
  "Finn",
  "Gina",
  "Hugo",
  "Iris",
  "Jules",
  "Karin",
  "Leo",
  "Mila",
  "Nora",
  "Oscar",
  "Pia",
  "Quinten",
  "Rosa",
  "Sam",
  "Tess",
  "Umar",
  "Vera",
  "Wout",
  "Yara",
].join("\n");

const storageKey = "molkky-current-tournament";
const inputClass =
  "w-full rounded-md border border-field-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-field-700 focus:ring-4 focus:ring-field-700/10";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-field-700 px-4 text-sm font-bold text-white transition hover:bg-zinc-950";
const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-field-200 bg-white px-4 text-sm font-bold text-zinc-900 transition hover:border-field-500 hover:bg-field-50";

export default function Home() {
  const [name, setName] = useState("Saturday Molkky Open");
  const [playersText, setPlayersText] = useState(samplePlayers);
  const [rounds, setRounds] = useState(3);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [status, setStatus] = useState("Local draft ready");

  const playerNames = useMemo(() => normalizePlayerNames(playersText), [playersText]);
  const standings = useMemo(() => (tournament ? getStandings(tournament) : []), [tournament]);
  const qualificationGames = tournament?.games.filter((game) => game.stage === "qualification") ?? [];
  const semifinalGames = tournament?.games.filter((game) => game.stage === "semifinal") ?? [];
  const finalGames = tournament?.games.filter((game) => game.stage === "final") ?? [];

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      setTournament(JSON.parse(saved) as Tournament);
      setStatus("Loaded from this browser");
    }
  }, []);

  useEffect(() => {
    setRounds(recommendedQualificationRounds(playerNames.length));
  }, [playerNames.length]);

  useEffect(() => {
    if (tournament) window.localStorage.setItem(storageKey, JSON.stringify(tournament));
  }, [tournament]);

  function startTournament() {
    if (playerNames.length < 12) {
      setStatus("Add at least 12 players for a useful four-field tournament.");
      return;
    }
    const next = createTournament(name, playerNames, rounds);
    setTournament(next);
    setStatus(`${next.players.length} players scheduled across ${rounds} qualification rounds`);
  }

  async function persistTournament() {
    if (!tournament) return;
    await saveTournament(tournament);
    setStatus(firebaseEnabled ? `Saved to Firebase: ${tournament.id}` : "Firebase env vars are missing, saved locally only");
  }

  async function importTournament() {
    const id = window.prompt("Tournament id");
    if (!id) return;
    const remote = await loadTournament(id);
    if (remote) {
      setTournament(remote);
      setStatus(`Loaded ${remote.name} from Firebase`);
    } else {
      setStatus("No Firebase tournament found for that id");
    }
  }

  function setScore(gameId: string, playerId: string, value: string) {
    if (!tournament) return;
    setTournament(updateScore(tournament, gameId, playerId, Number(value)));
  }

  function exportJson() {
    if (!tournament) return;
    const blob = new Blob([JSON.stringify(tournament, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tournament.name.toLowerCase().replace(/\W+/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-field-200 bg-white p-4 shadow-sm lg:p-5">
        <div className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-field-700">Molkky Tournament Director</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-black leading-none tracking-normal text-zinc-950 sm:text-5xl">
                {tournament?.name ?? "Run the tournament without losing the plot"}
              </h1>
            </div>
            <div
              className="inline-flex h-10 items-center gap-2 rounded-md border border-field-200 bg-field-50 px-3 text-sm font-bold text-zinc-800"
              title={firebaseEnabled ? "Firebase configured" : "Local mode until Firebase env vars are set"}
            >
              {firebaseEnabled ? <Cloud size={17} /> : <CloudOff size={17} />}
              {firebaseEnabled ? "Firebase ready" : "Local mode"}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="flex items-center gap-2 text-zinc-950">
              <Users size={20} />
              <h2 className="text-lg font-black">Tournament Setup</h2>
            </div>
            <label className="grid gap-2 text-sm font-bold text-zinc-600">
              Tournament name
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-600">
              Players
              <textarea className={`${inputClass} min-h-56 resize-y`} value={playersText} onChange={(event) => setPlayersText(event.target.value)} />
            </label>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
              <label className="grid gap-2 text-sm font-bold text-zinc-600">
                Qualification rounds
                <select className={inputClass} value={rounds} onChange={(event) => setRounds(Number(event.target.value))}>
                  <option value={3}>3 rounds</option>
                  <option value={4}>4 rounds</option>
                </select>
              </label>
              <div className="grid h-16 min-w-24 place-items-center rounded-md border border-field-200 bg-field-50 px-4 text-center">
                <strong className="text-2xl leading-none text-zinc-950">{playerNames.length}</strong>
                <span className="text-xs font-bold uppercase text-zinc-500">players</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={primaryButton} onClick={startTournament}>
                <Plus size={18} />
                Generate
              </button>
              <button className={secondaryButton} onClick={() => setPlayersText(samplePlayers)}>
                <RefreshCcw size={18} />
                Sample
              </button>
            </div>
            <p className="rounded-md bg-field-50 px-3 py-2 text-sm font-semibold text-zinc-600">{status}</p>
          </div>
        </div>

      </section>

      {tournament && (
        <>
          <section className="flex flex-wrap gap-2 rounded-lg border border-field-200 bg-white p-3 shadow-sm">
            <button className={primaryButton} onClick={persistTournament}>
              <Save size={18} />
              Save
            </button>
            <button className={secondaryButton} onClick={importTournament}>
              <Cloud size={18} />
              Load
            </button>
            <button className={secondaryButton} onClick={exportJson}>
              <Download size={18} />
              Export
            </button>
            <button className={secondaryButton} onClick={() => setTournament(createSemifinals(tournament))}>
              <Trophy size={18} />
              Create semifinals
            </button>
            <button className={secondaryButton} onClick={() => setTournament(createFinal(tournament))}>
              <Crown size={18} />
              Create final
            </button>
          </section>

          <section className="grid items-start gap-5 xl:grid-cols-[1fr_390px]">
            <div className="grid gap-5">
              <Stage title="Qualification" games={qualificationGames} tournament={tournament} onScore={setScore} />
              <Stage title="Semifinals" games={semifinalGames} tournament={tournament} onScore={setScore} />
              <Stage title="Final" games={finalGames} tournament={tournament} onScore={setScore} />
            </div>
            <aside className="rounded-lg border border-field-200 bg-white p-4 shadow-sm xl:sticky xl:top-5">
              <div className="flex items-center gap-2">
                <CalendarDays size={20} />
                <h2 className="text-lg font-black text-zinc-950">Qualification Standings</h2>
              </div>
              <div className="mt-4 grid max-h-[calc(100vh-8rem)] gap-2 overflow-auto pr-1">
                {standings.map((standing, index) => (
                  <div
                    className={`grid min-h-11 grid-cols-[2.25rem_minmax(0,1fr)_3.25rem_4.75rem] items-center gap-2 rounded-md border px-3 text-sm ${
                      index < 16 ? "border-wood-500/45 bg-amber-50/55" : "border-field-200 bg-field-50/45"
                    }`}
                    key={standing.id}
                  >
                    <span className="font-black text-zinc-500">{index + 1}</span>
                    <strong className="truncate text-zinc-950">{standing.name}</strong>
                    <em className="not-italic font-black text-wood-700">{standing.wins}W</em>
                    <small className="text-right font-bold text-zinc-500">{standing.points} pts</small>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

function Stage({
  title,
  games,
  tournament,
  onScore,
}: {
  title: string;
  games: Game[];
  tournament: Tournament;
  onScore: (gameId: string, playerId: string, value: string) => void;
}) {
  if (!games.length) return null;

  return (
    <section className="grid gap-4 rounded-lg border border-field-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-zinc-950">{title}</h2>
        <span className="rounded-md bg-field-50 px-3 py-1 text-sm font-bold text-zinc-600">{games.length} games</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {games.map((game) => {
          const winner = getGameWinner(game);
          return (
            <article
              className={`grid gap-3 rounded-lg border p-3 ${
                isGameComplete(game) ? "border-field-500 bg-field-50" : "border-field-200 bg-white"
              }`}
              key={game.id}
            >
              <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="text-sm font-bold text-zinc-500">Round {game.round}</span>
                <strong className="text-sm font-black text-zinc-950">
                  Wave {game.wave} · Field {game.field}
                </strong>
              </div>
              <div className="grid gap-2">
                {game.playerIds.map((playerId) => (
                  <label className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-2" key={playerId}>
                    <span className={`truncate text-sm font-bold ${winner === playerId ? "text-field-700" : "text-zinc-800"}`}>
                      {playerName(tournament.players, playerId)}
                    </span>
                    <input
                      className="w-full rounded-md border border-field-200 bg-white px-2 py-1.5 text-center text-sm font-bold text-zinc-950 outline-none transition focus:border-field-700 focus:ring-4 focus:ring-field-700/10"
                      min={0}
                      max={50}
                      type="number"
                      inputMode="numeric"
                      value={game.scores[playerId] ?? ""}
                      onChange={(event) => onScore(game.id, playerId, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
