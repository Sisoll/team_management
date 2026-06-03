import { getCurrentTeam, getState, linkPlayerAccount } from "../core/mock-store.js";
import { canManageTeam, getCurrentUser, getLinkedPlayersForUser } from "../core/permission-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderList, renderTable, renderTimeline } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "players",
  title: "球員與名單",
  description: "未選球隊時先看自己的球員身份；選定球隊後才查看完整名單、帳號連結與歷史。"
});

const currentUser = getCurrentUser(state);
const currentTeam = getCurrentTeam(state, { fallback: false });

function getTeamName(teamId) {
  return state.teams.find((team) => team.teamId === teamId)?.teamName || teamId;
}

if (!currentTeam) {
  const linkedPlayers = getLinkedPlayersForUser(state, currentUser.userId);

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">個人球員身份</div>
          <h2>${currentUser.displayName}</h2>
          <p>目前為個人視角，因此只顯示你已連結的球員身份，不直接打開任何球隊完整名單。</p>
          ${linkedPlayers.length
            ? renderList(
                linkedPlayers.map(
                  (player) => `<div class="list-item"><strong>${player.displayName}</strong><p>${getTeamName(player.teamId)}｜背號 ${player.uniformNumber}｜${player.primaryPositions.join(" / ")}</p><p class="subtle">帳號狀態：${player.accountLinkStatus}</p></div>`
                )
              )
            : `<div class="empty-state">此帳號目前沒有已連結的球員身份。若要檢查完整名單與帳號綁定流程，請先從右上角選擇球隊。</div>`}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">下一步</div>
          <p>球員名單、狀態調整、帳號補綁與歷史管理都屬於球隊層級內容，請先選擇球隊再繼續。</p>
        </section>
      </aside>
    </section>
  `;
} else {
  const teamPlayers = state.players.filter((player) => player.teamId === currentTeam.teamId);
  const focusPlayer = teamPlayers.find((player) => player.accountLinkStatus !== "linked") || teamPlayers[0] || null;
  const manageable = canManageTeam(state, currentTeam.teamId, currentUser.userId);

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">${currentTeam.teamName} 名單</div>
          ${renderTable(
            ["球員", "背號", "守位", "帳號連結", "狀態"],
            teamPlayers.map(
              (player) => `
                <tr>
                  <td>${player.displayName}</td>
                  <td>${player.uniformNumber}</td>
                  <td>${player.primaryPositions.join(", ")}</td>
                  <td>${player.linkedUserId || "未連結"}</td>
                  <td>${player.rosterStatus} / ${player.availability}</td>
                </tr>`
            )
          )}
        </section>
        <section class="module-card">
          <div class="eyebrow">球員歷史</div>
          ${focusPlayer
            ? renderTimeline(
                focusPlayer.historyRecords.map((record, index) => ({
                  id: `${focusPlayer.playerId}-${index}`,
                  title: `${focusPlayer.displayName} · ${record.date}`,
                  detail: record.note,
                  badge: focusPlayer.accountLinkStatus
                }))
              )
            : `<div class="empty-state">此球隊目前尚未建立球員資料。</div>`}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">焦點球員</div>
          ${focusPlayer
            ? `
              <h3>${focusPlayer.displayName}</h3>
              <p>帳號狀態：${focusPlayer.linkedUserId || "未連結"}</p>
              <div class="button-row">
                ${formatBadge(focusPlayer.accountLinkStatus, focusPlayer.linkedUserId ? "success" : "warning")}
                ${formatBadge(manageable ? "可維護" : "唯讀檢視", manageable ? "success" : "info")}
              </div>
              <div class="button-row">
                <button class="cta-button is-primary" id="link-account" ${manageable ? "" : "disabled"}>連結到 u-player-2</button>
                <button class="cta-button" id="unlink-account" ${manageable ? "" : "disabled"}>解除帳號連結</button>
              </div>`
            : `<p>目前沒有可操作的焦點球員。</p>`}
        </section>
        <section class="module-card">
          <div class="eyebrow">驗證重點</div>
          <p>這頁應該反映球隊脈絡下的完整名單，同時保留後補帳號連結與歷史紀錄，不因帳號變更而覆蓋球員沿革。</p>
        </section>
      </aside>
    </section>
  `;

  document.querySelector("#link-account")?.addEventListener("click", () => {
    if (focusPlayer) {
      linkPlayerAccount(focusPlayer.playerId, "u-player-2");
      window.location.reload();
    }
  });

  document.querySelector("#unlink-account")?.addEventListener("click", () => {
    if (focusPlayer) {
      linkPlayerAccount(focusPlayer.playerId, null);
      window.location.reload();
    }
  });
}
