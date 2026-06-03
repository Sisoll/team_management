import { getCurrentTeam, getState } from "../core/mock-store.js";
import { getCurrentUser, getFeatureVisibilitySummary } from "../core/permission-engine.js";
import { buildReportView } from "../core/stats-engine.js";
import { initWebPage, renderTable } from "./common.js";

const { root, state } = initWebPage({
  moduleId: "reports",
  title: "區間報表",
  description: "選定球隊後查看該隊區間報表；未選球隊時不直接開球隊層級報表。"
});

const currentTeam = getCurrentTeam(state, { fallback: false });
const currentUser = getCurrentUser(state);
let category = "all";
let mergeMode = "separate";
let period = "quarterly_3_months";

function renderTeamReport() {
  const visibility = getFeatureVisibilitySummary(state, currentTeam.teamId, currentUser.userId);
  const reportAllowed = visibility.some((item) => item.label === "統計與回顧" && item.allowed);
  const report = buildReportView(state, { category, mergeMode, period, teamId: currentTeam.teamId });

  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">${currentTeam.teamName} 報表</div>
          <h2>${reportAllowed ? "區間輸出" : "目前身分不可查看報表"}</h2>
          <p>${reportAllowed ? report.note : "請切換到具備統計與回顧權限的身分，例如管理者、教練、紀錄員或球員。"}</p>
          ${reportAllowed
            ? renderTable(
                ["球員", "場次", "安打", "壘打數", "打點"],
                report.playerRows.map((row) => `<tr><td>${row.displayName}</td><td>${row.games}</td><td>${row.hits}</td><td>${row.totalBases}</td><td>${row.runsBattedIn}</td></tr>`)
              )
            : `<div class="empty-state">當前身分沒有球隊報表權限。</div>`}
        </section>
        <section class="module-card">
          <div class="eyebrow">戰績納入結果</div>
          ${reportAllowed
            ? renderTable(
                ["分類", "總場次", "納入", "排除", "特殊結果"],
                report.includedRecordRows.map((row) => `<tr><td>${row.category}</td><td>${row.total}</td><td>${row.included}</td><td>${row.excluded}</td><td>${row.special}</td></tr>`)
              )
            : `<div class="empty-state">切換權限後可查看球隊區間報表。</div>`}
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">分類</div>
          <div class="button-row">
            <button class="cta-button ${category === "all" ? "is-primary" : ""}" data-category="all">全部</button>
            <button class="cta-button ${category === "cup" ? "is-primary" : ""}" data-category="cup">盃賽</button>
            <button class="cta-button ${category === "league" ? "is-primary" : ""}" data-category="league">聯盟賽</button>
            <button class="cta-button ${category === "friendly" ? "is-primary" : ""}" data-category="friendly">友誼賽</button>
          </div>
        </section>
        <section class="module-card">
          <div class="eyebrow">區間與合併</div>
          <div class="button-row">
            <button class="cta-button ${period === "quarterly_3_months" ? "is-primary" : ""}" data-period="quarterly_3_months">3 個月</button>
            <button class="cta-button ${period === "yearly_12_months" ? "is-primary" : ""}" data-period="yearly_12_months">1 年</button>
            <button class="cta-button ${period === "custom_range" ? "is-primary" : ""}" data-period="custom_range">自訂區間</button>
          </div>
          <div class="button-row">
            <button class="cta-button ${mergeMode === "separate" ? "is-primary" : ""}" data-merge="separate">分類分開</button>
            <button class="cta-button ${mergeMode === "merged" ? "is-primary" : ""}" data-merge="merged">全部合併</button>
            <button class="cta-button ${mergeMode === "partial" ? "is-primary" : ""}" data-merge="partial">部分合併</button>
          </div>
        </section>
      </aside>
    </section>
  `;

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      category = button.dataset.category;
      renderTeamReport();
    });
  });

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      period = button.dataset.period;
      renderTeamReport();
    });
  });

  document.querySelectorAll("[data-merge]").forEach((button) => {
    button.addEventListener("click", () => {
      mergeMode = button.dataset.merge;
      renderTeamReport();
    });
  });
}

if (!currentTeam) {
  root.innerHTML = `
    <section class="page-layout">
      <div class="stack">
        <section class="module-card">
          <div class="eyebrow">尚未選擇球隊</div>
          <h2>報表需要球隊上下文</h2>
          <p>未選球隊時只保留個人資料與個人成績入口，不直接顯示球隊層級的區間報表。</p>
        </section>
      </div>
      <aside class="stack">
        <section class="module-card">
          <div class="eyebrow">下一步</div>
          <p>請先從右上角選擇球隊，再查看該隊的區間輸出與戰績納入結果。</p>
        </section>
      </aside>
    </section>
  `;
} else {
  renderTeamReport();
}
