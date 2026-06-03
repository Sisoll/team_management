import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame } from "../core/mock-store.js";
import { filterSharedGameData } from "../core/permission-engine.js";
import { initAppPage, renderAppList } from "./common.js";

const { root } = initAppPage({
  moduleId: "share-preview",
  title: "APP 分享預覽",
  description: "公開檢視者在手機端會看到的只讀內容。"
});

const state = getState();
const currentTeam = getCurrentTeam(state, { fallback: false });

if (!currentTeam) {
  root.innerHTML = `
    <section class="app-card">
      <div class="eyebrow">尚未選擇球隊</div>
      <h2>請先從 Web 或 APP 選擇球隊與焦點比賽</h2>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const game = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;

  if (!game) {
    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">${currentTeam.teamName}</div>
        <h2>目前沒有可預覽的比賽</h2>
      </section>
    `;
  } else {
    const shared = filterSharedGameData(state, game);

    root.innerHTML = `
      <section class="app-card">
        <div class="eyebrow">切換場次</div>
        <div class="app-button-row">
          ${teamGames.map((teamGame) => `<button class="app-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
        </div>
      </section>
      <section class="app-card">
        <div class="eyebrow">分享結果</div>
        <h2>${game.title}</h2>
        <p class="subtle">${shared.title}</p>
      </section>
      <section class="app-card">
        <div class="eyebrow">可視欄位</div>
        ${shared.visible ? renderAppList(shared.fields.map((field) => `<div class="app-item"><strong>${field}</strong><p class="subtle">僅提供只讀展示。</p></div>`)) : `<div class="app-item"><strong>非公開</strong><p class="subtle">目前沒有任何欄位可以公開顯示。</p></div>`}
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
