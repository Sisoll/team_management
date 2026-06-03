import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame } from "../core/mock-store.js";
import { initAppPage, renderAppList } from "./common.js";

const { root } = initAppPage({
  moduleId: "lineup",
  title: "APP 名單",
  description: "提供焦點比賽的目前出賽名單與快速切換。"
});

const state = getState();
const currentTeam = getCurrentTeam(state, { fallback: false });

if (!currentTeam) {
  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">尚未選擇球隊</div>
      <h2>請先從首頁選擇球隊與比賽</h2>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const game = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;

  if (!game) {
    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">${currentTeam.teamName}</div>
        <h2>目前沒有名單資料</h2>
      </section>
    `;
  } else {
    const items = game.lineup.activeParticipants
      .map((id) => state.players.find((player) => player.playerId === id) || { displayName: id, primaryPositions: ["Guest"], linkedUserId: null })
      .map((player) => `<div class="app-item"><strong>${player.displayName}</strong><p class="subtle">${player.primaryPositions.join(", ")} / ${player.linkedUserId || "未連結帳號"}</p></div>`);

    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">切換場次</div>
        <div class="app-button-row">
          ${teamGames.map((teamGame) => `<button class="app-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">目前出賽名單</div>
        <h2>${game.title}</h2>
        ${renderAppList(items)}
      </section>
    `;

    document.querySelectorAll("[data-focus-game]").forEach((button) => {
      button.addEventListener("click", () => {
        setActiveGame(button.dataset.focusGame);
        window.location.reload();
      });
    });
  }
}
