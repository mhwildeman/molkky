"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Cloud, CloudOff, Crown, Download, Plus, RefreshCcw, Save, Trophy, Users } from "lucide-react";
import { createFinal, createSemifinals, createTournament, getGameWinner, getStandings, isGameComplete, normalizePlayerNames, playerName, recommendedQualificationRounds, updateScore, type Game, type Tournament } from "@/lib/tournament";
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
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Molkky Tournament Director</p>
          <h1>{tournament?.name ?? "Plan the draw, run the rounds, crown the winner"}</h1>
        </div>
        <div className="cloud-state" title={firebaseEnabled ? "Firebase configured" : "Local mode until Firebase env vars are set"}>
          {firebaseEnabled ? <Cloud size={18} /> : <CloudOff size={18} />}
          {firebaseEnabled ? "Firebase ready" : "Local mode"}
        </div>
      </section>

      <section className="hero-grid">
        <div className="setup-panel">
          <div className="panel-heading">
            <Users size={20} />
            <h2>Tournament Setup</h2>
          </div>
          <label>
            Tournament name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Players
            <textarea value={playersText} onChange={(event) => setPlayersText(event.target.value)} />
          </label>
          <div className="setup-row">
            <label>
              Qualification rounds
              <select value={rounds} onChange={(event) => setRounds(Number(event.target.value))}>
                <option value={3}>3 rounds</option>
                <option value={4}>4 rounds</option>
              </select>
            </label>
            <div className="metric">
              <strong>{playerNames.length}</strong>
              <span>players</span>
            </div>
          </div>
          <div className="action-row">
            <button onClick={startTournament}>
              <Plus size={18} />
              Generate
            </button>
            <button className="secondary" onClick={() => setPlayersText(samplePlayers)}>
              <RefreshCcw size={18} />
              Sample
            </button>
          </div>
          <p className="status-line">{status}</p>
        </div>

        <div className="field-visual" aria-label="Four Molkky fields">
          <img src="/field-map.svg" alt="" />
          <div className="field-copy">
            <span>4 fields live at once</span>
            <strong>{qualificationGames.length || "No"} qualification games</strong>
          </div>
        </div>
      </section>

      {tournament && (
        <>
          <section className="toolbar">
            <button onClick={persistTournament}>
              <Save size={18} />
              Save
            </button>
            <button className="secondary" onClick={importTournament}>
              <Cloud size={18} />
              Load
            </button>
            <button className="secondary" onClick={exportJson}>
              <Download size={18} />
              Export
            </button>
            <button className="secondary" onClick={() => setTournament(createSemifinals(tournament))}>
              <Trophy size={18} />
              Create semifinals
            </button>
            <button className="secondary" onClick={() => setTournament(createFinal(tournament))}>
              <Crown size={18} />
              Create final
            </button>
          </section>

          <section className="workbench">
            <div className="games-column">
              <Stage title="Qualification" games={qualificationGames} tournament={tournament} onScore={setScore} />
              <Stage title="Semifinals" games={semifinalGames} tournament={tournament} onScore={setScore} />
              <Stage title="Final" games={finalGames} tournament={tournament} onScore={setScore} />
            </div>
            <aside className="standings">
              <div className="panel-heading">
                <CalendarDays size={20} />
                <h2>Qualification Standings</h2>
              </div>
              <div className="standing-list">
                {standings.map((standing, index) => (
                  <div className={index < 16 ? "standing qualified" : "standing"} key={standing.id}>
                    <span>{index + 1}</span>
                    <strong>{standing.name}</strong>
                    <em>{standing.wins}W</em>
                    <small>{standing.points} pts</small>
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
    <section className="stage">
      <h2>{title}</h2>
      <div className="game-grid">
        {games.map((game) => (
          <article className={isGameComplete(game) ? "game complete" : "game"} key={game.id}>
            <div className="game-head">
              <span>Round {game.round}</span>
              <strong>Wave {game.wave} · Field {game.field}</strong>
            </div>
            {game.playerIds.map((playerId) => (
              <label className={getGameWinner(game) === playerId ? "score winner" : "score"} key={playerId}>
                <span>{playerName(tournament.players, playerId)}</span>
                <input
                  min={0}
                  max={50}
                  type="number"
                  inputMode="numeric"
                  value={game.scores[playerId] ?? ""}
                  onChange={(event) => onScore(game.id, playerId, event.target.value)}
                />
              </label>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
