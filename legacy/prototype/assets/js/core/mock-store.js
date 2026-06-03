import { getScenarioPreset, loadSeedData } from "./data-loader.js";

const STORAGE_KEY = "baseball-record-prototype-state";

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

let state = loadInitialState();

function loadInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn("loadInitialState fallback", error);
  }
  return loadSeedData();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("persist fallback", error);
  }
}

function getUserFromState(currentState, userId = currentState.meta.currentUserId) {
  return currentState.users.find((user) => user.userId === userId) || currentState.users[0] || null;
}

function getGamesForResolvedTeam(currentState, teamId) {
  return currentState.games.filter((game) => game.teamId === teamId);
}

export function getState() {
  return clone(state);
}

export function commit(updater) {
  const draft = clone(state);
  updater(draft);
  state = draft;
  persist();
  return getState();
}

export function resetState() {
  state = loadSeedData();
  persist();
  return getState();
}

export function setScenario(scenarioId) {
  const preset = getScenarioPreset(scenarioId);
  state = loadSeedData();
  state.meta.currentUserId = preset.currentUserId;
  state.meta.currentTeamId = preset.currentTeamId ?? null;
  state.meta.currentRole = preset.currentRole || (preset.currentTeamId ? "viewer" : "personal");
  state.meta.activeGameId = preset.activeGameId;
  state.meta.currentScenarioId = preset.id;
  persist();
  return getState();
}

export function getJoinedTeams(currentState = state, userId = currentState.meta.currentUserId) {
  const user = getUserFromState(currentState, userId);
  const joinedIds = user?.joinedTeams || [];
  return joinedIds
    .map((teamId) => currentState.teams.find((team) => team.teamId === teamId))
    .filter(Boolean);
}

export function getCurrentTeam(currentState = state, options = {}) {
  const { fallback = true } = options;
  const exact = currentState.teams.find((team) => team.teamId === currentState.meta.currentTeamId) || null;
  if (exact || !fallback) {
    return exact;
  }
  return getJoinedTeams(currentState)[0] || currentState.teams[0] || null;
}

export function getGamesForTeam(currentState = state, teamId = currentState.meta.currentTeamId) {
  if (!teamId) {
    return [];
  }
  return getGamesForResolvedTeam(currentState, teamId);
}

export function getCurrentGame(currentState = state, options = {}) {
  const { teamId = null } = options;
  if (teamId) {
    return currentState.games.find((game) => game.gameId === currentState.meta.activeGameId && game.teamId === teamId) || getGamesForResolvedTeam(currentState, teamId)[0] || null;
  }
  return currentState.games.find((game) => game.gameId === currentState.meta.activeGameId) || currentState.games[0] || null;
}

export function setActiveGame(gameId) {
  return commit((draft) => {
    const game = draft.games.find((item) => item.gameId === gameId);
    if (game) {
      draft.meta.activeGameId = gameId;
    }
  });
}

export function setCurrentUser(userId) {
  return commit((draft) => {
    draft.meta.currentUserId = userId;
    draft.meta.currentTeamId = null;
    draft.meta.currentRole = "personal";
  });
}

export function setCurrentTeam(teamId) {
  return commit((draft) => {
    if (!teamId) {
      draft.meta.currentTeamId = null;
      draft.meta.currentRole = "personal";
      return;
    }
    const joinedTeam = getJoinedTeams(draft).find((team) => team.teamId === teamId);
    if (!joinedTeam) {
      return;
    }
    draft.meta.currentTeamId = teamId;
    const user = getUserFromState(draft);
    const roles = user?.teamRoles?.[teamId] || [];
    draft.meta.currentRole = roles[0] || "viewer";

    const activeGame = draft.games.find((game) => game.gameId === draft.meta.activeGameId);
    if (!activeGame || activeGame.teamId !== teamId) {
      draft.meta.activeGameId = getGamesForResolvedTeam(draft, teamId)[0]?.gameId || draft.meta.activeGameId;
    }
  });
}

export function setCurrentRole(roleId) {
  return commit((draft) => {
    if (!draft.meta.currentTeamId) {
      draft.meta.currentRole = "personal";
      return;
    }
    const user = getUserFromState(draft);
    const roles = user?.teamRoles?.[draft.meta.currentTeamId] || [];
    if (roles.includes(roleId)) {
      draft.meta.currentRole = roleId;
    }
  });
}

export function createTeam(teamName) {
  return commit((draft) => {
    const newTeamId = `team-${Date.now()}`;
    draft.teams.push({
      teamId: newTeamId,
      teamName,
      sportType: "baseball",
      teamStatus: "draft",
      owners: [draft.meta.currentUserId],
      members: [{ userId: draft.meta.currentUserId, roles: ["owner", "manager"], membershipStatus: "active" }],
      invitations: [],
      shareTierPreset: "A"
    });
    const user = getUserFromState(draft);
    if (user && !user.joinedTeams.includes(newTeamId)) {
      user.joinedTeams.push(newTeamId);
      user.teamRoles[newTeamId] = ["owner", "manager"];
    }
    draft.meta.currentTeamId = newTeamId;
    draft.meta.currentRole = "owner";
  });
}

export function inviteMember(teamId, userId, roles) {
  return commit((draft) => {
    const team = draft.teams.find((item) => item.teamId === teamId);
    if (!team) {
      return;
    }
    team.invitations = team.invitations.filter((invite) => invite.userId !== userId);
    team.invitations.push({ userId, roles, status: "邀請中" });
    const existing = team.members.find((member) => member.userId === userId);
    if (existing) {
      existing.roles = roles;
      existing.membershipStatus = "invited";
    } else {
      team.members.push({ userId, roles, membershipStatus: "invited" });
    }
  });
}

export function setMemberRoles(teamId, userId, roles) {
  return commit((draft) => {
    const team = draft.teams.find((item) => item.teamId === teamId);
    const member = team?.members.find((item) => item.userId === userId);
    const user = draft.users.find((item) => item.userId === userId);
    if (member) {
      member.roles = roles;
      member.membershipStatus = "active";
    }
    if (user) {
      user.teamRoles[teamId] = roles;
      if (!user.joinedTeams.includes(teamId)) {
        user.joinedTeams.push(teamId);
      }
    }
  });
}

export function linkPlayerAccount(playerId, userId) {
  return commit((draft) => {
    const player = draft.players.find((item) => item.playerId === playerId);
    if (!player) {
      return;
    }
    player.linkedUserId = userId;
    player.accountLinkStatus = userId ? "linked" : "unlinked";
    player.historyRecords.push({ date: new Date().toISOString().slice(0, 10), note: userId ? `完成與 ${userId} 的帳號連結` : "解除帳號連結" });
  });
}

export function updateAttendance(gameId, userId, responseStatus) {
  return commit((draft) => {
    const game = draft.games.find((item) => item.gameId === gameId);
    const response = draft.attendanceResponses.find((item) => item.gameId === gameId && item.userId === userId);
    if (response) {
      response.responseStatus = responseStatus;
      response.respondedAt = new Date().toISOString().replace("T", " ").slice(0, 16);
    } else {
      draft.attendanceResponses.push({
        responseId: `resp-${Date.now()}`,
        gameId,
        teamId: game?.teamId || draft.meta.currentTeamId,
        userId,
        responseStatus,
        responseSource: "platform",
        respondedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
        notes: ""
      });
    }
  });
}

export function toggleNotificationRead(notificationId) {
  return commit((draft) => {
    const notification = draft.notifications.find((item) => item.notificationId === notificationId);
    if (notification && notification.deliveryStatus === "已送達") {
      notification.deliveryStatus = "已讀";
    }
  });
}

export function updateGameSettings(gameId, patch) {
  return commit((draft) => {
    const game = draft.games.find((item) => item.gameId === gameId);
    if (game) {
      Object.assign(game, patch);
    }
  });
}

export function updateScorerRequest(gameId, status, assignedScorerUserId = null) {
  return commit((draft) => {
    const game = draft.games.find((item) => item.gameId === gameId);
    if (!game) {
      return;
    }
    game.scorerRequestStatus = status;
    if (status === "approved") {
      game.assignedScorerUserId = assignedScorerUserId || draft.meta.currentUserId;
    }
  });
}

export function appendEvent(gameId, eventInput) {
  return commit((draft) => {
    const gameEvents = draft.events.filter((item) => item.gameId === gameId);
    const nextSequence = gameEvents.length + 1;
    draft.events.push({
      eventId: `ev-${Date.now()}`,
      gameId,
      inning: eventInput.inning || 1,
      half: eventInput.half || "top",
      sequenceNo: nextSequence,
      eventType: eventInput.eventType || "single",
      actorPlayerId: eventInput.actorPlayerId || "p-01",
      relatedPlayers: eventInput.relatedPlayers || [],
      scoreDelta: eventInput.scoreDelta || { team: 0, opponent: 0 },
      outsAfter: eventInput.outsAfter ?? 0,
      basesAfter: eventInput.basesAfter || { first: null, second: null, third: null },
      snapshotAfter: eventInput.snapshotAfter || { inningText: `${eventInput.inning || 1}${eventInput.half === "bottom" ? "下" : "上"}`, scoreText: "0 : 0" },
      captureSource: eventInput.captureSource || "manual",
      reviewStatus: eventInput.reviewStatus || "confirmed"
    });
  });
}

export function reviewEvent(eventId, patch) {
  return commit((draft) => {
    const event = draft.events.find((item) => item.eventId === eventId);
    if (event) {
      Object.assign(event, patch);
    }
  });
}
