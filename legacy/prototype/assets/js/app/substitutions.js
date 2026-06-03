import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame } from "../core/mock-store.js";
import { evaluateSubstitution } from "../core/rule-engine.js";
import { initAppPage, renderAppList } from "./common.js";

const { root } = initAppPage({
  moduleId: "substitutions",
  title: "APP 換人與再上場",
  description: "焦點比賽下查看代打、代跑、守位調整與再上場判斷。"
});

const state = getState();
const currentTeam = getCurrentTeam(state, { fallback: false });

if (!currentTeam) {
  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">尚未選擇球隊</div>
      <h2>請先從首頁選擇球隊與焦點比賽</h2>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const game = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;

  if (!game) {
    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">${currentTeam.teamName}</div>
        <h2>目前沒有可檢查的比賽</h2>
      </section>
    `;
  } else {
    const items = state.players
      .filter((player) => player.teamId === currentTeam.teamId)
      .slice(0, 4)
      .map((player) => {
        const result = evaluateSubstitution(game, player, player.playerId === "p-03" ? "re-entry" : "substitution");
        return `<div class="app-item"><strong>${player.displayName}</strong><p class="subtle">${result.reason}</p></div>`;
      });

    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">切換場次</div>
        <div class="app-button-row">
          ${teamGames.map((teamGame) => `<button class="app-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">換人檢查</div>
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
