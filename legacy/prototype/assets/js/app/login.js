import { setCurrentUser } from "../core/mock-store.js";
import { getCurrentUser, getFeatureVisibilitySummary, getJoinedTeams, roleLabel } from "../core/permission-engine.js";
import { initAppPage, renderAppList, renderAppStats } from "./common.js";

const { root, state } = initAppPage({
  moduleId: "login",
  title: "APP 登入",
  description: "先切帳號，再進入個人首頁與賽程。"
});

const user = getCurrentUser(state);
const joinedTeams = getJoinedTeams(state, user.userId);
const firstTeamId = joinedTeams[0]?.teamId || null;
const features = firstTeamId ? getFeatureVisibilitySummary(state, firstTeamId, user.userId) : [];
const accountOptions = state.users
  .filter((item) => ["u-owner", "u-scorer", "u-player-1", "u-player-2", "u-new"].includes(item.userId))
  .map(
    (item) => `
      <div class="app-item">
        <strong>${item.displayName}</strong>
        <p class="subtle">${item.emailOrLoginId}</p>
        <p class="subtle">球隊 ${item.joinedTeams.length}｜角色 ${item.joinedTeams.length ? Object.values(item.teamRoles).flat().map((role) => roleLabel(role)).join(" / ") : "尚未加入球隊"}</p>
        <div class="app-button-row">
          <button class="app-button ${item.userId === user.userId ? "is-primary" : ""}" data-login-user="${item.userId}">${item.userId === user.userId ? "目前登入" : "切換到此帳號"}</button>
        </div>
      </div>`
  );

root.innerHTML = `
  <section class="app-card">
    <div class="eyebrow">目前登入者</div>
    <h2>${user.displayName}</h2>
    <p class="subtle">${user.emailOrLoginId}</p>
    ${renderAppStats([
      { label: "所屬球隊", value: joinedTeams.length },
      { label: "可用功能", value: features.filter((item) => item.allowed).length }
    ])}
  </section>
  <section class="app-card">
    <div class="eyebrow">能力摘要</div>
    ${renderAppList(features.map((item) => `<div class="app-item"><strong>${item.label}</strong><p class="subtle">${item.allowed ? "可進入或快速操作" : "此身分下不顯示主要入口"}</p></div>`))}
  </section>
  <section class="app-card">
    <div class="eyebrow">快速切換帳號</div>
    ${renderAppList(accountOptions)}
  </section>
`;

document.querySelectorAll("[data-login-user]").forEach((button) => {
  button.addEventListener("click", () => {
    setCurrentUser(button.dataset.loginUser);
    window.location.href = "home.html";
  });
});
