import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame, updateGameSettings } from "../core/mock-store.js";
import { buildRulePresetId, summarizeRulePreset, validateLineup } from "../core/rule-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderTable } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "games",
  title: "比賽與規則設定",
  description: "先選球隊，再沿著單一場比賽檢查規則、名單與後續回顧 / 分享流程。"
});

const currentTeam = getCurrentTeam(state, { fallback: false });

if (!currentTeam) {
  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">尚未選擇球隊</div>
          <h2>比賽設定屬於球隊脈絡</h2>
          <p>未選球隊時，不直接打開某支球隊的賽程與規則。請先從右上角選擇球隊，再查看該隊比賽。</p>
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">展示建議</div>
          <p>進 demo 時可先到行事曆或球隊治理，再回到這頁查看當前球隊的比賽設定。</p>
        </section>
      </aside>
    </section>
  `;
} else {
  const teamGames = getGamesForTeam(state, currentTeam.teamId);
  const currentGame = getCurrentGame(state, { teamId: currentTeam.teamId }) || teamGames[0] || null;
  const ruleSummary = currentGame ? summarizeRulePreset(currentGame) : null;
  const validation = currentGame ? validateLineup(currentGame, currentGame.lineup) : null;

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">${currentTeam.teamName} 比賽列表</div>
          ${teamGames.length
            ? renderTable(
                ["比賽", "分類", "規則模式", "狀態", "焦點"],
                teamGames.map(
                  (game) => `
                    <tr>
                      <td>${game.title}</td>
                      <td>${game.competitionCategory}</td>
                      <td>${game.sportType} / ${game.matchMode}</td>
                      <td>${game.gameStatus}</td>
                      <td><button class="cta-button ${currentGame?.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${game.gameId}">${currentGame?.gameId === game.gameId ? "目前焦點" : "切到此場"}</button></td>
                    </tr>`
                )
              )
            : `<div class="empty-state">此球隊目前尚未建立比賽。</div>`}
        </section>
        <section class="module-card">
          <div class="eyebrow">目前焦點比賽</div>
          ${currentGame
            ? `
              <h2>${currentGame.title}</h2>
              <p>${currentGame.gameDate}｜${currentGame.venue}｜對手 ${currentGame.opponentName}</p>
              <div class="button-row">
                ${formatBadge(ruleSummary.label, validation.isValid ? "success" : "danger")}
                ${formatBadge(currentGame.competitionCategory, "info")}
                ${formatBadge(currentGame.visibilityMode === "public" ? "可公開" : "隊內", currentGame.visibilityMode === "public" ? "success" : "warning")}
              </div>
              <div class="quick-grid">
                <a class="quick-link" href="lineup.html"><strong>查看名單</strong><span>延續同一場比賽檢查名單與再上場。</span></a>
                <a class="quick-link" href="review.html"><strong>前往回顧</strong><span>檢查待審事件與賽後修正。</span></a>
                <a class="quick-link" href="share.html"><strong>查看分享</strong><span>確認這一場的公開範圍。</span></a>
              </div>`
            : `<p>目前沒有可用的焦點比賽。</p>`}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">規則切換</div>
          ${currentGame
            ? `
              <p>${ruleSummary.summary}</p>
              <div class="button-row">
                <button class="cta-button" id="set-baseball-official">棒球 / 正式賽</button>
                <button class="cta-button is-primary" id="set-softball-friendly">壘球 / 友誼賽</button>
              </div>`
            : `<p>請先選擇焦點比賽。</p>`}
        </section>
        <section class="module-card">
          <div class="eyebrow">名單驗證</div>
          ${validation
            ? `<p>${validation.isValid ? "目前名單符合規則。" : validation.issues.join(" / ")}</p><p>${validation.highlights.join(" / ") || "目前無額外提示。"}</p>`
            : `<p>目前沒有可驗證的名單。</p>`}
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

  document.querySelector("#set-baseball-official")?.addEventListener("click", () => {
    updateGameSettings(currentGame.gameId, { sportType: "baseball", matchMode: "official", rulePresetId: buildRulePresetId("baseball", "official") });
    window.location.reload();
  });

  document.querySelector("#set-softball-friendly")?.addEventListener("click", () => {
    updateGameSettings(currentGame.gameId, { sportType: "softball", matchMode: "friendly", rulePresetId: buildRulePresetId("softball", "friendly") });
    window.location.reload();
  });
}
