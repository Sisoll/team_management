function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function eventStatDelta(eventType) {
  switch (eventType) {
    case "single":
      return { hits: 1, totalBases: 1, runsBattedIn: 0 };
    case "double":
      return { hits: 1, totalBases: 2, runsBattedIn: 1 };
    case "triple":
      return { hits: 1, totalBases: 3, runsBattedIn: 1 };
    case "home-run":
    case "walkoff":
      return { hits: 1, totalBases: 4, runsBattedIn: 1 };
    default:
      return { hits: 0, totalBases: 0, runsBattedIn: 0 };
  }
}

export function getEventsForGame(state, gameId) {
  return safeArray(state.events).filter((event) => event.gameId === gameId).sort((a, b) => a.sequenceNo - b.sequenceNo);
}

export function summarizeGame(game, events = []) {
  const confirmedEvents = events.filter((event) => event.reviewStatus !== "pending");
  const score = confirmedEvents.reduce(
    (totals, event) => {
      totals.team += event.scoreDelta?.team || 0;
      totals.opponent += event.scoreDelta?.opponent || 0;
      return totals;
    },
    { team: 0, opponent: 0 }
  );
  const latestEvent = events[events.length - 1];
  return {
    totalEvents: events.length,
    confirmedEvents: confirmedEvents.length,
    pendingEvents: events.length - confirmedEvents.length,
    teamScore: score.team,
    opponentScore: score.opponent,
    inningText: latestEvent?.snapshotAfter?.inningText || "未開賽",
    outsAfter: latestEvent?.outsAfter ?? 0,
    basesAfter: latestEvent?.basesAfter || { first: null, second: null, third: null },
    scoreText: `${score.team} : ${score.opponent}`,
    latestResolution: game.gameResolution && game.gameResolution !== "pending" ? game.gameResolution : "比賽進行中或待結果"
  };
}

export function buildGameTimeline(events = [], players = []) {
  const playerMap = new Map(players.map((player) => [player.playerId, player]));
  return events.map((event) => {
    const player = playerMap.get(event.actorPlayerId);
    return {
      id: event.eventId,
      title: `${event.snapshotAfter?.inningText || `${event.inning}${event.half}`} · ${event.eventType}`,
      detail: `${player?.displayName || event.actorPlayerId}，比分 ${event.snapshotAfter?.scoreText || "-"}`,
      badge: event.reviewStatus === "pending" ? "待確認" : event.captureSource === "voice" || event.captureSource === "scan" ? `已確認 / ${event.captureSource}` : "已確認"
    };
  });
}

export function buildPlayerStats(state, filters = {}) {
  const games = safeArray(state.games);
  const players = safeArray(state.players);
  const gameMap = new Map(games.map((game) => [game.gameId, game]));
  const playerIdSet = filters.playerIds ? new Set(filters.playerIds) : null;
  const rows = new Map();

  safeArray(state.events).forEach((event) => {
    if (event.reviewStatus === "pending") {
      return;
    }
    const game = gameMap.get(event.gameId);
    if (!game) {
      return;
    }
    if (filters.category && game.competitionCategory !== filters.category) {
      return;
    }
    if (filters.teamId && game.teamId !== filters.teamId) {
      return;
    }
    if (filters.includedOnly && game.standingsInclusionMode !== "included") {
      return;
    }
    if (playerIdSet && !playerIdSet.has(event.actorPlayerId)) {
      return;
    }
    const player = players.find((item) => item.playerId === event.actorPlayerId);
    if (!player) {
      return;
    }
    const current = rows.get(player.playerId) || { playerId: player.playerId, displayName: player.displayName, games: new Set(), hits: 0, totalBases: 0, runsBattedIn: 0 };
    const delta = eventStatDelta(event.eventType);
    current.games.add(event.gameId);
    current.hits += delta.hits;
    current.totalBases += delta.totalBases;
    current.runsBattedIn += delta.runsBattedIn;
    rows.set(player.playerId, current);
  });

  return Array.from(rows.values()).map((row) => ({ playerId: row.playerId, displayName: row.displayName, games: row.games.size, hits: row.hits, totalBases: row.totalBases, runsBattedIn: row.runsBattedIn }));
}

export function buildTeamRecordRows(state, mergeMode = "separate", filters = {}) {
  const grouped = {};
  safeArray(state.games).forEach((game) => {
    if (filters.teamId && game.teamId !== filters.teamId) {
      return;
    }
    const key = mergeMode === "merged" ? "all" : game.competitionCategory;
    if (!grouped[key]) {
      grouped[key] = { category: key, total: 0, included: 0, excluded: 0, special: 0 };
    }
    grouped[key].total += 1;
    if (game.standingsInclusionMode === "included") {
      grouped[key].included += 1;
    } else {
      grouped[key].excluded += 1;
    }
    if (!["pending", "win", "loss", "draw"].includes(game.gameResolution)) {
      grouped[key].special += 1;
    }
  });
  return Object.values(grouped);
}

export function buildReportView(state, options = {}) {
  const category = options.category || "";
  const mergeMode = options.mergeMode || "separate";
  return {
    playerRows: buildPlayerStats(state, { category: category === "all" ? "" : category, includedOnly: false, teamId: options.teamId, playerIds: options.playerIds }),
    includedRecordRows: buildTeamRecordRows(state, mergeMode === "partial" ? "separate" : mergeMode, { teamId: options.teamId }),
    note:
      mergeMode === "separate"
        ? "預設以比賽分類分開顯示，特殊結果預設不納入戰績。"
        : mergeMode === "merged"
          ? "目前為全部合併視圖，請留意特殊結果是否被納入。"
          : "目前為部分合併視圖，可對特定分類做併算比較。"
  };
}
