import { loadScenarioList } from "../core/data-loader.js";
import { getState, resetState, setScenario } from "../core/mock-store.js";
import { getCurrentTeamContext, getCurrentUser, roleLabel } from "../core/permission-engine.js";
import { renderSurfaceHeader } from "../core/router.js";

function buildAppContext(state) {
  const currentUser = getCurrentUser(state);
  const currentTeam = getCurrentTeamContext(state);

  return {
    userName: currentUser?.displayName || "未登入",
    teamName: currentTeam?.teamName || "個人視角",
    roleLabel: roleLabel(state.meta.currentRole || "personal")
  };
}

export function initAppPage({ moduleId, title, description }) {
  const state = getState();
  const shell = document.querySelector("#site-header");
  const root = document.querySelector("#page-root");

  shell.innerHTML = renderSurfaceHeader({
    surface: "app",
    moduleId,
    title,
    description,
    scenarioOptions: loadScenarioList(),
    currentScenarioId: state.meta.currentScenarioId || "baseline",
    context: buildAppContext(state)
  });

  document.querySelector("#scenario-select")?.addEventListener("change", (event) => {
    setScenario(event.target.value);
    window.location.reload();
  });

  document.querySelector("#reset-state")?.addEventListener("click", () => {
    resetState();
    window.location.reload();
  });

  return { root, state };
}

export function renderAppStats(items) {
  return `<div class="app-stat-grid">${items.map((item) => `<div class="app-stat"><strong>${item.value}</strong><span>${item.label}</span></div>`).join("")}</div>`;
}

export function renderAppList(items) {
  if (!items.length) {
    return `<div class="app-card">目前沒有可展示資料。</div>`;
  }
  return `<div class="app-list">${items.join("")}</div>`;
}
