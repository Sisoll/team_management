import { getState } from "../core/mock-store.js";
import { buildPlayerStats, buildTeamRecordRows } from "../core/stats-engine.js";
import { getCurrentTeamContext, getCurrentUser, getLinkedPlayersForUser } from "../core/permission-engine.js";
import { initWebPage, renderTable } from "./common.js";

const { root } = initWebPage({
  moduleId: "stats",
  title: "統計查詢",
  description: "未選球隊時查看個人成績；選定球隊後查看該隊脈絡下的球員統計與球隊戰績。"
});

const state = getState();
const currentUser = getCurrentUser(state);
const currentTeam = getCurrentTeamContext(state);
let mergeMode = "separate";

function renderPersonalStats() {
  const linkedPlayers = getLinkedPlayersForUser(state, currentUser.userId);
  const playerRows = buildPlayerStats(state, { playerIds: linkedPlayers.map((player) => player.playerId) });

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">個人成績</div>
          <h2>${currentUser.displayName}</h2>
          <p>目前為個人視角，不需要先選球隊即可查看自己的單場與累積成績。</p>
          ${playerRows.length
            ? renderTable(
                ["球員", "出賽場次", "安打", "壘打數", "打點"],
                playerRows.map((row) => `<tr><td>${row.displayName}</td><td>${row.games}</td><td>${row.hits}</td><td>${row.totalBases}</td><td>${row.runsBattedIn}</td></tr>`)
              )
            : `<div class="empty-state">此帳號目前沒有已連結的球員成績，可改切球員帳號或先連結球員。</div>`}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">限制說明</div>
          <p>個人視角下不顯示球隊戰績、球隊報表與球隊層級摘要。若要查看球隊內容，請先從右上角選擇球隊。</p>
        </section>
      </aside>
    </section>
  `;
}

function renderTeamStats() {
  const playerRows = buildPlayerStats(state, { teamId: currentTeam.teamId });
  const recordRows = buildTeamRecordRows(state, mergeMode === "partial" ? "separate" : mergeMode === "merged" ? "merged" : "separate", { teamId: currentTeam.teamId });

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">球隊球員成績</div>
          <h2>${currentTeam.teamName}</h2>
          ${renderTable(
            ["球員", "出賽場次", "安打", "壘打數", "打點"],
            playerRows.map((row) => `<tr><td>${row.displayName}</td><td>${row.games}</td><td>${row.hits}</td><td>${row.totalBases}</td><td>${row.runsBattedIn}</td></tr>`)
          )}
        </section>
        <section class="module-card">
          <div class="eyebrow">球隊戰績摘要</div>
          ${renderTable(
            ["分類", "總場次", "納入", "排除", "特殊結果"],
            recordRows.map((row) => `<tr><td>${row.category}</td><td>${row.total}</td><td>${row.included}</td><td>${row.excluded}</td><td>${row.special}</td></tr>`)
          )}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">呈現模式</div>
          <p>目前模式：${mergeMode}</p>
          <div class="button-row">
            <button class="cta-button ${mergeMode === "separate" ? "is-primary" : ""}" data-mode="separate">分類分開</button>
            <button class="cta-button ${mergeMode === "merged" ? "is-primary" : ""}" data-mode="merged">全部合併</button>
            <button class="cta-button ${mergeMode === "partial" ? "is-primary" : ""}" data-mode="partial">部分合併</button>
          </div>
        </section>
        <section class="module-card">
          <div class="eyebrow">預設策略</div>
          <p>預設採分類分開顯示，特殊結果預設不納入戰績，管理者可逐場切換。</p>
        </section>
      </aside>
    </section>
  `;

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      mergeMode = button.dataset.mode;
      renderTeamStats();
    });
  });
}

if (currentTeam) {
  renderTeamStats();
} else {
  renderPersonalStats();
}
