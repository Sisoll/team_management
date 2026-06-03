export function getCurrentUser(state) {
  return state.users.find((user) => user.userId === state.meta.currentUserId) || state.users[0] || null;
}

export function getJoinedTeams(state, userId = state.meta.currentUserId) {
  const user = getCurrentUser({ ...state, meta: { ...state.meta, currentUserId: userId } });
  const joinedIds = user?.joinedTeams || [];
  return joinedIds.map((teamId) => state.teams.find((team) => team.teamId === teamId)).filter(Boolean);
}

export function getCurrentTeamContext(state) {
  return state.teams.find((team) => team.teamId === state.meta.currentTeamId) || null;
}

export function getTeamRoles(state, teamId, userId = state.meta.currentUserId) {
  const team = state.teams.find((item) => item.teamId === teamId);
  const member = team?.members.find((item) => item.userId === userId);
  return member?.roles || [];
}

export function roleLabel(roleId) {
  return {
    personal: "個人視角",
    owner: "擁有者",
    manager: "管理者",
    coach: "教練",
    scorer: "紀錄員",
    player: "球員",
    viewer: "檢視者"
  }[roleId] || roleId;
}

export function getAvailableRoleContexts(state, teamId = state.meta.currentTeamId, userId = state.meta.currentUserId) {
  if (!teamId) {
    return [{ id: "personal", label: "個人視角" }];
  }
  return getTeamRoles(state, teamId, userId).map((role) => ({ id: role, label: roleLabel(role) }));
}

export function getLinkedPlayersForUser(state, userId = state.meta.currentUserId, teamId = null) {
  return state.players.filter((player) => player.linkedUserId === userId && (!teamId || player.teamId === teamId));
}

export function canManageTeam(state, teamId, userId = state.meta.currentUserId) {
  const roles = getTeamRoles(state, teamId, userId);
  return roles.some((role) => ["owner", "manager"].includes(role));
}

export function canReviewGame(state, teamId, userId = state.meta.currentUserId) {
  const roles = getTeamRoles(state, teamId, userId);
  return roles.some((role) => ["owner", "manager", "coach", "scorer"].includes(role));
}

export function canApproveScorerRequest(state, teamId, userId = state.meta.currentUserId) {
  const roles = getTeamRoles(state, teamId, userId);
  return roles.some((role) => ["owner", "manager", "coach"].includes(role));
}

export function canRecordGame(state, game, userId = state.meta.currentUserId) {
  const roles = getTeamRoles(state, game.teamId, userId);
  if (roles.includes("owner") || roles.includes("manager") || roles.includes("coach")) {
    return true;
  }
  if (roles.includes("scorer") && game.scorerRequestStatus !== "rejected") {
    return true;
  }
  if (game.scorerRequestStatus === "approved" && userId === game.assignedScorerUserId) {
    return true;
  }
  return false;
}

export function canViewPersonalStats(state, userId = state.meta.currentUserId) {
  return getLinkedPlayersForUser(state, userId).length > 0;
}

export function getShareTierDefinition(state, tierId) {
  return state.shareTiers.find((tier) => tier.shareTierMode === tierId) || state.shareTiers[0];
}

export function filterSharedGameData(state, game) {
  if (game.visibilityMode !== "public") {
    return { visible: false, title: "目前為非公開賽事", fields: [] };
  }
  const tier = getShareTierDefinition(state, game.shareTierMode);
  return { visible: true, title: tier.title, fields: tier.allowedFields };
}

export function getFeatureVisibilitySummary(state, teamId = state.meta.currentTeamId, userId = state.meta.currentUserId) {
  if (!teamId) {
    return [
      { label: "個人賽程", allowed: true },
      { label: "個人成績", allowed: canViewPersonalStats(state, userId) },
      { label: "球隊管理", allowed: false },
      { label: "球隊統計", allowed: false }
    ];
  }
  const roles = getTeamRoles(state, teamId, userId);
  return [
    { label: "球隊治理", allowed: roles.some((role) => ["owner", "manager"].includes(role)) },
    { label: "球員管理", allowed: roles.some((role) => ["owner", "manager", "coach"].includes(role)) },
    { label: "賽中紀錄", allowed: roles.some((role) => ["owner", "manager", "coach", "scorer"].includes(role)) },
    { label: "統計與回顧", allowed: roles.some((role) => ["owner", "manager", "coach", "scorer", "player"].includes(role)) }
  ];
}
