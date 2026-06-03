import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame, updateScorerRequest } from "../core/mock-store.js";
import { canApproveScorerRequest, canRecordGame, getCurrentUser } from "../core/permission-engine.js";
import { getEventsForGame, summarizeGame } from "../core/stats-engine.js";
import { initAppPage, renderAppList, renderAppStats } from "./common.js";

const pageModule = window.location.pathname.endsWith("/scoreboard.html") || window.location.pathname.endsWith("scoreboard.html") ? "scoreboard" : "game-center";
const { root } = initAppPage({
  moduleId: pageModule,
  title: pageModule === "scoreboard" ? "APP 計分板" : "APP 賽中中心",
  description: "沿著焦點比賽查看比分、事件與紀錄權限。"
});

const state = getState();
const currentTeam = getCurrentTeam(state, { fallback: false });
const user = getCurrentUser(state);

if (!currentTeam) {
  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">尚未選擇球隊</div>
      <h2>請先回到首頁選擇球隊與比賽</h2>
      <p class="subtle">APP 的賽中中心會沿用目前球隊與焦點比賽，不會獨立打開其他球隊資料。</p>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const game = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;

  if (!game) {
    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">${currentTeam.teamName}</div>
        <h2>目前沒有可展示的焦點比賽</h2>
      </section>
    `;
  } else {
    const summary = summarizeGame(game, getEventsForGame(state, game.gameId));
    const canRecord = canRecordGame(state, game, user.userId);
    const canApprove = canApproveScorerRequest(state, game.teamId, user.userId);

    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">目前場次</div>
        <h2>${game.title}</h2>
        <p class="subtle">${game.sportType} / ${game.matchMode} / ${game.gameStatus}</p>
        ${renderAppStats([
          { label: "比分", value: summary.scoreText },
          { label: "局數", value: summary.inningText }
        ])}
      </section>
      <section class="app-card">
        <div class="eyebrow">切換場次</div>
        <div class="app-button-row">
          ${teamGames.map((teamGame) => `<button class="app-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">紀錄權限</div>
        <p class="subtle">目前狀態：${game.scorerRequestStatus}</p>
        <div class="app-button-row">
          <button class="app-button ${canRecord ? "is-primary" : "is-disabled"}">${canRecord ? "可開始紀錄" : "尚不可紀錄"}</button>
          <button class="app-button" id="request-scorer">申請該場紀錄權限</button>
          <button class="app-button" id="approve-scorer" ${!canApprove ? "disabled" : ""}>核准申請</button>
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">下一步</div>
        <div class="app-button-row">
          <a class="app-button is-primary" href="event-entry.html">事件紀錄</a>
          <a class="app-button" href="lineup.html">看名單</a>
          <a class="app-button" href="substitutions.html">換人</a>
          <a class="app-button" href="share-preview.html">分享預覽</a>
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">比分與事件</div>
        ${renderAppList(
          getEventsForGame(state, game.gameId).map(
            (event) => `<div class="app-item"><strong>${event.eventType}</strong><p class="subtle">${event.snapshotAfter?.inningText || "-"} / ${event.snapshotAfter?.scoreText || "-"}</p></div>`
          )
        )}
      </section>
    `;

    document.querySelectorAll("[data-focus-game]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveGame(button.dataset.focusGame);
        window.location.reload();
      });
    });

    document.querySelector("#request-scorer")?.addEventListener("click", () => {
      updateScorerRequest(game.gameId, "pending", user.userId);
      window.location.reload();
    });

    document.querySelector("#approve-scorer")?.addEventListener("click", () => {
      if (canApprove) {
        updateScorerRequest(game.gameId, "approved", user.userId);
        window.location.reload();
      }
    });
  }
}
