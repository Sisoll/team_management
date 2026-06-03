import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame, setCurrentTeam, toggleNotificationRead, updateAttendance } from "../core/mock-store.js";
import { getCurrentUser, getJoinedTeams } from "../core/permission-engine.js";
import { initAppPage, renderAppList, renderAppStats } from "./common.js";

function getResponseForGame(responses, gameId, userId) {
  return responses.find((item) => item.gameId === gameId && item.userId === userId) || null;
}

const pageModule = window.location.pathname.endsWith("/home.html") || window.location.pathname.endsWith("home.html") ? "home" : "schedule";
const { root } = initAppPage({
  moduleId: pageModule,
  title: pageModule === "home" ? "APP 個人首頁" : "APP 賽程",
  description: "先從個人視角看賽程與通知，再切到指定球隊與焦點比賽。"
});

const state = getState();
const user = getCurrentUser(state);
const currentTeam = getCurrentTeam(state, { fallback: false });
const joinedTeams = getJoinedTeams(state, user.userId);

function renderPersonalHome() {
  const joinedTeamIds = new Set(joinedTeams.map((team) => team.teamId));
  const entries = state.calendar.filter((entry) => joinedTeamIds.has(entry.teamId));
  const notifications = state.notifications.filter((item) => item.targetUserId === user.userId);

  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">個人首頁</div>
      <h2>${user.displayName}</h2>
      ${renderAppStats([
        { label: "球隊", value: joinedTeams.length },
        { label: "通知", value: notifications.length }
      ])}
    </section>
    <section class="app-card">
      <div class="eyebrow">我的賽程</div>
      ${renderAppList(
        entries.map((entry) => {
          const team = joinedTeams.find((item) => item.teamId === entry.teamId);
          const game = state.games.find((item) => item.gameId === entry.gameId);
          return `<div class="app-item"><strong>${game?.title || entry.gameId}</strong><p class="subtle">${team?.teamName || entry.teamId}｜${entry.entryDate}｜${entry.entryStatus}</p><div class="app-button-row"><button class="app-button is-primary" data-open-team="${entry.teamId}" data-open-game="${entry.gameId}">切到這支球隊</button></div></div>`;
        })
      )}
    </section>
    <section class="app-card">
      <div class="eyebrow">通知</div>
      ${renderAppList(
        notifications.map(
          (notification) => `<div class="app-item"><strong>${notification.title}</strong><p class="subtle">${notification.deliveryStatus} / ${notification.deliveryChannel}</p><div class="app-button-row"><button class="app-button" data-notification="${notification.notificationId}">標為已讀</button></div></div>`
        )
      )}
    </section>
  `;

  document.querySelectorAll("[data-open-team]").forEach((button) => {
    button.addEventListener("click", () => {
      setCurrentTeam(button.dataset.openTeam);
      setActiveGame(button.dataset.openGame);
      window.location.href = "schedule.html";
    });
  });

  document.querySelectorAll("[data-notification]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleNotificationRead(button.dataset.notification);
      window.location.reload();
    });
  });
}

function renderTeamSchedule() {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const currentGame = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;
  const notifications = state.notifications.filter((item) => item.targetUserId === user.userId || item.teamId === currentTeam.teamId);
  const response = currentGame ? getResponseForGame(state.attendanceResponses, currentGame.gameId, user.userId) : null;

  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">目前球隊</div>
      <h2>${currentTeam.teamName}</h2>
      ${renderAppStats([
        { label: "賽程筆數", value: teamGames.length },
        { label: "焦點比賽", value: currentGame ? 1 : 0 }
      ])}
      <div class="app-button-row">
        <button class="app-button" id="back-to-personal">回個人首頁</button>
      </div>
    </section>
    <section class="app-card">
      <div class="eyebrow">球隊賽程</div>
      ${renderAppList(
        teamGames.map(
          (game) => `<div class="app-item"><strong>${game.title}</strong><p class="subtle">${game.gameDate}｜${game.competitionCategory}｜${game.gameStatus}</p><div class="app-button-row"><button class="app-button ${currentGame?.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${game.gameId}">${currentGame?.gameId === game.gameId ? "目前焦點" : "切到此場"}</button><a class="app-button ${currentGame?.gameId === game.gameId ? "is-primary" : ""}" href="game-center.html">前往賽中</a></div></div>`
        )
      )}
    </section>
    <section class="app-card">
      <div class="eyebrow">我的回覆</div>
      ${currentGame
        ? `<p class="subtle">${currentGame.title}｜目前回覆：${response ? response.responseStatus : "尚未回覆"}</p><div class="app-button-row"><button class="app-button is-primary" data-response="attending">參加</button><button class="app-button" data-response="tentative">待定</button><button class="app-button" data-response="declined">不參加</button></div>`
        : `<div class="app-item"><strong>尚未選擇焦點比賽</strong></div>`}
    </section>
    <section class="app-card">
      <div class="eyebrow">下一步</div>
      <div class="app-button-row">
        <a class="app-button is-primary" href="game-center.html">賽中中心</a>
        <a class="app-button" href="lineup.html">名單</a>
        <a class="app-button" href="share-preview.html">分享預覽</a>
      </div>
    </section>
    <section class="app-card">
      <div class="eyebrow">通知</div>
      ${renderAppList(
        notifications.map(
          (notification) => `<div class="app-item"><strong>${notification.title}</strong><p class="subtle">${notification.deliveryStatus} / ${notification.deliveryChannel}</p><div class="app-button-row"><button class="app-button" data-notification="${notification.notificationId}">標為已讀</button></div></div>`
        )
      )}
    </section>
  `;

  document.querySelector("#back-to-personal")?.addEventListener("click", () => {
    setCurrentTeam(null);
    window.location.href = "home.html";
  });

  document.querySelectorAll("[data-focus-game]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveGame(button.dataset.focusGame);
      window.location.reload();
    });
  });

  document.querySelectorAll("[data-response]").forEach((button) => {
    button.addEventListener("click", () => {
      if (currentGame) {
        updateAttendance(currentGame.gameId, user.userId, button.dataset.response);
        window.location.reload();
      }
    });
  });

  document.querySelectorAll("[data-notification]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleNotificationRead(button.dataset.notification);
      window.location.reload();
    });
  });
}

if (currentTeam) {
  renderTeamSchedule();
} else {
  renderPersonalHome();
}
