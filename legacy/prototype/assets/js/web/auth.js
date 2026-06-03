import { createTeam, setCurrentUser } from "../core/mock-store.js";
import { canViewPersonalStats, getCurrentTeamContext, getCurrentUser, getFeatureVisibilitySummary, getJoinedTeams, roleLabel } from "../core/permission-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderHeroStats, renderList } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "auth",
  title: "登入與帳號切換",
  description: "展示不同帳號登入後會先看到的個人視角、球隊數量、角色與個人成績入口差異。"
});

const currentUser = getCurrentUser(state);
const currentTeam = getCurrentTeamContext(state);
const joinedTeams = getJoinedTeams(state);
const visibility = getFeatureVisibilitySummary(state, currentTeam?.teamId, currentUser.userId);

const accountOptions = state.users
  .filter((user) => ["u-owner", "u-scorer", "u-player-1", "u-new"].includes(user.userId))
  .map((user) => {
    const linkedTeamCount = user.joinedTeams.length;
    const roleSummary = linkedTeamCount ? Object.values(user.teamRoles).flat().map((role) => roleLabel(role)).join(" / ") : "尚未加入球隊";
    return `
      <div class="list-item">
        <strong>${user.displayName}</strong>
        <p>${user.emailOrLoginId}</p>
        <p class="subtle">球隊數：${linkedTeamCount}｜角色：${roleSummary}</p>
        <button class="cta-button ${user.userId === currentUser.userId ? "is-primary" : ""}" data-login-user="${user.userId}">${user.userId === currentUser.userId ? "目前登入中" : "以此帳號登入"}</button>
      </div>`;
  });

root.innerHTML = `
  <section class="module-card">
    <div class="eyebrow">目前登入者</div>
    <h2>${currentUser.displayName}</h2>
    <p>${currentUser.emailOrLoginId}，帳號狀態：${currentUser.accountStatus}</p>
    ${renderHeroStats([
      { label: "所屬球隊", value: joinedTeams.length },
      { label: "個人成績入口", value: canViewPersonalStats(state, currentUser.userId) ? "可用" : "空狀態" },
      { label: "目前情境", value: state.meta.currentScenarioId }
    ])}
  </section>
  <section class="page-layout">
    <div class="stack">
      <section class="module-card">
        <div class="eyebrow">快速切換帳號</div>
        ${renderList(accountOptions)}
      </section>
      <section class="module-card">
        <div class="eyebrow">建立球隊</div>
        <h3>${joinedTeams.length ? "此帳號可另外建立新球隊" : "此帳號尚未加入任何球隊"}</h3>
        <p>${joinedTeams.length ? "可建立額外球隊，建立後會自動切到該球隊脈絡。" : "新帳號建立球隊後，會直接成為該隊擁有者與管理者。"}</p>
        <div class="button-row">
          <button class="cta-button is-primary" id="create-team-button">建立展示球隊</button>
        </div>
      </section>
    </div>
    <aside class="stack">
      <section class="module-card">
        <div class="eyebrow">目前能力摘要</div>
        <div class="chip-grid">
          ${visibility.map((item) => `<div class="info-chip"><strong>${item.label}</strong><span>${item.allowed ? "可進入" : "需先選球隊或無權限"}</span></div>`).join("")}
        </div>
      </section>
      <section class="module-card">
        <div class="eyebrow">驗證重點</div>
        <p>登入後不會直接落在模組清單，而是回到行事曆首頁。若要驗證球員個人成績，請切換到球員或紀錄員帳號。</p>
        <div class="button-row">
          ${currentUser.joinedTeams.length ? formatBadge("可回首頁驗證上下文切換", "success") : formatBadge("先建立第一支球隊", "warning")}
        </div>
      </section>
    </aside>
  </section>
`;

document.querySelectorAll("[data-login-user]").forEach((button) => {
  button.addEventListener("click", () => {
    setCurrentUser(button.dataset.loginUser);
    window.location.href = "calendar.html";
  });
});

document.querySelector("#create-team-button")?.addEventListener("click", () => {
  createTeam(`展示新球隊 ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`);
  window.location.href = "teams.html";
});
