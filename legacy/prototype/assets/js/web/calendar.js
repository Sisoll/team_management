import { getCurrentGame, getCurrentTeam, getState, setActiveGame, setCurrentTeam, toggleNotificationRead, updateAttendance } from "../core/mock-store.js";
import { getCurrentUser, getJoinedTeams } from "../core/permission-engine.js";
import { initWebPage, renderList, renderTable } from "./common.js";

function getResponseForGame(responses, gameId, userId) {
  return responses.find((item) => item.gameId === gameId && item.userId === userId) || null;
}

function buildSummary(gameId, team, responses) {
  const related = responses.filter((item) => item.gameId === gameId);
  const summary = { attending: 0, declined: 0, tentative: 0, unanswered: 0 };
  related.forEach((response) => {
    summary[response.responseStatus] += 1;
  });
  summary.unanswered = Math.max((team?.members?.length || 0) - related.length, 0);
  return summary;
}

const { root, state } = initWebPage({
  moduleId: "calendar",
  title: "行事曆首頁",
  description: "登入後預設從這裡開始。未選球隊時先看個人賽程；選定球隊後再看該隊賽程與回覆統計。"
});

const currentTeam = getCurrentTeam(state, { fallback: false });
const currentUser = getCurrentUser(state);
const joinedTeams = getJoinedTeams(state);
const visibleTeamIds = new Set(joinedTeams.map((team) => team.teamId));
const personalEntries = state.calendar.filter((entry) => visibleTeamIds.has(entry.teamId));
const personalNotifications = state.notifications.filter((item) => item.targetUserId === currentUser.userId);

function renderPersonalView() {
  const cards = personalEntries.map((entry) => {
    const game = state.games.find((item) => item.gameId === entry.gameId);
    const team = state.teams.find((item) => item.teamId === entry.teamId);
    const response = getResponseForGame(state.attendanceResponses, entry.gameId, currentUser.userId);
    return `
      <div class="list-item">
        <strong>${game.title}</strong>
        <p>${team?.teamName || "-"}｜${entry.entryDate}｜${entry.entryStatus}</p>
        <p class="subtle">我的回覆：${response ? response.responseStatus : "尚未回覆"}</p>
        <div class="button-row">
          <button class="cta-button is-primary" data-game-response="${entry.gameId}" data-response="attending">參加</button>
          <button class="cta-button" data-game-response="${entry.gameId}" data-response="tentative">待定</button>
          <button class="cta-button" data-game-response="${entry.gameId}" data-response="declined">不參加</button>
        </div>
        <div class="button-row compact-row">
          <button class="cta-button" data-switch-team="${entry.teamId}" data-open-game="${entry.gameId}">切到這支球隊</button>
        </div>
      </div>`;
  });

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">個人賽程</div>
          <h2>${currentUser.displayName} 的行事曆</h2>
          <p>目前尚未選擇球隊，因此先顯示你所屬球隊相關的個人賽程與回覆狀態。</p>
          ${renderList(cards)}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">個人通知</div>
          ${renderList(
            personalNotifications.map(
              (notification) => `<div class="list-item"><strong>${notification.title}</strong><p>${notification.deliveryStatus} / ${notification.deliveryChannel}</p><button class="cta-button" data-notification="${notification.notificationId}">標示為已讀</button></div>`
            )
          )}
        </section>
        <section class="module-card">
          <div class="eyebrow">下一步</div>
          <p>若要看球隊賽程、球隊統計或隊務內容，請先選球隊。你也可以直接從賽程卡片切到對應球隊與比賽。</p>
        </section>
      </aside>
    </section>
  `;
}

function renderTeamView() {
  const teamEntries = state.calendar.filter((entry) => entry.teamId === currentTeam.teamId);
  const focusGame = getCurrentGame(state, { teamId: currentTeam.teamId }) || state.games.find((game) => game.gameId === teamEntries[0]?.gameId) || null;
  const focusEntry = teamEntries.find((entry) => entry.gameId === focusGame?.gameId) || teamEntries[0] || null;
  const rows = teamEntries.map((entry) => {
    const game = state.games.find((item) => item.gameId === entry.gameId);
    const summary = buildSummary(entry.gameId, currentTeam, state.attendanceResponses);
    return `
      <tr>
        <td>${game.title}</td>
        <td>${entry.entryDate}</td>
        <td>${entry.entryStatus}</td>
        <td>${summary.attending} / ${summary.declined} / ${summary.tentative} / ${summary.unanswered}</td>
        <td><button class="cta-button ${focusGame?.gameId === entry.gameId ? "is-primary" : ""}" data-focus-game="${entry.gameId}">${focusGame?.gameId === entry.gameId ? "目前焦點" : "聚焦此場"}</button></td>
      </tr>`;
  });

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">球隊賽程</div>
          <h2>${currentTeam.teamName}</h2>
          ${renderTable(["比賽", "日期", "狀態", "參加 / 不參加 / 待定 / 未回覆", "焦點"], rows)}
        </section>
        <section class="module-card">
          <div class="eyebrow">我的回覆</div>
          <p>目前登入者：${currentUser.displayName}${focusGame ? `｜焦點比賽：${focusGame.title}` : ""}</p>
          <div class="button-row">
            <button class="cta-button is-primary" data-game-response="${focusGame?.gameId || ""}" data-response="attending" ${focusGame ? "" : "disabled"}>回覆參加</button>
            <button class="cta-button" data-game-response="${focusGame?.gameId || ""}" data-response="tentative" ${focusGame ? "" : "disabled"}>回覆待定</button>
            <button class="cta-button" data-game-response="${focusGame?.gameId || ""}" data-response="declined" ${focusGame ? "" : "disabled"}>回覆不參加</button>
          </div>
          ${focusEntry ? `<p class="subtle">目前聚焦場次狀態：${focusEntry.entryStatus}</p>` : ""}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">通知中心</div>
          ${renderList(
            state.notifications
              .filter((notification) => !notification.teamId || notification.teamId === currentTeam.teamId || notification.targetUserId === currentUser.userId)
              .map(
                (notification) => `<div class="list-item"><strong>${notification.title}</strong><p>${notification.deliveryStatus} / ${notification.deliveryChannel}</p><button class="cta-button" data-notification="${notification.notificationId}">標示為已讀</button></div>`
              )
          )}
        </section>
        <section class="module-card">
          <div class="eyebrow">下一步</div>
          <div class="quick-grid">
            <a class="quick-link" href="games.html"><strong>前往比賽</strong><span>沿用目前焦點比賽進入規則設定。</span></a>
            <a class="quick-link" href="lineup.html"><strong>前往名單</strong><span>查看此場出賽名單與再上場。</span></a>
            <a class="quick-link" href="review.html"><strong>前往回顧</strong><span>檢查待審事件與修正。</span></a>
            <a class="quick-link" href="share.html"><strong>前往分享</strong><span>確認公開範圍與 Tier。</span></a>
          </div>
        </section>
      </aside>
    </section>
  `;
}

if (currentTeam) {
  renderTeamView();
} else {
  renderPersonalView();
}

document.querySelectorAll("[data-game-response]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.gameResponse) {
      updateAttendance(button.dataset.gameResponse, currentUser.userId, button.dataset.response);
      window.location.reload();
    }
  });
});

document.querySelectorAll("[data-switch-team]").forEach((button) => {
  button.addEventListener("click", () => {
    setCurrentTeam(button.dataset.switchTeam);
    if (button.dataset.openGame) {
      setActiveGame(button.dataset.openGame);
    }
    window.location.href = "games.html";
  });
});

document.querySelectorAll("[data-focus-game]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveGame(button.dataset.focusGame);
    window.location.reload();
  });
});

document.querySelectorAll("[data-notification]").forEach((button) => {
  button.addEventListener("click", () => {
    toggleNotificationRead(button.dataset.notification);
    window.location.reload();
  });
});
