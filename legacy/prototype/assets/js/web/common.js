import { loadScenarioList } from "../core/data-loader.js";
import { getState, resetState, setCurrentRole, setCurrentTeam, setScenario } from "../core/mock-store.js";
import { getAvailableRoleContexts, getCurrentTeamContext, getCurrentUser, getFeatureVisibilitySummary, getJoinedTeams, roleLabel } from "../core/permission-engine.js";
import { renderSurfaceHeader } from "../core/router.js";

function buildWebContext(state) {
  const currentUser = getCurrentUser(state);
  const currentTeam = getCurrentTeamContext(state);
  const teams = getJoinedTeams(state);
  const roleOptions = getAvailableRoleContexts(state, currentTeam?.teamId, currentUser?.userId);
  const visibility = getFeatureVisibilitySummary(state, currentTeam?.teamId, currentUser?.userId);
  const manageEnabled = currentTeam ? visibility.some((item) => item.label === "球隊治理" && item.allowed) : !currentUser?.joinedTeams?.length;

  return {
    userName: currentUser?.displayName || "未登入",
    teamName: currentTeam?.teamName || "個人視角",
    roleLabel: roleLabel(state.meta.currentRole || "personal"),
    teamOptions: [{ teamId: "", label: "個人視角", selected: !currentTeam }].concat(
      teams.map((team) => ({ teamId: team.teamId, label: team.teamName, selected: team.teamId === currentTeam?.teamId }))
    ),
    roleOptions: roleOptions.map((role) => ({ ...role, selected: role.id === (currentTeam ? state.meta.currentRole : "personal") })),
    manageLabel: currentUser?.joinedTeams?.length ? currentTeam ? manageEnabled ? "管理此球隊" : "檢視球隊" : "先選球隊" : "建立球隊",
    manageEmphasis: Boolean(manageEnabled || !currentUser?.joinedTeams?.length)
  };
}

function bindSharedControls() {
  document.querySelector("#scenario-select")?.addEventListener("change", (event) => {
    setScenario(event.target.value);
    window.location.reload();
  });

  document.querySelector("#reset-state")?.addEventListener("click", () => {
    resetState();
    window.location.reload();
  });
}

export function initWebPage({ moduleId, title, description }) {
  const state = getState();
  const shell = document.querySelector("#site-header");
  const root = document.querySelector("#page-root");

  shell.innerHTML = renderSurfaceHeader({
    surface: "web",
    moduleId,
    title,
    description,
    scenarioOptions: loadScenarioList(),
    currentScenarioId: state.meta.currentScenarioId || "baseline",
    context: buildWebContext(state)
  });

  bindSharedControls();

  document.querySelector("#team-context-select")?.addEventListener("change", (event) => {
    setCurrentTeam(event.target.value || null);
    window.location.reload();
  });

  document.querySelector("#role-context-select")?.addEventListener("change", (event) => {
    setCurrentRole(event.target.value);
    window.location.reload();
  });

  return { root, state, currentUser: getCurrentUser(state), currentTeam: getCurrentTeamContext(state) };
}

export function renderHeroStats(items) {
  return `<div class="stats-grid">${items.map((item) => `<div class="stat-chip"><strong>${item.value}</strong><span>${item.label}</span></div>`).join("")}</div>`;
}

export function renderList(items) {
  if (!items.length) {
    return `<div class="empty-state">目前沒有可展示的資料。</div>`;
  }
  return `<div class="list">${items.join("")}</div>`;
}

export function renderTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

export function renderTimeline(items) {
  if (!items.length) {
    return `<div class="empty-state">目前尚無時間線資料。</div>`;
  }
  return `<div class="timeline">${items.map((item) => `<div class="timeline-item"><strong>${item.title}</strong><p>${item.detail}</p><div class="subtle">${item.badge}</div></div>`).join("")}</div>`;
}
