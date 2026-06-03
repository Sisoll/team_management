import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, reviewEvent, setActiveGame } from "../core/mock-store.js";
import { canReviewGame, getCurrentUser } from "../core/permission-engine.js";
import { buildGameTimeline, getEventsForGame, summarizeGame } from "../core/stats-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderHeroStats, renderTimeline } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "review",
  title: "回顧與補登修正",
  description: "沿著焦點比賽檢查事件時間線、待審內容與賽後修正權限。"
});

const currentTeam = getCurrentTeam(state, { fallback: false });
const currentUser = getCurrentUser(state);

if (!currentTeam) {
  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">尚未選擇球隊</div>
          <h2>回顧頁需要球隊與比賽脈絡</h2>
          <p>未選球隊時不顯示球隊回顧資料。請先選擇球隊，再從比賽頁切到想回顧的場次。</p>
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">用途</div>
          <p>這一頁主要用來展示賽後補登、語音待確認事件與修正後即時重算。</p>
        </section>
      </aside>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const game = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;

  if (!game) {
    root.innerHTML = `
      <section class="module-card">
        <div class="eyebrow">${currentTeam.teamName}</div>
        <h2>目前沒有可回顧的比賽</h2>
      </section>
    `;
  } else {
    const events = getEventsForGame(state, game.gameId);
    const summary = summarizeGame(game, events);
    const allowed = canReviewGame(state, game.teamId, currentUser.userId);
    const pendingEvent = events.find((event) => event.reviewStatus === "pending");

    root.innerHTML = `
      <section class="page-layout">
        <div class="stack">
          <section class="module-card">
            <div class="eyebrow">回顧目標場次</div>
            <h2>${game.title}</h2>
            <p>結果：${game.gameResolution}｜戰績納入：${game.standingsInclusionMode}</p>
            ${renderHeroStats([
              { label: "比賽狀態", value: game.gameStatus },
              { label: "比分", value: summary.scoreText },
              { label: "待確認", value: summary.pendingEvents }
            ])}
          </section>
          <section class="module-card">
            <div class="eyebrow">事件時間線</div>
            ${events.length ? renderTimeline(buildGameTimeline(events, state.players)) : `<div class="empty-state">目前這場比賽尚無事件資料。</div>`}
          </section>
        </div>
        <aside class="stack">
          <section class="module-card">
            <div class="eyebrow">切換場次</div>
            <div class="button-row">
              ${teamGames.map((teamGame) => `<button class="cta-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
            </div>
          </section>
          <section class="module-card">
            <div class="eyebrow">權限狀態</div>
            <p>${currentUser.displayName} ${allowed ? "具備補登 / 修正權限" : "目前只能檢視，不能修改"}</p>
            <div class="button-row">${formatBadge(allowed ? "可修正" : "唯讀檢視", allowed ? "success" : "warning")}</div>
          </section>
          <section class="module-card">
            <div class="eyebrow">即時重算</div>
            <p>已確認 ${summary.confirmedEvents} 筆、待確認 ${summary.pendingEvents} 筆，確認待審後應立即重算摘要與時間線。</p>
            <div class="button-row">
              <button class="cta-button is-primary" id="confirm-pending" ${!pendingEvent || !allowed ? "disabled" : ""}>確認待審事件</button>
            </div>
          </section>
        </aside>
      </section>
    `;

    document.querySelectorAll("[data-focus-game]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveGame(button.dataset.focusGame);
        window.location.reload();
      });
    });

    document.querySelector("#confirm-pending")?.addEventListener("click", () => {
      if (pendingEvent && allowed) {
        reviewEvent(pendingEvent.eventId, { reviewStatus: "confirmed", captureSource: `${pendingEvent.captureSource}-confirmed` });
        window.location.reload();
      }
    });
  }
}
