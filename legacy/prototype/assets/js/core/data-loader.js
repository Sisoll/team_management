const DEFAULT_DATA = {
  meta: {
    currentUserId: "u-owner",
    currentTeamId: null,
    currentRole: "personal",
    activeGameId: "game-live-friendly",
    currentScenarioId: "baseline",
    scenarios: [
      { id: "baseline", label: "標準展示", currentUserId: "u-owner", currentTeamId: null, currentRole: "personal", activeGameId: "game-live-friendly" },
      { id: "new-user", label: "新手建立球隊", currentUserId: "u-new", currentTeamId: null, currentRole: "personal", activeGameId: "game-league-home" },
      { id: "restricted", label: "公開檢視者", currentUserId: "u-viewer", currentTeamId: null, currentRole: "personal", activeGameId: "game-cup-review" },
      { id: "scorer-request", label: "待審核紀錄權限", currentUserId: "u-player-2", currentTeamId: "team-seabreeze", currentRole: "player", activeGameId: "game-scorer-request" }
    ]
  },
  users: [
    { userId: "u-owner", displayName: "陳柏宇", emailOrLoginId: "owner@demo.local", accountStatus: "active", joinedTeams: ["team-seabreeze", "team-riptide"], teamRoles: { "team-seabreeze": ["owner", "manager"], "team-riptide": ["manager"] }, notificationInbox: ["nt-001", "nt-002", "nt-004", "nt-010"] },
    { userId: "u-coach", displayName: "高志豪", emailOrLoginId: "coach@demo.local", accountStatus: "active", joinedTeams: ["team-seabreeze"], teamRoles: { "team-seabreeze": ["coach"] }, notificationInbox: ["nt-003", "nt-005"] },
    { userId: "u-scorer", displayName: "林昭宇", emailOrLoginId: "scorer@demo.local", accountStatus: "active", joinedTeams: ["team-seabreeze"], teamRoles: { "team-seabreeze": ["scorer", "player"] }, notificationInbox: ["nt-006"] },
    { userId: "u-player-1", displayName: "王家樂", emailOrLoginId: "player1@demo.local", accountStatus: "active", joinedTeams: ["team-seabreeze"], teamRoles: { "team-seabreeze": ["player"] }, notificationInbox: ["nt-007"] },
    { userId: "u-player-2", displayName: "李書維", emailOrLoginId: "player2@demo.local", accountStatus: "active", joinedTeams: ["team-seabreeze"], teamRoles: { "team-seabreeze": ["player"] }, notificationInbox: ["nt-008"] },
    { userId: "u-new", displayName: "新建立隊長", emailOrLoginId: "new@demo.local", accountStatus: "trial", joinedTeams: [], teamRoles: {}, notificationInbox: [] },
    { userId: "u-viewer", displayName: "公開檢視者", emailOrLoginId: "viewer@demo.local", accountStatus: "viewer", joinedTeams: [], teamRoles: {}, notificationInbox: [] }
  ],
  teams: [
    {
      teamId: "team-seabreeze",
      teamName: "台北海風",
      sportType: "softball",
      teamStatus: "active",
      owners: ["u-owner"],
      members: [
        { userId: "u-owner", roles: ["owner", "manager"], membershipStatus: "active" },
        { userId: "u-coach", roles: ["coach"], membershipStatus: "active" },
        { userId: "u-scorer", roles: ["scorer", "player"], membershipStatus: "active" },
        { userId: "u-player-1", roles: ["player"], membershipStatus: "active" },
        { userId: "u-player-2", roles: ["player"], membershipStatus: "invited" }
      ],
      invitations: [{ userId: "u-player-2", status: "邀請中", roles: ["player"] }],
      shareTierPreset: "B"
    },
    {
      teamId: "team-riptide",
      teamName: "新北追風",
      sportType: "baseball",
      teamStatus: "active",
      owners: [],
      members: [{ userId: "u-owner", roles: ["manager"], membershipStatus: "active" }],
      invitations: [],
      shareTierPreset: "A"
    }
  ],
  players: [
    { playerId: "p-01", teamId: "team-seabreeze", displayName: "王家樂", uniformNumber: "7", linkedUserId: "u-player-1", accountLinkStatus: "linked", primaryPositions: ["CF"], secondaryPositions: ["RF"], rosterStatus: "active", availability: "available", reEntryUsed: false, historyRecords: [{ date: "2025-08-01", note: "加入球隊，背號 7，主守 CF" }] },
    { playerId: "p-02", teamId: "team-seabreeze", displayName: "林昭宇", uniformNumber: "12", linkedUserId: "u-scorer", accountLinkStatus: "linked", primaryPositions: ["SS", "2B"], secondaryPositions: ["P"], rosterStatus: "active", availability: "available", reEntryUsed: false, historyRecords: [{ date: "2025-08-01", note: "加入球隊，兼任紀錄員" }] },
    { playerId: "p-03", teamId: "team-seabreeze", displayName: "陳冠廷", uniformNumber: "18", linkedUserId: null, accountLinkStatus: "unlinked", primaryPositions: ["P"], secondaryPositions: ["1B"], rosterStatus: "active", availability: "available", reEntryUsed: true, historyRecords: [{ date: "2025-08-01", note: "建立球員資料，尚未綁定帳號" }, { date: "2026-02-16", note: "投手角色回隊，保留既有歷史" }] },
    { playerId: "p-04", teamId: "team-seabreeze", displayName: "張庭瑋", uniformNumber: "23", linkedUserId: null, accountLinkStatus: "pending", primaryPositions: ["3B"], secondaryPositions: ["C"], rosterStatus: "inactive", availability: "rehab", reEntryUsed: false, historyRecords: [{ date: "2025-06-10", note: "背號由 28 調整為 23" }, { date: "2026-01-05", note: "因傷暫停出賽" }] },
    { playerId: "p-05", teamId: "team-seabreeze", displayName: "李書維", uniformNumber: "31", linkedUserId: "u-player-2", accountLinkStatus: "linked", primaryPositions: ["1B"], secondaryPositions: ["DH"], rosterStatus: "active", availability: "available", reEntryUsed: false, historyRecords: [{ date: "2025-10-03", note: "加入球隊，待接受成員邀請" }] },
    { playerId: "p-06", teamId: "team-riptide", displayName: "周亦辰", uniformNumber: "4", linkedUserId: null, accountLinkStatus: "unlinked", primaryPositions: ["SS"], secondaryPositions: ["2B"], rosterStatus: "active", availability: "available", reEntryUsed: false, historyRecords: [{ date: "2025-09-14", note: "建立第二球隊測試名單" }] },
    { playerId: "p-07", teamId: "team-riptide", displayName: "吳柏恩", uniformNumber: "27", linkedUserId: null, accountLinkStatus: "unlinked", primaryPositions: ["P"], secondaryPositions: ["1B"], rosterStatus: "active", availability: "available", reEntryUsed: false, historyRecords: [{ date: "2025-09-14", note: "建立第二球隊投手名單" }] }
  ],
  games: [
    { gameId: "game-league-home", teamId: "team-seabreeze", title: "聯盟例行賽 vs 城南黑豹", sportType: "baseball", matchMode: "official", competitionCategory: "league", rulePresetId: "baseball-official", gameDate: "2026-03-28 14:00", venue: "青年公園", opponentName: "城南黑豹", homeAway: "home", visibilityMode: "team-only", shareTierMode: "A", gameStatus: "lineup_confirmed", gameResolution: "pending", standingsInclusionMode: "manual", checkInDeadline: "2026-03-27 21:00", scorerRequestStatus: "approved", assignedScorerUserId: "u-scorer", lineup: { mode: "DH", startingLineup: ["p-01", "p-02", "p-03", "p-05"], benchPlayers: ["p-04"], activeParticipants: ["p-01", "p-02", "p-03", "p-05"] } },
    { gameId: "game-live-friendly", teamId: "team-seabreeze", title: "友誼賽 vs 北投流星", sportType: "softball", matchMode: "friendly", competitionCategory: "friendly", rulePresetId: "softball-friendly", gameDate: "2026-03-30 09:30", venue: "百齡球場", opponentName: "北投流星", homeAway: "away", visibilityMode: "public", shareTierMode: "B", gameStatus: "live", gameResolution: "pending", standingsInclusionMode: "excluded", checkInDeadline: "2026-03-29 18:00", scorerRequestStatus: "approved", assignedScorerUserId: "u-scorer", lineup: { mode: "EP", startingLineup: ["p-01", "p-02", "p-03", "p-05"], benchPlayers: ["p-04"], activeParticipants: ["p-01", "p-02", "p-03", "p-05", "guest-01", "guest-02"] } },
    { gameId: "game-cup-review", teamId: "team-seabreeze", title: "盃賽八強 vs 南港赤雷", sportType: "softball", matchMode: "official", competitionCategory: "cup", rulePresetId: "softball-official", gameDate: "2026-03-18 13:00", venue: "迎風球場", opponentName: "南港赤雷", homeAway: "home", visibilityMode: "public", shareTierMode: "C", gameStatus: "reviewed", gameResolution: "regulatory_win", standingsInclusionMode: "included", checkInDeadline: "2026-03-17 22:00", scorerRequestStatus: "approved", assignedScorerUserId: "u-scorer", lineup: { mode: "10-player", startingLineup: ["p-01", "p-02", "p-03", "p-05"], benchPlayers: ["p-04"], activeParticipants: ["p-01", "p-02", "p-03", "p-05"] } },
    { gameId: "game-scorer-request", teamId: "team-seabreeze", title: "延賽補賽 vs 大安疾風", sportType: "baseball", matchMode: "official", competitionCategory: "league", rulePresetId: "baseball-official", gameDate: "2026-04-02 19:00", venue: "大佳河濱", opponentName: "大安疾風", homeAway: "away", visibilityMode: "team-only", shareTierMode: "A", gameStatus: "scheduled", gameResolution: "postponed", standingsInclusionMode: "excluded", checkInDeadline: "2026-04-01 20:00", scorerRequestStatus: "pending", assignedScorerUserId: null, lineup: { mode: "9-player", startingLineup: ["p-01", "p-02", "p-03"], benchPlayers: ["p-04", "p-05"], activeParticipants: ["p-01", "p-02", "p-03", "p-05"] } },
    { gameId: "game-riptide-home", teamId: "team-riptide", title: "社區聯賽 vs 板橋赤羽", sportType: "baseball", matchMode: "official", competitionCategory: "league", rulePresetId: "baseball-official", gameDate: "2026-04-05 10:00", venue: "新莊棒球場", opponentName: "板橋赤羽", homeAway: "home", visibilityMode: "team-only", shareTierMode: "A", gameStatus: "scheduled", gameResolution: "pending", standingsInclusionMode: "manual", checkInDeadline: "2026-04-04 18:00", scorerRequestStatus: "approved", assignedScorerUserId: "u-owner", lineup: { mode: "9-player", startingLineup: ["p-06", "p-07"], benchPlayers: [], activeParticipants: ["p-06", "p-07"] } }
  ],
  calendar: [
    { calendarEntryId: "cal-001", teamId: "team-seabreeze", gameId: "game-league-home", entryDate: "2026-03-28", entryStatus: "已排程", responseSummary: { attending: 9, declined: 1, tentative: 2, unanswered: 3 }, notificationState: "已送達" },
    { calendarEntryId: "cal-002", teamId: "team-seabreeze", gameId: "game-live-friendly", entryDate: "2026-03-30", entryStatus: "進行中", responseSummary: { attending: 12, declined: 0, tentative: 1, unanswered: 1 }, notificationState: "已送達" },
    { calendarEntryId: "cal-003", teamId: "team-seabreeze", gameId: "game-cup-review", entryDate: "2026-03-18", entryStatus: "已回顧", responseSummary: { attending: 10, declined: 1, tentative: 0, unanswered: 1 }, notificationState: "已讀" },
    { calendarEntryId: "cal-004", teamId: "team-riptide", gameId: "game-riptide-home", entryDate: "2026-04-05", entryStatus: "已排程", responseSummary: { attending: 7, declined: 1, tentative: 1, unanswered: 3 }, notificationState: "已送達" }
  ],
  attendanceResponses: [
    { responseId: "resp-001", gameId: "game-league-home", teamId: "team-seabreeze", userId: "u-player-1", responseStatus: "attending", responseSource: "platform", respondedAt: "2026-03-24 21:02", notes: "可全程出席" },
    { responseId: "resp-002", gameId: "game-live-friendly", teamId: "team-seabreeze", userId: "u-player-2", responseStatus: "tentative", responseSource: "platform", respondedAt: "2026-03-28 10:18", notes: "需視加班情況" },
    { responseId: "resp-003", gameId: "game-scorer-request", teamId: "team-seabreeze", userId: "u-player-2", responseStatus: "declined", responseSource: "platform", respondedAt: "2026-03-31 20:12", notes: "延賽補賽無法參加" },
    { responseId: "resp-004", gameId: "game-riptide-home", teamId: "team-riptide", userId: "u-owner", responseStatus: "attending", responseSource: "platform", respondedAt: "2026-04-01 09:30", notes: "第二球隊也可出席" }
  ],
  notifications: [
    { notificationId: "nt-001", gameId: "game-league-home", teamId: "team-seabreeze", targetUserId: "u-owner", notificationType: "lineup-ready", targetScope: "manager", deliveryChannel: "platform", deliveryStatus: "已讀", title: "聯盟賽名單已確認" },
    { notificationId: "nt-006", gameId: "game-live-friendly", teamId: "team-seabreeze", targetUserId: "u-scorer", notificationType: "scoring", targetScope: "scorer", deliveryChannel: "platform", deliveryStatus: "已送達", title: "友誼賽已可開始紀錄" },
    { notificationId: "nt-008", gameId: "game-scorer-request", teamId: "team-seabreeze", targetUserId: "u-player-2", notificationType: "rsvp", targetScope: "player", deliveryChannel: "external-reserved", deliveryStatus: "外部通道保留", title: "外部報名通道預留，MVP 不啟用" },
    { notificationId: "nt-010", gameId: "game-riptide-home", teamId: "team-riptide", targetUserId: "u-owner", notificationType: "rsvp", targetScope: "manager", deliveryChannel: "platform", deliveryStatus: "已送達", title: "新北追風本週賽程待確認" }
  ],
  events: [
    { eventId: "ev-001", gameId: "game-live-friendly", inning: 1, half: "top", sequenceNo: 1, eventType: "single", actorPlayerId: "p-01", relatedPlayers: [], scoreDelta: { team: 0, opponent: 0 }, outsAfter: 0, basesAfter: { first: "p-01", second: null, third: null }, snapshotAfter: { inningText: "1上", scoreText: "0 : 0" }, captureSource: "manual", reviewStatus: "confirmed" },
    { eventId: "ev-002", gameId: "game-live-friendly", inning: 1, half: "top", sequenceNo: 2, eventType: "double", actorPlayerId: "p-02", relatedPlayers: ["p-01"], scoreDelta: { team: 1, opponent: 0 }, outsAfter: 0, basesAfter: { first: null, second: "p-02", third: null }, snapshotAfter: { inningText: "1上", scoreText: "1 : 0" }, captureSource: "manual", reviewStatus: "confirmed" },
    { eventId: "ev-003", gameId: "game-live-friendly", inning: 1, half: "top", sequenceNo: 3, eventType: "substitution", actorPlayerId: "p-03", relatedPlayers: ["guest-01"], scoreDelta: { team: 0, opponent: 0 }, outsAfter: 1, basesAfter: { first: null, second: "p-02", third: null }, snapshotAfter: { inningText: "1上", scoreText: "1 : 0" }, captureSource: "voice", reviewStatus: "pending" },
    { eventId: "ev-004", gameId: "game-cup-review", inning: 7, half: "bottom", sequenceNo: 32, eventType: "walkoff", actorPlayerId: "p-05", relatedPlayers: ["p-02"], scoreDelta: { team: 1, opponent: 0 }, outsAfter: 2, basesAfter: { first: null, second: null, third: null }, snapshotAfter: { inningText: "7下", scoreText: "5 : 4" }, captureSource: "manual", reviewStatus: "confirmed" }
  ],
  shareTiers: [
    { shareTierMode: "A", title: "Tier A 摘要公開", allowedFields: ["比賽資訊", "比分", "最終結果", "摘要說明"] },
    { shareTierMode: "B", title: "Tier B 名單與摘要統計", allowedFields: ["比賽資訊", "比分", "最終結果", "先發名單", "守位摘要", "單場摘要統計"] },
    { shareTierMode: "C", title: "Tier C 完整單場回顧", allowedFields: ["比賽資訊", "比分", "最終結果", "先發名單", "單場統計", "事件時間線"] }
  ]
};

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function loadSeedData() {
  return clone(DEFAULT_DATA);
}

export function loadScenarioList() {
  return clone(DEFAULT_DATA.meta.scenarios);
}

export function getScenarioPreset(scenarioId) {
  return clone(DEFAULT_DATA.meta.scenarios.find((scenario) => scenario.id === scenarioId) || DEFAULT_DATA.meta.scenarios[0]);
}
