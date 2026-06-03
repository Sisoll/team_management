const PRESETS = {
  "baseball-official": { label: "棒球 / 正式賽", sportType: "baseball", matchMode: "official", supportsReEntry: false, supportsDH: true, supportsEP: false, minPlayers: 9, maxPlayers: 10, friendlyRosterFlexEnabled: false },
  "baseball-friendly": { label: "棒球 / 友誼賽", sportType: "baseball", matchMode: "friendly", supportsReEntry: false, supportsDH: true, supportsEP: true, minPlayers: 9, maxPlayers: 99, friendlyRosterFlexEnabled: true },
  "softball-official": { label: "壘球 / 正式賽", sportType: "softball", matchMode: "official", supportsReEntry: true, supportsDH: false, supportsEP: true, minPlayers: 10, maxPlayers: 10, friendlyRosterFlexEnabled: false },
  "softball-friendly": { label: "壘球 / 友誼賽", sportType: "softball", matchMode: "friendly", supportsReEntry: true, supportsDH: false, supportsEP: true, minPlayers: 10, maxPlayers: 99, friendlyRosterFlexEnabled: true }
};

export function getPreset(rulePresetId = "baseball-official") {
  return PRESETS[rulePresetId] || PRESETS["baseball-official"];
}

export function buildRulePresetId(sportType, matchMode) {
  return `${sportType}-${matchMode}`;
}

export function summarizeRulePreset(game) {
  const preset = getPreset(game.rulePresetId || buildRulePresetId(game.sportType, game.matchMode));
  return {
    ...preset,
    rulePresetId: game.rulePresetId || buildRulePresetId(game.sportType, game.matchMode),
    summary: `${preset.label}，${preset.supportsReEntry ? "允許一次再上場" : "不允許再上場"}，${preset.friendlyRosterFlexEnabled ? "人數可動態增減" : `建議 ${preset.minPlayers}-${preset.maxPlayers} 人`}`
  };
}

export function validateLineup(game, lineup = {}) {
  const preset = summarizeRulePreset(game);
  const activeCount = (lineup.activeParticipants || []).length;
  const issues = [];
  const highlights = [];

  if (activeCount < preset.minPlayers) {
    issues.push(`目前僅 ${activeCount} 人，低於建議的 ${preset.minPlayers} 人起始門檻。`);
  }
  if (!preset.friendlyRosterFlexEnabled && activeCount > preset.maxPlayers) {
    issues.push(`正式賽目前 ${activeCount} 人，超過規則允許的 ${preset.maxPlayers} 人上限。`);
  }
  if (preset.friendlyRosterFlexEnabled && activeCount > preset.minPlayers) {
    highlights.push(`友誼賽目前 ${activeCount} 人，系統視為合法的彈性登錄情境。`);
  }
  if (preset.supportsReEntry) {
    highlights.push("本規則集允許指定球員於條件成立時再上場一次。");
  }

  return { preset, activeCount, isValid: issues.length === 0, issues, highlights };
}

export function evaluateReEntry(game, player) {
  const preset = summarizeRulePreset(game);
  if (!preset.supportsReEntry) {
    return { allowed: false, reason: "本規則集不允許再上場。" };
  }
  if (player.reEntryUsed) {
    return { allowed: false, reason: "該球員已使用過再上場資格。" };
  }
  return { allowed: true, reason: "符合壘球再上場規則，可重新列入場上名單。" };
}

export function evaluateSubstitution(game, player, actionType = "substitution") {
  const preset = summarizeRulePreset(game);
  if (preset.friendlyRosterFlexEnabled) {
    return { allowed: true, reason: "友誼賽模式允許彈性換人與動態調度。" };
  }
  if (actionType === "re-entry") {
    return evaluateReEntry(game, player);
  }
  if (player.availability && player.availability !== "available") {
    return { allowed: false, reason: "球員目前不在可出賽狀態。" };
  }
  return { allowed: true, reason: "符合正式賽基本換人條件。" };
}
