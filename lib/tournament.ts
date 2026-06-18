export type Stage = "qualification" | "semifinal" | "final";

export type Player = {
  id: string;
  name: string;
};

export type Game = {
  id: string;
  stage: Stage;
  round: number;
  wave: number;
  field: number;
  playerIds: string[];
  scores: Record<string, number>;
};

export type Tournament = {
  id: string;
  name: string;
  createdAt: string;
  players: Player[];
  qualificationRounds: number;
  games: Game[];
};

export type Standing = Player & {
  gamesPlayed: number;
  wins: number;
  points: number;
  totalScore: number;
  averageScore: number;
};

const FIELDS = 4;
const QUALIFYING_SLOTS = 16;

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizePlayerNames(input: string) {
  return input
    .split(/\n|,/)
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index);
}

export function recommendedQualificationRounds(playerCount: number) {
  return playerCount > 32 ? 4 : 3;
}

export function createTournament(name: string, playerNames: string[], rounds = recommendedQualificationRounds(playerNames.length)): Tournament {
  const players = playerNames.map((playerName) => ({
    id: createId("player"),
    name: playerName,
  }));

  return {
    id: createId("tournament"),
    name: name.trim() || "Molkky Tournament",
    createdAt: new Date().toISOString(),
    players,
    qualificationRounds: rounds,
    games: generateQualificationGames(players, rounds),
  };
}

export function generateQualificationGames(players: Player[], rounds: number) {
  const allGames: Game[] = [];
  const pairHistory = new Map<string, number>();
  const previousRoundGroups = new Map<string, number>();

  for (let round = 1; round <= rounds; round += 1) {
    const shuffled = seededShuffle(players, `round-${round}`);
    const groups: Player[][] = [];
    const sizes = groupSizes(players.length);

    for (const size of sizes) {
      const remaining = shuffled.filter(
        (player) => !groups.some((group) => group.some((member) => member.id === player.id)),
      );
      const group = pickGroup(remaining, size, pairHistory, previousRoundGroups);
      if (group.length < 3) break;
      groups.push(group);
      group.forEach((player) => previousRoundGroups.set(player.id, groups.length));
    }

    groups.forEach((group, index) => {
      registerPairs(group, pairHistory);
      allGames.push({
        id: `qual-${round}-${index + 1}`,
        stage: "qualification",
        round,
        wave: Math.floor(index / FIELDS) + 1,
        field: (index % FIELDS) + 1,
        playerIds: group.map((player) => player.id),
        scores: {},
      });
    });
  }

  return allGames;
}

export function createSemifinals(tournament: Tournament): Tournament {
  const standings = getStandings(tournament).slice(0, QUALIFYING_SLOTS);
  const games: Game[] = [];

  for (let index = 0; index < 4; index += 1) {
    const group = [standings[index], standings[15 - index], standings[4 + index], standings[11 - index]].filter(Boolean);
    if (group.length >= 3) {
      games.push({
        id: `semi-1-${index + 1}`,
        stage: "semifinal",
        round: 1,
        wave: 1,
        field: index + 1,
        playerIds: group.map((player) => player.id),
        scores: {},
      });
    }
  }

  return {
    ...tournament,
    games: [...tournament.games.filter((game) => game.stage !== "semifinal" && game.stage !== "final"), ...games],
  };
}

export function createFinal(tournament: Tournament): Tournament {
  const semifinals = tournament.games.filter((game) => game.stage === "semifinal");
  const finalists = semifinals.map((game) => getGameWinner(game)).filter((id): id is string => Boolean(id));

  if (finalists.length < 3) return tournament;

  return {
    ...tournament,
    games: [
      ...tournament.games.filter((game) => game.stage !== "final"),
      {
        id: "final-1-1",
        stage: "final",
        round: 1,
        wave: 1,
        field: 1,
        playerIds: finalists,
        scores: {},
      },
    ],
  };
}

export function updateScore(tournament: Tournament, gameId: string, playerId: string, score: number): Tournament {
  return {
    ...tournament,
    games: tournament.games.map((game) =>
      game.id === gameId
        ? {
            ...game,
            scores: {
              ...game.scores,
              [playerId]: Number.isFinite(score) ? score : 0,
            },
          }
        : game,
    ),
  };
}

export function getStandings(tournament: Tournament): Standing[] {
  const table = new Map<string, Standing>();

  tournament.players.forEach((player) => {
    table.set(player.id, {
      ...player,
      gamesPlayed: 0,
      wins: 0,
      points: 0,
      totalScore: 0,
      averageScore: 0,
    });
  });

  tournament.games
    .filter((game) => game.stage === "qualification")
    .forEach((game) => {
      const winner = getGameWinner(game);
      game.playerIds.forEach((playerId) => {
        const standing = table.get(playerId);
        if (!standing) return;
        const score = game.scores[playerId];
        if (typeof score !== "number") return;
        standing.gamesPlayed += 1;
        standing.totalScore += score;
        standing.points += score;
        if (winner === playerId) standing.wins += 1;
      });
    });

  return [...table.values()]
    .map((standing) => ({
      ...standing,
      averageScore: standing.gamesPlayed ? Math.round((standing.totalScore / standing.gamesPlayed) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.points - a.points || b.averageScore - a.averageScore || a.name.localeCompare(b.name));
}

export function getGameWinner(game: Game) {
  return game.playerIds
    .filter((playerId) => typeof game.scores[playerId] === "number")
    .sort((a, b) => game.scores[b] - game.scores[a])[0];
}

export function isGameComplete(game: Game) {
  return game.playerIds.every((playerId) => typeof game.scores[playerId] === "number");
}

export function playerName(players: Player[], id: string) {
  return players.find((player) => player.id === id)?.name ?? "Unknown player";
}

function pickGroup(players: Player[], size: number, pairHistory: Map<string, number>, previousRoundGroups: Map<string, number>) {
  const candidates = combinations(players, size);
  const sorted = candidates.sort((a, b) => scoreGroup(a, pairHistory, previousRoundGroups) - scoreGroup(b, pairHistory, previousRoundGroups));
  return sorted[0] ?? players.slice(0, size);
}

function scoreGroup(group: Player[], pairHistory: Map<string, number>, previousRoundGroups: Map<string, number>) {
  let score = 0;
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      score += (pairHistory.get(pairKey(group[i].id, group[j].id)) ?? 0) * 10;
      if (previousRoundGroups.get(group[i].id) === previousRoundGroups.get(group[j].id)) score += 3;
    }
  }
  return score;
}

function registerPairs(group: Player[], pairHistory: Map<string, number>) {
  for (let i = 0; i < group.length; i += 1) {
    for (let j = i + 1; j < group.length; j += 1) {
      const key = pairKey(group[i].id, group[j].id);
      pairHistory.set(key, (pairHistory.get(key) ?? 0) + 1);
    }
  }
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function seededShuffle<T>(items: T[], seed: string) {
  return [...items]
    .map((item, index) => ({ item, sort: Math.sin(hash(`${seed}-${index}`)) }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function groupSizes(playerCount: number) {
  if (playerCount < 3) return [];
  const sizes: number[] = [];
  let remaining = playerCount;

  while (remaining > 0) {
    if (remaining === 3 || remaining === 4) {
      sizes.push(remaining);
      remaining = 0;
    } else if (remaining === 5) {
      sizes.push(3);
      remaining -= 3;
    } else if (remaining === 6) {
      sizes.push(3, 3);
      remaining = 0;
    } else if (remaining === 7) {
      sizes.push(4, 3);
      remaining = 0;
    } else if (remaining % 4 === 1) {
      sizes.push(3);
      remaining -= 3;
    } else {
      sizes.push(4);
      remaining -= 4;
    }
  }

  return sizes;
}

function hash(value: string) {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) {
    output = (output << 5) - output + value.charCodeAt(index);
    output |= 0;
  }
  return output || 1;
}

function combinations<T>(items: T[], size: number) {
  const result: T[][] = [];
  const limit = 240;

  function walk(start: number, group: T[]) {
    if (result.length >= limit) return;
    if (group.length === size) {
      result.push(group);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      walk(index + 1, [...group, items[index]]);
    }
  }

  walk(0, []);
  return result;
}
