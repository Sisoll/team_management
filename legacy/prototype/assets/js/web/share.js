import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame, updateGameSettings } from "../core/mock-store.js";
import { canManageTeam, filterSharedGameData, getCurrentUser } from "../core/permission-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderList } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "share",
  title: "公開分享與可見範圍",
  description: "從球隊與焦點比賽脈絡調整分享等級，確認公開檢視者會看到什麼。"
});

const currentTeam = getCurrentTeam(state, { fallback: false });
const currentUser = getCurrentUser(state);

function renderShareView() {
  const latestState = getState();
  const latestTeam = getCurrentTeam(latestState, { fallback: false });
  const teamGames = getGamesForTeam(latestState, latestTeam.teamId);
  const latestGame = getCurrentGame(latestState, { teamId: latestTeam.teamId }) || teamGames[0] || null;
  const manageable = canManageTeam(latestState, latestTeam.teamId, currentUser.userId);

  if (!latestGame) {
    root.innerHTML = `
      <section class="module-card">
        <div class="eyebrow">${latestTeam.teamName}</div>
        <h2>目前沒有可分享的比賽</h2>
      </section>
    `;
    return;
  }

  const shared = filterSharedGameData(latestState, latestGame);

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">分享狀態</div>
          <h2>${latestGame.title}</h2>
          <p>${latestGame.gameDate}｜目前：${latestGame.visibilityMode} / Tier ${latestGame.shareTierMode}</p>
          <div class="button-row">
            ${formatBadge(latestGame.visibilityMode === "public" ? "公開中" : "非公開", latestGame.visibilityMode === "public" ? "success" : "danger")}
            ${formatBadge(shared.title, "info")}
            ${formatBadge(manageable ? "可調整" : "唯讀檢視", manageable ? "success" : "warning")}
          </div>
        </section>
        <section class="module-card">
          <div class="eyebrow">可公開欄位</div>
          ${shared.visible
            ? renderList(shared.fields.map((field) => `<div class="list-item"><strong>${field}</strong><p class="subtle">由系統預設 Tier 控制，不可單場突破。</p></div>`))
            : `<div class="empty-state">目前為非公開賽事，公開檢視者不可存取任何賽事內容。</div>`}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">切換焦點場次</div>
          <div class="button-row">
            ${teamGames.map((game) => `<button class="cta-button ${game.gameId === latestGame.gameId ? "is-primary" : ""}" data-focus-game="${game.gameId}">${game.gameId === latestGame.gameId ? "目前焦點" : game.competitionCategory}</button>`).join("")}
          </div>
        </section>
        <section class="module-card">
          <div class="eyebrow">分享設定</div>
          <div class="button-row">
            <button class="cta-button ${latestGame.visibilityMode === "public" ? "is-primary" : ""}" data-visibility="public" ${manageable ? "" : "disabled"}>設為公開</button>
            <button class="cta-button ${latestGame.visibilityMode !== "public" ? "is-primary" : ""}" data-visibility="team-only" ${manageable ? "" : "disabled"}>設為隊內</button>
          </div>
          <div class="button-row">
            <button class="cta-button" data-tier="A" ${manageable ? "" : "disabled"}>Tier A</button>
            <button class="cta-button" data-tier="B" ${manageable ? "" : "disabled"}>Tier B</button>
            <button class="cta-button" data-tier="C" ${manageable ? "" : "disabled"}>Tier C</button>
          </div>
          <div class="quick-grid">
            <a class="quick-link" href="../app/share-preview.html"><strong>看 APP 預覽</strong><span>切到手機端查看公開檢視結果。</span></a>
          </div>
        </section>
      </aside>
    </section>
  `;

  document.querySelectorAll("[data-focus-game]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveGame(button.dataset.focusGame);
      renderShareView();
    });
  });

  document.querySelectorAll("[data-visibility]").forEach((button) => {
    button.addEventListener("click", () => {
      if (manageable) {
        updateGameSettings(latestGame.gameId, { visibilityMode: button.dataset.visibility });
        renderShareView();
      }
    });
  });

  document.querySelectorAll("[data-tier]").forEach((button) => {
    button.addEventListener("click", () => {
      if (manageable) {
        updateGameSettings(latestGame.gameId, { shareTierMode: button.dataset.tier, visibilityMode: "public" });
        renderShareView();
      }
    });
  });
}

if (!currentTeam) {
  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">尚未選擇球隊</div>
          <h2>分享設定需要球隊與比賽脈絡</h2>
          <p>未選球隊時不顯示任何球隊賽事的公開設定。請先選擇球隊，再切到想分享的比賽。</p>
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">展示建議</div>
          <p>建議先到比賽頁選好焦點場次，再來這頁看公開範圍與 APP 分享預覽。</p>
        </section>
      </aside>
    </section>
  `;
} else {
  renderShareView();
}
