import { appendEvent, getCurrentGame, getCurrentTeam, getGamesForTeam, getState, reviewEvent, setActiveGame } from "../core/mock-store.js";
import { canRecordGame, getCurrentUser } from "../core/permission-engine.js";
import { buildGameTimeline, getEventsForGame, summarizeGame } from "../core/stats-engine.js";
import { initAppPage, renderAppList, renderAppStats } from "./common.js";

const { root } = initAppPage({
  moduleId: "event-entry",
  title: "APP 賽中事件紀錄",
  description: "以焦點比賽為主，展示手動輸入、語音待審與確認流程。"
});

const state = getState();
const currentTeam = getCurrentTeam(state, { fallback: false });
const user = getCurrentUser(state);

if (!currentTeam) {
  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">尚未選擇球隊</div>
      <h2>請先在首頁選擇球隊與焦點比賽</h2>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const game = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;

  if (!game) {
    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">${currentTeam.teamName}</div>
        <h2>目前沒有可記錄的比賽</h2>
      </section>
    `;
  } else {
    const events = getEventsForGame(state, game.gameId);
    const summary = summarizeGame(game, events);
    const pendingEvent = events.find((event) => event.reviewStatus === "pending");
    const canRecord = canRecordGame(state, game, user.userId);

    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">即時摘要</div>
        ${renderAppStats([
          { label: "比分", value: summary.scoreText },
          { label: "待確認", value: summary.pendingEvents }
        ])}
      </section>
      <section class="app-card">
        <div class="eyebrow">切換場次</div>
        <div class="app-button-row">
          ${teamGames.map((teamGame) => `<button class="app-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">快速輸入</div>
        <p class="subtle">${canRecord ? "你目前可以直接記錄事件。" : "你目前沒有賽中紀錄權限，按鈕會維持 disabled 展示。"}</p>
        <div class="app-button-row">
          <button class="app-button is-primary" id="add-single" ${canRecord ? "" : "disabled"}>新增手動安打</button>
          <button class="app-button" id="add-voice" ${canRecord ? "" : "disabled"}>新增語音待確認事件</button>
          <button class="app-button" id="confirm-pending" ${!pendingEvent || !canRecord ? "disabled" : ""}>確認待確認事件</button>
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">下一步</div>
        <div class="app-button-row">
          <a class="app-button" href="substitutions.html">換人</a>
          <a class="app-button" href="share-preview.html">分享預覽</a>
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">事件時間線</div>
        ${renderAppList(buildGameTimeline(events, state.players).map((item) => `<div class="app-item"><strong>${item.title}</strong><p class="subtle">${item.detail}</p><p class="subtle">${item.badge}</p></div>`))}
      </section>
    `;

    document.querySelectorAll("[data-focus-game]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveGame(button.dataset.focusGame);
        window.location.reload();
      });
    });

    document.querySelector("#add-single")?.addEventListener("click", () => {
      if (canRecord) {
        appendEvent(game.gameId, {
          inning: 2,
          half: "top",
          eventType: "single",
          actorPlayerId: "p-01",
          scoreDelta: { team: 0, opponent: 0 },
          snapshotAfter: { inningText: "2上", scoreText: summary.scoreText }
        });
        window.location.reload();
      }
    });

    document.querySelector("#add-voice")?.addEventListener("click", () => {
      if (canRecord) {
        appendEvent(game.gameId, {
          inning: 2,
          half: "top",
          eventType: "walk",
          actorPlayerId: "p-02",
          captureSource: "voice",
          reviewStatus: "pending",
          snapshotAfter: { inningText: "2上", scoreText: summary.scoreText }
        });
        window.location.reload();
      }
    });

    document.querySelector("#confirm-pending")?.addEventListener("click", () => {
      if (pendingEvent && canRecord) {
        reviewEvent(pendingEvent.eventId, { reviewStatus: "confirmed", captureSource: `${pendingEvent.captureSource}-confirmed` });
        window.location.reload();
      }
    });
  }
}
