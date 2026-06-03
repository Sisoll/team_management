import { createTeam, getCurrentTeam, inviteMember, setMemberRoles } from "../core/mock-store.js";
import { canManageTeam, getCurrentUser } from "../core/permission-engine.js";
import { formatBadge } from "../core/router.js";
import { initWebPage, renderTable } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "teams",
  title: "球隊治理",
  description: "從右上角管理入口進入。若未選球隊，先引導使用者選擇球隊或建立第一支球隊。"
});

const currentUser = getCurrentUser(state);
const team = getCurrentTeam(state, { fallback: false });

if (!team) {
  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">尚未選擇球隊</div>
          <h2>${currentUser.joinedTeams.length ? "請先從右上角選擇球隊" : "此帳號尚未加入任何球隊"}</h2>
          <p>${currentUser.joinedTeams.length ? "球隊治理、成員角色與邀請內容都需要在特定球隊脈絡下查看。" : "你可以先建立一支球隊，建立後會直接切換到該隊脈絡。"}</p>
          <div class="button-row">
            ${currentUser.joinedTeams.length ? formatBadge("先選球隊再回到管理頁", "warning") : `<button class="cta-button is-primary" id="create-team-button">建立第一支展示球隊</button>`}
          </div>
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">驗證重點</div>
          <p>這一頁不能在個人視角直接顯示某支球隊的管理資料，避免資料上下文錯置。</p>
        </section>
      </aside>
    </section>
  `;

  document.querySelector("#create-team-button")?.addEventListener("click", () => {
    createTeam(`展示新球隊 ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`);
    window.location.reload();
  });
} else {
  const rows = team.members.map((member) => `
    <tr>
      <td>${member.userId}</td>
      <td>${member.roles.join(" / ")}</td>
      <td>${member.membershipStatus}</td>
    </tr>
  `);
  const manageable = canManageTeam(state, team.teamId, currentUser.userId);

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">球隊摘要</div>
          <h2>${team.teamName}</h2>
          <p>球種偏好：${team.sportType}，分享預設 Tier：${team.shareTierPreset}</p>
          <div class="button-row">
            ${manageable ? formatBadge("可維護角色與邀請", "success") : formatBadge("目前為檢視模式", "warning")}
            ${formatBadge(`邀請中 ${team.invitations.length} 位`, "info")}
          </div>
        </section>
        <section class="module-card">
          <div class="eyebrow">角色矩陣</div>
          ${renderTable(["成員", "角色", "狀態"], rows)}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">邀請與授權</div>
          <p>按下按鈕可模擬重新邀請 `u-player-2`，或將其升級為 `player + scorer` 多角色。</p>
          <div class="button-row">
            <button class="cta-button is-primary" id="invite-member" ${manageable ? "" : "disabled"}>重新送出邀請</button>
            <button class="cta-button" id="promote-scorer" ${manageable ? "" : "disabled"}>升級為球員兼紀錄員</button>
          </div>
        </section>
        <section class="module-card">
          <div class="eyebrow">必要狀態</div>
          <p>本頁涵蓋：切換球隊後才顯示治理內容、邀請中成員、角色多重指派成功。</p>
        </section>
      </aside>
    </section>
  `;

  document.querySelector("#invite-member")?.addEventListener("click", () => {
    inviteMember(team.teamId, "u-player-2", ["player"]);
    window.location.reload();
  });

  document.querySelector("#promote-scorer")?.addEventListener("click", () => {
    setMemberRoles(team.teamId, "u-player-2", ["player", "scorer"]);
    window.location.reload();
  });
}
