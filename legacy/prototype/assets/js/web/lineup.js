import { getCurrentGame, getCurrentTeam, getGamesForTeam, getState, setActiveGame } from "../core/mock-store.js";
import { evaluateReEntry, validateLineup } from "../core/rule-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderHeroStats, renderTable } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "lineup",
  title: "名單與再上場",
  description: "在球隊與焦點比賽脈絡下檢查出賽名單、替補與再上場合法性。"
});

const currentTeam = getCurrentTeam(state, { fallback: false });

function resolveParticipant(playerId) {
  return state.players.find((player) => player.playerId === playerId) || { displayName: playerId, primaryPositions: ["Guest"], linkedUserId: null, reEntryUsed: false };
}

if (!currentTeam) {
  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">尚未選擇球隊</div>
          <h2>名單配置需要球隊與比賽脈絡</h2>
          <p>未選球隊時不顯示完整先發與替補名單。請先從右上角選球隊，再從比賽頁切到焦點場次。</p>
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">建議路徑</div>
          <p>首頁 → 行事曆 → 球隊切換 → 比賽 → 名單，這樣 demo 會最順。</p>
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
        <h2>目前沒有可展示的比賽名單</h2>
      </section>
    `;
  } else {
    const validation = validateLineup(game, game.lineup);
    const activePlayers = game.lineup.activeParticipants.map(resolveParticipant);
    const benchPlayers = (game.lineup.benchPlayers || []).map(resolveParticipant);
    const reEntryPlayer = activePlayers.find((player) => player.playerId === "p-03") || activePlayers[0] || resolveParticipant("p-03");
    const reEntryCheck = evaluateReEntry(game, reEntryPlayer);

    root.innerHTML = `
      <section class="page-layout">
        <div class="stack">
          <section class="module-card">
            <div class="eyebrow">焦點比賽</div>
            <h2>${game.title}</h2>
            <p>${game.gameDate}｜${game.sportType} / ${game.matchMode}｜名單模式 ${game.lineup.mode}</p>
            ${renderHeroStats([
              { label: "場上人數", value: validation.activeCount },
              { label: "先發", value: game.lineup.startingLineup.length },
              { label: "替補", value: benchPlayers.length }
            ])}
          </section>
          <section class="module-card">
            <div class="eyebrow">目前出賽名單</div>
            ${renderTable(
              ["球員", "主要守位", "帳號連結", "再上場狀態"],
              activePlayers.map(
                (player) => `
                  <tr>
                    <td>${player.displayName}</td>
                    <td>${player.primaryPositions.join(", ")}</td>
                    <td>${player.linkedUserId || "未連結"}</td>
                    <td>${player.reEntryUsed ? "已使用" : "可用"}</td>
                  </tr>`
              )
            )}
          </section>
          <section class="module-card">
            <div class="eyebrow">替補席</div>
            ${benchPlayers.length
              ? renderTable(
                  ["球員", "主要守位", "帳號連結"],
                  benchPlayers.map((player) => `<tr><td>${player.displayName}</td><td>${player.primaryPositions.join(", ")}</td><td>${player.linkedUserId || "未連結"}</td></tr>`)
                )
              : `<div class="empty-state">目前沒有替補席資料。</div>`}
          </section>
        </div>
        <aside class="stack">
          <section class="module-card">
            <div class="eyebrow">切換比賽</div>
            <div class="button-row">
              ${teamGames.map((teamGame) => `<button class="cta-button ${teamGame.gameId === game.gameId ? "is-primary" : ""}" data-focus-game="${teamGame.gameId}">${teamGame.gameId === game.gameId ? "目前焦點" : teamGame.competitionCategory}</button>`).join("")}
            </div>
          </section>
          <section class="module-card">
            <div class="eyebrow">合法性提示</div>
            <p>${validation.isValid ? "目前名單合法。" : validation.issues.join(" / ")}</p>
            <p>${validation.highlights.join(" / ") || "目前無額外提示。"}</p>
          </section>
          <section class="module-card">
            <div class="eyebrow">再上場檢查</div>
            <p>${reEntryPlayer.displayName}：${reEntryCheck.reason}</p>
            <div class="button-row">${formatBadge(reEntryCheck.allowed ? "允許再上場" : "不可再上場", reEntryCheck.allowed ? "success" : "danger")}</div>
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
  }
}
