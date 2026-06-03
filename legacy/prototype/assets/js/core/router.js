export const WEB_NAV_ITEMS = [
  ["index", "首頁"],
  ["calendar", "行事曆"],
  ["stats", "統計"],
  ["teams", "管理"],
  ["players", "球員"],
  ["games", "比賽"],
  ["lineup", "名單"],
  ["review", "回顧"],
  ["reports", "報表"],
  ["share", "分享"],
  ["auth", "登入"],
];

export const APP_NAV_ITEMS = [
  ["home", "首頁"],
  ["login", "登入"],
  ["schedule", "賽程"],
  ["game-center", "賽中"],
  ["lineup", "名單"],
  ["event-entry", "紀錄"],
  ["substitutions", "換人"],
  ["scoreboard", "計分板"],
  ["share-preview", "分享"],
];

function createNavLink(surface, item, activeModule) {
  const [moduleId, label] = item;
  const className = `${surface === "web" ? "nav-pill" : "app-pill"}${moduleId === activeModule ? " is-active" : ""}`;
  return `<a class="${className}" href="${moduleId}.html">${label}</a>`;
}

function renderScenarioOptions(options = [], currentScenarioId = "baseline") {
  return options
    .map((scenario) => `<option value="${scenario.id}" ${scenario.id === currentScenarioId ? "selected" : ""}>${scenario.label}</option>`)
    .join("");
}

export function renderSurfaceHeader({ surface, moduleId, title, description, scenarioOptions, currentScenarioId, context }) {
  const navItems = surface === "web" ? WEB_NAV_ITEMS : APP_NAV_ITEMS;
  const navClass = surface === "web" ? "nav-strip" : "app-nav";
  const scenarioMarkup = renderScenarioOptions(scenarioOptions, currentScenarioId);

  if (surface === "web") {
    const teamOptions = (context?.teamOptions || [])
      .map((team) => `<option value="${team.teamId}" ${team.selected ? "selected" : ""}>${team.label}</option>`)
      .join("");
    const roleOptions = (context?.roleOptions || [])
      .map((role) => `<option value="${role.id}" ${role.selected ? "selected" : ""}>${role.label}</option>`)
      .join("");

    return `
      <div class="hero shell web-shell-header">
        <div class="eyebrow">Web 展示</div>
        <div class="web-header-main">
          <div class="stack tight-gap">
            <h1>${title}</h1>
            <p>${description}</p>
            <div class="context-chip-row">
              <span class="context-chip"><strong>登入</strong><span>${context?.userName || "未登入"}</span></span>
              <span class="context-chip"><strong>目前球隊</strong><span>${context?.teamName || "個人視角"}</span></span>
              <span class="context-chip"><strong>目前身分</strong><span>${context?.roleLabel || "個人視角"}</span></span>
            </div>
          </div>
          <div class="header-actions-panel">
            <div class="button-row right-wrap">
              <a class="cta-button" href="auth.html">登入 / 切換帳號</a>
              <a class="cta-button ${context?.manageEmphasis ? "is-primary" : ""}" href="teams.html">${context?.manageLabel || "管理"}</a>
            </div>
            <div class="context-select-grid">
              <label>
                球隊
                <select id="team-context-select">${teamOptions}</select>
              </label>
              <label>
                身分
                <select id="role-context-select">${roleOptions}</select>
              </label>
            </div>
            <div class="button-row right-wrap compact-row">
              <label class="subtle scenario-inline">
                情境切換
                <select id="scenario-select">${scenarioMarkup}</select>
              </label>
              <button class="cta-button" id="reset-state">重設展示資料</button>
            </div>
          </div>
        </div>
        <div class="${navClass}">${navItems.map((item) => createNavLink(surface, item, moduleId)).join("")}</div>
      </div>
    `;
  }

  return `
    <div class="eyebrow">APP 展示</div>
    <div class="stack">
      <div class="split">
        <div>
          <h1>${title}</h1>
          <p>${description}</p>
        </div>
        <button class="cta-button" id="reset-state">重設</button>
      </div>
      <div class="button-row">
        <label class="subtle">
          情境切換
          <select id="scenario-select">${scenarioMarkup}</select>
        </label>
      </div>
      <div class="context-chip-row compact">
        <span class="context-chip"><strong>使用者</strong><span>${context?.userName || "-"}</span></span>
        <span class="context-chip"><strong>球隊</strong><span>${context?.teamName || "個人"}</span></span>
        <span class="context-chip"><strong>身分</strong><span>${context?.roleLabel || "個人"}</span></span>
      </div>
      <div class="${navClass}">${navItems.map((item) => createNavLink(surface, item, moduleId)).join("")}</div>
    </div>
  `;
}

export function formatBadge(label, tone = "neutral") {
  return `<span class="badge ${tone}">${label}</span>`;
}
